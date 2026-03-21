import { prisma } from '@/lib/prisma';
import { downloadExtension, extractExtension } from '@/lib/extension-analyzer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getDomain } from 'tldts';
import { rdapDomain, whoisInfo, vtGetDomain } from '@/lib/threat-intel';

type DomainEnrichmentDelegate = {
    createMany: (args: { data: unknown[] }) => Promise<unknown>
    findMany: (args: {
        where: { analysisId: string }
        orderBy: { createdDate: 'desc' }
        take: number
        select: { id: true; domain: true; createdDate: true }
    }) => Promise<Array<{ id: string; domain: string; createdDate: Date | null }>>
    update: (args: {
        where: { id: string }
        data: { isMalicious: boolean }
    }) => Promise<unknown>
}

const resolveLocalizedString = (value: unknown, baseDir: string, manifestObj: { default_locale?: string }): string => {
    if (typeof value !== 'string') return String(value ?? '');
    const match = value.match(/^__MSG_(.+)__$/);
    if (!match) return value;
    const key = match[1];
    const locale = manifestObj.default_locale || 'en';
    const messagesPath = path.join(baseDir, '_locales', locale, 'messages.json');
    try {
        if (fs.existsSync(messagesPath)) {
            const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'));
            const entry = messages[key];
            if (entry && typeof entry.message === 'string') {
                return entry.message;
            }
        }
    } catch {
        // ignore locale resolution errors
    }
    return value;
}

function isDomainMalicious(vt: unknown): boolean {
    if (!vt || typeof vt !== 'object') return false
    const data = (vt as { data?: unknown }).data
    if (!data || typeof data !== 'object') return false
    const attributes = (data as { attributes?: unknown }).attributes
    if (!attributes || typeof attributes !== 'object') return false
    const stats = (attributes as { last_analysis_stats?: unknown }).last_analysis_stats
    if (!stats || typeof stats !== 'object') return false
    const malicious = (stats as { malicious?: unknown }).malicious
    return typeof malicious === 'number' && malicious > 0
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string')
}

function extractManifestPermissions(manifest: Record<string, unknown>) {
    const permissions = toStringArray(manifest.permissions)
    const hostPermissions = toStringArray(manifest.host_permissions)
    const optionalPermissions = toStringArray(manifest.optional_permissions)
    const optionalHostPermissions = toStringArray(manifest.optional_host_permissions)
    return {
        permissions,
        hostPermissions,
        optionalPermissions,
        optionalHostPermissions,
        allRequestedPermissions: Array.from(
            new Set([
                ...permissions,
                ...hostPermissions,
                ...optionalPermissions,
                ...optionalHostPermissions,
            ])
        ),
    }
}

function getPublisher(manifest: Record<string, unknown>): string {
    const author = manifest.author
    if (typeof author === 'string') return author
    if (author && typeof author === 'object' && 'name' in author && typeof author.name === 'string') {
        return author.name
    }
    const developer = manifest.developer
    if (developer && typeof developer === 'object' && 'name' in developer && typeof developer.name === 'string') {
        return developer.name
    }
    return ''
}

