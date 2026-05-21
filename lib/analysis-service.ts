import { prisma } from '@/lib/prisma';
import { downloadExtension, extractExtension } from '@/lib/extension-analyzer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { setAnalyzeProgressStage } from '@/lib/analyze-progress';
import { normalizeApexDomainList, normalizeStoredDomainList } from '@/lib/domain-normalize';
import {
    buildApexDomainProvenanceList,
    provenanceMapFromList,
    recordManifestHostPermissionPatterns,
    type ApexDomainProvenance,
} from '@/lib/domain-provenance';
import {
    applyVtToStaticDomains,
    enrichApexDomains,
    persistStaticDomainEnrichments,
    riskLevelFromVtSignals,
    vtSignalsForYoungestDomains,
} from '@/lib/domain-enrichment';
import { triggerMaliciousAlertNotifications } from '@/lib/notification-trigger';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
    getExtensionAnalysisDir,
    getExtensionAnalyzerRoot,
} from '@/lib/extension-storage';
import { ensureDefaultCliConfigIfAbsent } from '@/lib/agent-artifact-defaults';
import {
    derivePackageDownloadPrefixFromUrl,
    isAllowedPackageDownloadUrl,
} from '@/lib/package-download-url';


const nowIso = () => new Date().toISOString()

const logInfo = (message: string, payload?: unknown) => {
    if (typeof payload === 'undefined') {
        console.warn(`${nowIso()} ${message}`)
        return
    }
    console.warn(`${nowIso()} ${message}`, payload)
}

const logError = (message: string, payload?: unknown) => {
    if (typeof payload === 'undefined') {
        console.error(`${nowIso()} ${message}`)
        return
    }
    console.error(`${nowIso()} ${message}`, payload)
}

const isDatabaseUnavailableError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false
    const code = (error as { code?: unknown }).code
    if (code === 'P1001') return true
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' && message.includes("Can't reach database server")
}

let lastDbUnavailableLookupLogAt = 0

const toPathSegment = (value: string | null | undefined, fallback: string) => {
    const trimmed = String(value ?? '').trim()
    if (!trimmed) return fallback
    const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_')
    return sanitized.length > 0 ? sanitized : fallback
}

const buildPendingDir = (bucketRoot: string, extensionId: string) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return path.join(bucketRoot, extensionId, `_pending-${runId}`)
}

const resolveReusableAnalyzerSourceDir = (extensionId: string, version: string | null | undefined) => {
    const analyzerRoot = getExtensionAnalyzerRoot()
    const extensionRoot = path.join(analyzerRoot, extensionId)
    const preferred = path.join(extensionRoot, toPathSegment(version, 'unknown'))
    if (fs.existsSync(preferred) && !!findManifestPath(preferred)) {
        return preferred
    }
    if (!fs.existsSync(extensionRoot)) return null
    let entries: fs.Dirent[] = []
    try {
        entries = fs.readdirSync(extensionRoot, { withFileTypes: true })
    } catch {
        return null
    }
    const candidates = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_pending-'))
        .map((entry) => path.join(extensionRoot, entry.name))
        .filter((dir) => fs.existsSync(dir) && !!findManifestPath(dir))
    if (candidates.length === 0) return null
    const sorted = candidates.sort((a, b) => {
        const aTime = fs.statSync(a).mtimeMs
        const bTime = fs.statSync(b).mtimeMs
        return bTime - aTime
    })
    return sorted[0]
}

