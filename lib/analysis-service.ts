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

function collectIconPathsFromValue(value: unknown, sink: Set<string>) {
    if (!value || typeof value !== 'object') return
    for (const entry of Object.values(value as Record<string, unknown>)) {
        if (typeof entry === 'string' && entry.trim().length > 0) {
            sink.add(entry.trim())
        }
    }
}

function extractManifestIconAssets(manifest: Record<string, unknown>, sourceDir: string) {
    const iconPaths = new Set<string>()
    collectIconPathsFromValue(manifest.icons, iconPaths)
    if (manifest.action && typeof manifest.action === 'object') {
        const action = manifest.action as Record<string, unknown>
        collectIconPathsFromValue(action.default_icon, iconPaths)
    }
    if (manifest.browser_action && typeof manifest.browser_action === 'object') {
        const browserAction = manifest.browser_action as Record<string, unknown>
        collectIconPathsFromValue(browserAction.default_icon, iconPaths)
    }
    if (manifest.page_action && typeof manifest.page_action === 'object') {
        const pageAction = manifest.page_action as Record<string, unknown>
        collectIconPathsFromValue(pageAction.default_icon, iconPaths)
    }
    const declaredIconPaths = Array.from(iconPaths)
    const existingIconPaths = declaredIconPaths.filter((iconPath) => {
        const absoluteIconPath = path.resolve(sourceDir, iconPath)
        return absoluteIconPath.startsWith(sourceDir) && fs.existsSync(absoluteIconPath)
    })
    return {
        hasDeclaredIcon: declaredIconPaths.length > 0,
        hasPackagedIcon: existingIconPaths.length > 0,
        declaredIconPaths,
        existingIconPaths,
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

async function runLookupFromSource(dbId: string, extensionId: string, analysisId: string, sourceDir: string) {
    const startedAt = Date.now()
    console.warn('[analysis] runLookupFromSource:start', { extensionId, dbId, analysisId, sourceDir })
    const { scanDirectory } = await import('@/lib/extension-analyzer/scanner');
    const results = scanDirectory(sourceDir);
    console.warn('[analysis] runLookupFromSource:scanCompleted', {
        extensionId,
        analysisId,
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
    console.warn('[analysis] runLookupFromSource:apexDomainsPrepared', {
        extensionId,
        analysisId,
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
            analysisId,
            domain: d,
            registrar,
            status,
            nameservers,
            createdDate,
            expiresDate,
        })
    }
    const domainEnrichment = (prisma as unknown as { domainEnrichment: DomainEnrichmentDelegate }).domainEnrichment
    if (enrichments.length > 0) {
        await domainEnrichment.createMany({
            data: enrichments
        });
    }
    const topDomains = await domainEnrichment.findMany({
        where: { analysisId },
        orderBy: { createdDate: 'desc' },
        take: 3,
        select: { id: true, domain: true, createdDate: true },
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
    await prisma.extensionAnalysisResult.update({
        where: { id: analysisId },
        data: {
            status: 'COMPLETED',
            domains: topDomainSignals.map((d) => JSON.stringify(d)),
            ips: Array.from(results.ips).slice(0, 200),
            urls: Array.from(results.urls).slice(0, 200),
            filesScanned: results.fileCount,
            updatedAt: new Date()
        }
    });
    await prisma.globalExtension.update({
        where: { id: dbId },
        data: {
            riskLevel: hasMaliciousDomain ? 'HIGH' : 'SAFE',
        },
    });
    console.warn('[analysis] runLookupFromSource:completed', {
        extensionId,
        analysisId,
        filesScanned: results.fileCount,
        elapsedMs: Date.now() - startedAt,
        riskLevel: hasMaliciousDomain ? 'HIGH' : 'SAFE',
    })
}

async function runLookupForExtension(dbId: string, extensionId: string) {
    const pendingAnalysis = await prisma.extensionAnalysisResult.findFirst({
        where: { extensionId: dbId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    })
    const analysis = pendingAnalysis
        ? await prisma.extensionAnalysisResult.update({
            where: { id: pendingAnalysis.id },
            data: { status: 'RUNNING', updatedAt: new Date() },
            select: { id: true },
        })
        : await prisma.extensionAnalysisResult.create({
            data: {
                extensionId: dbId,
                status: 'RUNNING',
            },
            select: { id: true },
        })
    const tempDir = path.join(os.tmpdir(), 'chrome-extension-lookup', extensionId);
    const crxDir = path.join(tempDir, 'crx');
    const sourceDir = path.join(tempDir, 'source');
    try {
        const crxPath = await downloadExtension(extensionId, crxDir);
        console.warn('[analysis] runLookupForExtension:downloaded', { extensionId, crxPath, analysisId: analysis.id })
        await extractExtension(crxPath, sourceDir);
        console.warn('[analysis] runLookupForExtension:extracted', { extensionId, sourceDir, analysisId: analysis.id })
        await runLookupFromSource(dbId, extensionId, analysis.id, sourceDir)
    } catch (e) {
        await prisma.extensionAnalysisResult.update({
            where: { id: analysis.id },
            data: {
                status: 'FAILED',
                updatedAt: new Date(),
            },
        })
        throw e
    } finally {
        if (fs.existsSync(tempDir)) {
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        }
    }
}

export async function enqueueExtensionLookupJob(dbId: string) {
    const existing = await prisma.scanJob.findFirst({
        where: {
            targetType: 'EXTENSION',
            targetId: dbId,
            status: { in: ['PENDING', 'RUNNING'] },
        },
        orderBy: { startedAt: 'desc' },
        select: { id: true, status: true },
    })
    if (existing) {
        return {
            jobId: existing.id,
            status: existing.status,
            queued: false,
        }
    }
    const hasInFlightAnalysis = await prisma.extensionAnalysisResult.findFirst({
        where: {
            extensionId: dbId,
            status: { in: ['PENDING', 'RUNNING'] },
        },
        select: { id: true },
    })
    if (!hasInFlightAnalysis) {
        await prisma.extensionAnalysisResult.create({
            data: {
                extensionId: dbId,
                status: 'PENDING',
            },
        })
    }
    const job = await prisma.scanJob.create({
        data: {
            targetType: 'EXTENSION',
            targetId: dbId,
            status: 'PENDING',
        },
        select: { id: true, status: true },
    })
    return {
        jobId: job.id,
        status: job.status,
        queued: true,
    }
}

export async function processPendingLookupJob() {
    const pending = await prisma.scanJob.findFirst({
        where: {
            targetType: 'EXTENSION',
            status: 'PENDING',
        },
        orderBy: { startedAt: 'asc' },
        select: { id: true, targetId: true },
    })
    if (!pending) {
        return { processed: false as const }
    }
    const claim = await prisma.scanJob.updateMany({
        where: { id: pending.id, status: 'PENDING' },
        data: { status: 'RUNNING', startedAt: new Date() },
    })
    if (claim.count === 0) {
        return { processed: false as const }
    }
    const startedAt = Date.now()
    try {
        const extension = await prisma.globalExtension.findUnique({
            where: { id: pending.targetId },
            select: { id: true, storeId: true },
        })
        if (!extension) {
            throw new Error(`Extension not found for job ${pending.id}`)
        }
        await runLookupForExtension(extension.id, extension.storeId)
        await prisma.scanJob.update({
            where: { id: pending.id },
            data: {
                status: 'COMPLETED',
                durationMs: Date.now() - startedAt,
            },
        })
        return { processed: true as const, id: pending.id, status: 'COMPLETED' as const }
    } catch (e) {
        await prisma.scanJob.update({
            where: { id: pending.id },
            data: {
                status: 'FAILED',
                durationMs: Date.now() - startedAt,
            },
        })
        console.error('[analysis] processPendingLookupJob:failed', { jobId: pending.id, error: e })
        return { processed: true as const, id: pending.id, status: 'FAILED' as const }
    }
}

export function scheduleExtensionLookupService(periodMs: number) {
    let running = false
    const tick = async () => {
        if (running) return
        running = true
        try {
            await processPendingLookupJob()
        } catch (e) {
            console.error('[analysis] lookup tick failed', e)
        } finally {
            running = false
        }
    }
    tick()
    return setInterval(tick, periodMs)
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
        const manifestIconAssets = extractManifestIconAssets(manifest, sourceDir)
        
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
                    manifestIconAssets,
                },
            },
        })
        console.warn('[analysis] processExtension:snapshotStored', {
            extensionId,
            dbId: extension.id,
            requestedPermissions: manifestPermissions.allRequestedPermissions.length,
            hasPackagedIcon: manifestIconAssets.hasPackagedIcon,
        })
        const queueJob = await enqueueExtensionLookupJob(extension.id)
        console.warn('[analysis] processExtension:lookupEnqueued', {
            extensionId,
            dbId: extension.id,
            queueJob,
        })

        return extension;
    } catch (error) {
        console.error('[analysis] processExtension:failed', { extensionId, error })
        throw error;
    } finally {
        if (fs.existsSync(tempDir)) {
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        }
    }
}

export async function triggerAsyncAnalysis(dbId: string, extensionId: string, sourceDir: string) {
    try {
        const analysis = await prisma.extensionAnalysisResult.create({
            data: {
                extensionId: dbId,
                status: 'RUNNING',
            },
            select: { id: true },
        });
        await runLookupFromSource(dbId, extensionId, analysis.id, sourceDir)
    } catch (e) {
        console.error('Async analysis failed:', e);
        console.error('[analysis] triggerAsyncAnalysis:failed', { extensionId, dbId, error: e })
    }
}