export async function processExtension(extensionId: string) {
    const tempDir = path.join(os.tmpdir(), 'chrome-extension-analyzer', extensionId);
    const crxDir = path.join(tempDir, 'crx');
    const sourceDir = path.join(tempDir, 'source');
    const startedAt = Date.now()

    try {
        console.warn('[analysis] processExtension:start', { extensionId, tempDir })
        // 1. Download
        const crxPath = await downloadExtension(extensionId, crxDir);
        console.warn('[analysis] processExtension:downloaded', { extensionId, crxPath })
        
        // 2. Extract
        await extractExtension(crxPath, sourceDir);
        console.warn('[analysis] processExtension:extracted', { extensionId, sourceDir })
        
        // 3. Read Manifest
        const manifestPath = path.join(sourceDir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
             throw new Error('Manifest file not found');
        }
        
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
        console.warn('[analysis] processExtension:manifestLoaded', { extensionId, manifestPath })
        
        const publisher = getPublisher(manifest)

        const resolvedName = resolveLocalizedString(manifest.name, sourceDir, manifest);
        const version = typeof manifest.version === 'string' ? manifest.version : null
        const manifestPermissions = extractManifestPermissions(manifest)
        
        // 4. Upsert Extension
        const extension = await prisma.globalExtension.upsert({
            where: { storeId: extensionId },
            update: {
                name: resolvedName || extensionId,
                version,
                description: resolveLocalizedString(manifest.description, sourceDir, manifest),
                publisher: publisher || null,
                updatedAt: new Date()
            },
            create: {
                storeId: extensionId,
                name: resolvedName || extensionId,
                version,
                description: resolveLocalizedString(manifest.description, sourceDir, manifest),
                publisher: publisher || null,
                platform: 'CHROME'
            }
        });
        console.warn('[analysis] processExtension:upserted', {
            extensionId,
            dbId: extension.id,
            version: extension.version,
            elapsedMs: Date.now() - startedAt,
        })
        await prisma.assetSnapshot.create({
            data: {
                targetType: 'EXTENSION',
                targetId: extension.id,
                version,
                metadata: {
                    manifestPermissions,
                },
            },
        })
        console.warn('[analysis] processExtension:snapshotStored', {
            extensionId,
            dbId: extension.id,
            requestedPermissions: manifestPermissions.allRequestedPermissions.length,
        })

        // 5. Trigger Async Analysis
        // Fire and forget, but catch errors to avoid unhandled rejections
        triggerAsyncAnalysis(extension.id, extensionId, sourceDir).catch(e => console.error("Async analysis error:", e));
        console.warn('[analysis] processExtension:asyncTriggered', { extensionId, dbId: extension.id })

        return extension;
    } catch (error) {
        console.error('[analysis] processExtension:failed', { extensionId, error })
        // Cleanup if error occurs before analysis starts
        if (fs.existsSync(tempDir)) {
             try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        }
        throw error;
    }
}