const promoteToVersionedLayout = (params: {
    bucketRoot: string
    extensionId: string
    version: string | null | undefined
    pendingCrxPath: string
    pendingSourceDir: string
}) => {
    const versionSegment = toPathSegment(params.version, 'unknown')
    const extensionDir = path.join(params.bucketRoot, params.extensionId)
    const versionDir = path.join(extensionDir, versionSegment)
    fs.mkdirSync(extensionDir, { recursive: true })
    const finalCrxPath = path.join(versionDir, `${versionSegment}.crx`)
    const finalSourceDir = versionDir
    if (fs.existsSync(finalSourceDir)) fs.rmSync(finalSourceDir, { recursive: true, force: true })
    fs.renameSync(params.pendingSourceDir, finalSourceDir)
    if (fs.existsSync(finalCrxPath)) fs.rmSync(finalCrxPath, { force: true })
    fs.renameSync(params.pendingCrxPath, finalCrxPath)
    return { versionDir, crxPath: finalCrxPath, sourceDir: finalSourceDir, versionSegment }
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

function findManifestPath(sourceDir: string): string | null {
    const directPath = path.join(sourceDir, 'manifest.json')
    if (fs.existsSync(directPath)) return directPath
    const queue: string[] = [sourceDir]
    while (queue.length > 0) {
        const current = queue.shift()
        if (!current) continue
        let entries: fs.Dirent[] = []
        try {
            entries = fs.readdirSync(current, { withFileTypes: true })
        } catch {
            continue
        }
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name)
            if (entry.isFile() && entry.name === 'manifest.json') {
                return fullPath
            }
            if (entry.isDirectory()) {
                queue.push(fullPath)
            }
        }
    }
    return null
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
    ensureDefaultCliConfigIfAbsent(sourceDir)
    const versionSegment = path.basename(path.resolve(sourceDir))
    const analysisDir = getExtensionAnalysisDir(extensionId, versionSegment)
    fs.mkdirSync(analysisDir, { recursive: true })
    setAnalyzeProgressStage(extensionId, 'ANALYZING', 80, 'Scanning extension and enriching domains')
    logInfo('[analysis] runLookupFromSource:start', { extensionId, dbId, analysisId, sourceDir })
    const { scanDirectory } = await import('@/lib/extension-analyzer/scanner');
    const results = scanDirectory(sourceDir);
    const manifestPath = findManifestPath(sourceDir)
    if (manifestPath) {
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>
            const manifestPermissions = extractManifestPermissions(manifest)
            const manifestRel = path.relative(sourceDir, manifestPath).replace(/\\/g, '/')
            recordManifestHostPermissionPatterns({
                store: results.domainProvenance,
                patterns: [
                    ...manifestPermissions.hostPermissions,
                    ...manifestPermissions.optionalHostPermissions,
                ],
                manifestPath: manifestRel,
            })
            results.domains = new Set(results.domainProvenance.keys())
        } catch {
            // manifest parse errors should not block domain scan
        }
    }
    const domainProvenanceList = buildApexDomainProvenanceList(results.domainProvenance)
    const provenanceByApex = provenanceMapFromList(domainProvenanceList)
    const normalizedDomains = Array.from(results.domains)
        .map((d) => String(d).trim())
        .filter((d) => d.length > 0)
        .sort((a, b) => a.localeCompare(b))
    const rawDomainListPath = path.join(analysisDir, 'raw_domain_list.txt')
    const apexDomainListPath = path.join(analysisDir, 'apexdomain_list.json')
    const domainProvenancePath = path.join(analysisDir, 'domain_provenance.json')
    logInfo('[analysis] runLookupFromSource:scanCompleted', {
        extensionId,
        analysisId,
        fileCount: results.fileCount,
        domainCount: results.domains.size,
        ipCount: results.ips.size,
        urlCount: results.urls.size,
        rawDomainListPath,
        apexDomainListPath,
        domainProvenancePath,
    })
    const allUniqueApexDomains = normalizeApexDomainList(results.domains)
    const previousCompletedAnalysis = await prisma.extensionAnalysisResult.findFirst({
        where: {
            extensionId: dbId,
            status: 'COMPLETED',
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, domains: true },
    })
    const previousApexDomains = normalizeStoredDomainList(previousCompletedAnalysis?.domains || [])
    const previousApexDomainSet = new Set(previousApexDomains)
    const isFirstSeenAnalysis = !previousCompletedAnalysis
    const newlyAddedApexDomains = allUniqueApexDomains.filter((domain) => !previousApexDomainSet.has(domain))
    const inheritedApexDomains = allUniqueApexDomains.filter((domain) => previousApexDomainSet.has(domain))
    const apexDomainsForEnrichment = isFirstSeenAnalysis ? allUniqueApexDomains : newlyAddedApexDomains
    logInfo('[analysis] runLookupFromSource:apexDomainsPrepared', {
        extensionId,
        analysisId,
        apexDomainCount: allUniqueApexDomains.length,
        prevApexDomainCount: previousApexDomains.length,
        newApexDomainCount: newlyAddedApexDomains.length,
        inheritedApexDomainCount: inheritedApexDomains.length,
        whoisApexDomainCount: apexDomainsForEnrichment.length,
        mode: isFirstSeenAnalysis ? 'first_seen_full' : 'upgrade_incremental',
    })
    logInfo('[analysis] runLookupFromSource:enrichingDomains', {
        extensionId,
        analysisId,
        count: apexDomainsForEnrichment.length,
    })
    const enrichmentRows = await enrichApexDomains(apexDomainsForEnrichment)
    const enrichments = enrichmentRows.map((row) => ({
        analysisId,
        ...row,
    }))
    const domainEnrichment = prisma.domainEnrichment
    const inheritedEnrichments =
        previousCompletedAnalysis && inheritedApexDomains.length > 0
            ? await domainEnrichment.findMany({
                where: { analysisId: previousCompletedAnalysis.id, domain: { in: inheritedApexDomains } },
                select: {
                    domain: true,
                    registrar: true,
                    status: true,
                    nameservers: true,
                    createdDate: true,
                    expiresDate: true,
                    isMalicious: true,
                },
            })
            : []
    const allEnrichmentRows = [
        ...inheritedEnrichments.map((item) => ({
            analysisId,
            domain: item.domain,
            registrar: item.registrar,
            status: item.status,
            nameservers: item.nameservers,
            createdDate: item.createdDate,
            expiresDate: item.expiresDate,
            isMalicious: item.isMalicious ?? null,
        })),
        ...enrichments,
    ]
    if (allEnrichmentRows.length > 0) {
        await persistStaticDomainEnrichments(analysisId, allEnrichmentRows)
    }
    const enrichmentByDomain = new Map(allEnrichmentRows.map((item) => [item.domain, item]))
    const apexDomainList = allUniqueApexDomains.map((apexDomain) => {
        const enrichment = enrichmentByDomain.get(apexDomain) || null
        const provenance: ApexDomainProvenance | undefined = provenanceByApex.get(apexDomain)
        return {
            apexDomain,
            observedHosts: provenance?.observedHosts ?? [],
            sourceFiles: provenance?.sourceFiles ?? [],
            sources: provenance?.sources ?? [],
            createdDate: enrichment?.createdDate ? enrichment.createdDate.toISOString() : null,
            expiresDate: enrichment?.expiresDate ? enrichment.expiresDate.toISOString() : null,
            registrar: enrichment?.registrar ?? null,
            status: enrichment?.status ?? null,
            nameservers: enrichment?.nameservers ?? [],
        }
    })
    fs.writeFileSync(rawDomainListPath, `${normalizedDomains.join('\n')}\n`, 'utf-8')
    fs.writeFileSync(domainProvenancePath, JSON.stringify(domainProvenanceList, null, 2), 'utf-8')
    fs.writeFileSync(apexDomainListPath, JSON.stringify(apexDomainList, null, 2), 'utf-8')
    const enrichmentByDomainForVt = new Map(
        enrichments.map((row) => [row.domain, row]),
    )
    const topDomainSignals = (
        await vtSignalsForYoungestDomains(apexDomainsForEnrichment, enrichmentByDomainForVt)
    ).map((signal) => ({
        ...signal,
        topDomainSignalId: `${analysisId}:${signal.domain}`,
    }))
    await applyVtToStaticDomains(analysisId, topDomainSignals)
    const riskLevel = riskLevelFromVtSignals(topDomainSignals)
    const hasMaliciousDomain = riskLevel === 'HIGH'
    await prisma.extensionAnalysisResult.update({
        where: { id: analysisId },
        data: {
            status: 'COMPLETED',
            domains: allUniqueApexDomains,
            ips: Array.from(results.ips).slice(0, 200),
            urls: Array.from(results.urls).slice(0, 200),
            filesScanned: results.fileCount,
            updatedAt: new Date()
        }
    });
    await prisma.globalExtension.update({
        where: { id: dbId },
        data: {
            riskLevel,
        },
    });
    {
        const ext = await prisma.globalExtension.findUnique({
            where: { id: dbId },
            select: { name: true, storeId: true, version: true },
        })
        const maliciousDomainsList = topDomainSignals
            .filter((d) => d.isMalicious)
            .map((d) => d.domain)
        const summary = `Analysis completed with risk level: ${riskLevel}.`
        triggerMaliciousAlertNotifications(
            extensionId,
            ext?.name || extensionId,
            riskLevel,
            summary,
            maliciousDomainsList,
        ).catch((e) => console.error('[analysis] Failed to trigger notifications:', e))
    }
    setAnalyzeProgressStage(extensionId, 'COMPLETED', 100, 'Analysis completed')
    logInfo('[analysis] runLookupFromSource:completed', {
        extensionId,
        analysisId,
        filesScanned: results.fileCount,
        elapsedMs: Date.now() - startedAt,
        riskLevel,
        rawDomainListPath,
        apexDomainListPath,
        domainProvenancePath,
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
    const bucketRoot = getExtensionAnalyzerRoot();
    const pendingDir = buildPendingDir(bucketRoot, extensionId);
    const pendingSourceDir = path.join(pendingDir, 'source');
    try {
        const ext = await prisma.globalExtension.findUnique({
            where: { id: dbId },
            select: { version: true },
        })
        const reusableSourceDir = resolveReusableAnalyzerSourceDir(extensionId, ext?.version)
        if (reusableSourceDir) {
            setAnalyzeProgressStage(extensionId, 'ANALYZING', 75, 'Running lookup analysis')
            logInfo('[analysis] runLookupForExtension:reusedExtractedSource', {
                extensionId,
                sourceDir: reusableSourceDir,
                version: ext?.version ?? null,
                analysisId: analysis.id,
            })
            await runLookupFromSource(dbId, extensionId, analysis.id, reusableSourceDir)
        } else {
            setAnalyzeProgressStage(extensionId, 'DOWNLOADING', 1, 'Downloading package')
            const pendingCrxPath = await downloadExtension(extensionId, pendingDir);
            logInfo('[analysis] runLookupForExtension:downloaded', { extensionId, crxPath: pendingCrxPath, analysisId: analysis.id })
            await extractExtension(pendingCrxPath, pendingSourceDir);
            setAnalyzeProgressStage(extensionId, 'ANALYZING', 75, 'Running lookup analysis')
            const manifestPath = findManifestPath(pendingSourceDir)
            const manifest = manifestPath
                ? (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>)
                : null
            const version = manifest && typeof manifest.version === 'string' ? manifest.version : null
            const promoted = promoteToVersionedLayout({
                bucketRoot,
                extensionId,
                version,
                pendingCrxPath,
                pendingSourceDir,
            })
            logInfo('[analysis] runLookupForExtension:extracted', {
                extensionId,
                sourceDir: promoted.sourceDir,
                crxPath: promoted.crxPath,
                version: promoted.versionSegment,
                analysisId: analysis.id,
            })
            await runLookupFromSource(dbId, extensionId, analysis.id, promoted.sourceDir)
        }
    } catch (e) {
        setAnalyzeProgressStage(extensionId, 'FAILED', 100, 'Analysis failed')
        await prisma.extensionAnalysisResult.update({
            where: { id: analysis.id },
            data: {
                status: 'FAILED',
                updatedAt: new Date(),
            },
        })
        throw e
    } finally {
        if (fs.existsSync(pendingDir)) {
            try { fs.rmSync(pendingDir, { recursive: true, force: true }); } catch {}
        }
    }
}

type DbClient = PrismaClient | Prisma.TransactionClient

export async function enqueueExtensionLookupJob(dbId: string, db: DbClient = prisma) {
    const existing = await db.scanJob.findFirst({
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
    const hasInFlightAnalysis = await db.extensionAnalysisResult.findFirst({
        where: {
            extensionId: dbId,
            status: { in: ['PENDING', 'RUNNING'] },
        },
        select: { id: true },
    })
    if (!hasInFlightAnalysis) {
        await db.extensionAnalysisResult.create({
            data: {
                extensionId: dbId,
                status: 'PENDING',
            },
        })
    }
    const job = await db.scanJob.create({
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
    let activeJobId: string | null = null
    let activeStartedAt = Date.now()
    try {
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
        activeJobId = pending.id
        activeStartedAt = Date.now()
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
                durationMs: Date.now() - activeStartedAt,
            },
        })
        return { processed: true as const, id: pending.id, status: 'COMPLETED' as const }
    } catch (e) {
        if (isDatabaseUnavailableError(e)) {
            const now = Date.now()
            if (now - lastDbUnavailableLookupLogAt > 30000) {
                lastDbUnavailableLookupLogAt = now
                logInfo('[analysis] lookup tick skipped: database unavailable')
            }
            return { processed: false as const }
        }
        if (activeJobId) {
            try {
                await prisma.scanJob.update({
                    where: { id: activeJobId },
                    data: {
                        status: 'FAILED',
                        durationMs: Date.now() - activeStartedAt,
                    },
                })
            } catch {}
        }
        logError('[analysis] processPendingLookupJob:failed', { error: e })
        return activeJobId
            ? { processed: true as const, id: activeJobId, status: 'FAILED' as const }
            : { processed: false as const }
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
            logError('[analysis] lookup tick failed', e)
        } finally {
            running = false
        }
    }
    tick()
    return setInterval(tick, periodMs)
}

export async function processExtension(extensionId: string, downloadUrl?: string) {
    const bucketRoot = getExtensionAnalyzerRoot();
    const pendingDir = buildPendingDir(bucketRoot, extensionId);
    const pendingSourceDir = path.join(pendingDir, 'source');
    const startedAt = Date.now()

    if (downloadUrl && !isAllowedPackageDownloadUrl(downloadUrl)) {
        throw new Error('Download URL must be from Chrome update endpoints or cdn.oarmour.com')
    }

    try {
        logInfo('[analysis] processExtension:start', { extensionId, pendingDir })
        setAnalyzeProgressStage(extensionId, 'DOWNLOADING', 1, 'Downloading package')
        const pendingCrxPath = await downloadExtension(extensionId, pendingDir, downloadUrl);
        logInfo('[analysis] processExtension:downloaded', { extensionId, crxPath: pendingCrxPath })
        setAnalyzeProgressStage(extensionId, 'EXTRACTING', 70, 'Extracting package')
        await extractExtension(pendingCrxPath, pendingSourceDir);
        const pendingManifestPath = findManifestPath(pendingSourceDir);
        if (!pendingManifestPath) {
             throw new Error('Manifest file not found');
        }
        const pendingManifest = JSON.parse(fs.readFileSync(pendingManifestPath, 'utf-8')) as Record<string, unknown>;
        const pendingVersion = typeof pendingManifest.version === 'string' ? pendingManifest.version : null
        const promoted = promoteToVersionedLayout({
            bucketRoot,
            extensionId,
            version: pendingVersion,
            pendingCrxPath,
            pendingSourceDir,
        })
        logInfo('[analysis] processExtension:extracted', {
            extensionId,
            sourceDir: promoted.sourceDir,
            crxPath: promoted.crxPath,
            version: promoted.versionSegment,
        })
        const manifestPath = findManifestPath(promoted.sourceDir);
        if (!manifestPath) {
             throw new Error('Manifest file not found');
        }
        const extensionRootDir = path.dirname(manifestPath)
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
        logInfo('[analysis] processExtension:manifestLoaded', { extensionId, manifestPath, versionDir: promoted.versionDir })
        const publisher = getPublisher(manifest)

        const resolvedName = resolveLocalizedString(manifest.name, extensionRootDir, manifest);
        const version = typeof manifest.version === 'string' ? manifest.version : null
        const manifestPermissions = extractManifestPermissions(manifest)
        const manifestIconAssets = extractManifestIconAssets(manifest, extensionRootDir)
        const existingPackageSource = await prisma.globalExtension.findUnique({
            where: { storeId: extensionId },
            select: { packageDownloadPrefix: true },
        })
        const derivedPackageSource = downloadUrl
            ? derivePackageDownloadPrefixFromUrl(downloadUrl, extensionId)
            : null
        const firstPackageSource =
            !existingPackageSource?.packageDownloadPrefix && derivedPackageSource
                ? {
                      packageDownloadPrefix: derivedPackageSource.prefix,
                      packageDownloadSuffix: derivedPackageSource.suffix,
                  }
                : {}
        const extension = await prisma.globalExtension.upsert({
            where: { storeId: extensionId },
            update: {
                name: resolvedName || extensionId,
                version,
                description: resolveLocalizedString(manifest.description, extensionRootDir, manifest),
                publisher: publisher || null,
                updatedAt: new Date(),
                ...firstPackageSource,
            },
            create: {
                storeId: extensionId,
                name: resolvedName || extensionId,
                version,
                description: resolveLocalizedString(manifest.description, extensionRootDir, manifest),
                publisher: publisher || null,
                platform: 'CHROME',
                ...firstPackageSource,
            }
        });
        logInfo('[analysis] processExtension:upserted', {
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
        logInfo('[analysis] processExtension:snapshotStored', {
            extensionId,
            dbId: extension.id,
            requestedPermissions: manifestPermissions.allRequestedPermissions.length,
            hasPackagedIcon: manifestIconAssets.hasPackagedIcon,
        })
        const queueJob = await enqueueExtensionLookupJob(extension.id)
        setAnalyzeProgressStage(extensionId, 'QUEUED', 75, 'Queued for analysis')
        logInfo('[analysis] processExtension:lookupEnqueued', {
            extensionId,
            dbId: extension.id,
            queueJob,
        })

        return extension;
    } catch (error) {
        setAnalyzeProgressStage(extensionId, 'FAILED', 100, 'Processing failed')
        logError('[analysis] processExtension:failed', { extensionId, error })
        throw error;
    } finally {
        if (fs.existsSync(pendingDir)) {
            try { fs.rmSync(pendingDir, { recursive: true, force: true }); } catch {}
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
        logError('Async analysis failed:', e)
        logError('[analysis] triggerAsyncAnalysis:failed', { extensionId, dbId, error: e })
    }
}