export async function triggerAsyncAnalysis(dbId: string, extensionId: string, sourceDir: string) {
    try {
        const startedAt = Date.now()
        console.warn('[analysis] triggerAsyncAnalysis:start', { extensionId, dbId, sourceDir })
        // Create initial analysis record
        const analysis = await prisma.extensionAnalysisResult.create({
            data: {
                extensionId: dbId,
                status: 'RUNNING',
            }
        });
        console.warn('[analysis] triggerAsyncAnalysis:analysisCreated', { extensionId, analysisId: analysis.id })

        // Import scanner dynamically or use the one we have
        // lib/analysis-service.ts -> lib/extension-analyzer/scanner.ts
        const { scanDirectory } = await import('@/lib/extension-analyzer/scanner');
        console.warn('[analysis] triggerAsyncAnalysis:scannerReady', { extensionId, analysisId: analysis.id })
        
        const results = scanDirectory(sourceDir);
        console.warn('[analysis] triggerAsyncAnalysis:scanCompleted', {
            extensionId,
            analysisId: analysis.id,
            fileCount: results.fileCount,
            domainCount: results.domains.size,
            ipCount: results.ips.size,
            urlCount: results.urls.size,
        })
        
        const apexDomains = Array.from(
            new Set(
                Array.from(results.domains)
                    .map((d) => getDomain(String(d)) || null)
                    .filter((d): d is string => !!d)
            )
        ).slice(0, 20);
        console.warn('[analysis] triggerAsyncAnalysis:apexDomainsPrepared', {
            extensionId,
            analysisId: analysis.id,
            apexDomainCount: apexDomains.length,
        })
        const enrichments: Array<{
            analysisId: string;
            domain: string;
            registrar?: string | null;
            status?: string | null;
            nameservers: string[];
            createdDate?: Date | null;
            expiresDate?: Date | null;
        }> = [];
        for (let i = 0; i < apexDomains.length; i++) {
            const d = apexDomains[i]
            let registrar: string | null = null
            let status: string | null = null
            let nameservers: string[] = []
            let createdDate: Date | null = null
            let expiresDate: Date | null = null
            try {
                const info = await rdapDomain(d)
                registrar = info.registrar ?? null
                status = info.status ?? null
                nameservers = Array.isArray(info.nameservers) ? info.nameservers : []
                createdDate = info.createdDate ?? null
                expiresDate = info.expiresDate ?? null
            } catch {}
            const insufficient = (!registrar && !createdDate && !expiresDate && nameservers.length === 0)
            if (insufficient) {
                const w = await whoisInfo(d)
                registrar = registrar ?? w.registrar
                nameservers = nameservers.length ? nameservers : w.nameservers
                createdDate = createdDate ?? w.createdDate
                expiresDate = expiresDate ?? w.expiresDate
            }
            enrichments.push({
                analysisId: analysis.id,
                domain: d,
                registrar,
                status,
                nameservers,
                createdDate,
                expiresDate,
            })
            if ((i + 1) % 2 === 0) {
                console.warn('[analysis] triggerAsyncAnalysis:domainEnrichmentProgress', {
                    extensionId,
                    analysisId: analysis.id,
                    processedDomains: i + 1,
                    totalDomains: apexDomains.length,
                    currentDomain: d,
                })
            }
        }
        console.warn('[analysis] triggerAsyncAnalysis:domainEnrichmentBuilt', {
            extensionId,
            analysisId: analysis.id,
            enrichmentCount: enrichments.length,
        })
        const domainEnrichment = (prisma as unknown as { domainEnrichment: DomainEnrichmentDelegate }).domainEnrichment
        if (enrichments.length > 0) {
            await domainEnrichment.createMany({
                data: enrichments
            });
        }
        console.warn('[analysis] triggerAsyncAnalysis:domainEnrichmentStored', {
            extensionId,
            analysisId: analysis.id,
            enrichmentCount: enrichments.length,
        })

        const topDomains = await domainEnrichment.findMany({
            where: { analysisId: analysis.id },
            orderBy: { createdDate: 'desc' },
            take: 3,
            select: { id: true, domain: true, createdDate: true },
        })
        console.warn('[analysis] triggerAsyncAnalysis:topDomainsSelected', {
            extensionId,
            analysisId: analysis.id,
            topDomainCount: topDomains.length,
        })
        const topDomainSignals: Array<{
            topDomainSignalId: string
            domain: string
            createTime: string | null
            isMalicious: boolean
        }> = await Promise.all(
            topDomains.map(async (item) => {
                let isMalicious = false
                try {
                    const vt = await vtGetDomain(item.domain)
                    isMalicious = isDomainMalicious(vt)
                } catch {}
                await domainEnrichment.update({
                    where: { id: item.id },
                    data: { isMalicious },
                })
                return {
                    topDomainSignalId: item.id,
                    domain: item.domain,
                    createTime: item.createdDate ? item.createdDate.toISOString() : null,
                    isMalicious,
                }
            }),
        )
        const hasMaliciousDomain = topDomainSignals.some((d) => d.isMalicious)
        console.warn('[analysis] triggerAsyncAnalysis:topDomainSignalsReady', {
            extensionId,
            analysisId: analysis.id,
            maliciousDomainCount: topDomainSignals.filter((d) => d.isMalicious).length,
            hasMaliciousDomain,
        })

        await prisma.extensionAnalysisResult.update({
            where: { id: analysis.id },
            data: {
                status: 'COMPLETED',
                domains: topDomainSignals.map((d) => JSON.stringify(d)),
                ips: Array.from(results.ips).slice(0, 200),
                urls: Array.from(results.urls).slice(0, 200),
                filesScanned: results.fileCount,
                updatedAt: new Date()
            }
        });
        console.warn('[analysis] triggerAsyncAnalysis:analysisUpdated', {
            extensionId,
            analysisId: analysis.id,
            filesScanned: results.fileCount,
            elapsedMs: Date.now() - startedAt,
        })
        await prisma.globalExtension.update({
            where: { id: dbId },
            data: {
                riskLevel: hasMaliciousDomain ? 'HIGH' : 'SAFE',
            },
        });
        console.warn('[analysis] triggerAsyncAnalysis:riskUpdated', {
            extensionId,
            dbId,
            riskLevel: hasMaliciousDomain ? 'HIGH' : 'SAFE',
        })

        // Cleanup temp files
        const tempExtensionDir = path.dirname(sourceDir); // .../extensionId
        if (fs.existsSync(tempExtensionDir)) {
            fs.rmSync(tempExtensionDir, { recursive: true, force: true });
        }
        console.warn('[analysis] triggerAsyncAnalysis:cleanupDone', { extensionId, tempExtensionDir })

    } catch (e) {
        console.error('Async analysis failed:', e);
        console.error('[analysis] triggerAsyncAnalysis:failed', { extensionId, dbId, error: e })
        // We might want to update the status to FAILED here if we had the ID
    }
}
