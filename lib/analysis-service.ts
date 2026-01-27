import { prisma } from '@/lib/prisma';
import { downloadExtension, extractExtension } from '@/lib/extension-analyzer';
import path from 'path';
import fs from 'fs';
import os from 'os';

const resolveLocalizedString = (value: unknown, baseDir: string, manifestObj: any): string => {
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

export async function processExtension(extensionId: string) {
    const tempDir = path.join(os.tmpdir(), 'chrome-extension-analyzer', extensionId);
    const crxDir = path.join(tempDir, 'crx');
    const sourceDir = path.join(tempDir, 'source');

    try {
        // 1. Download
        const crxPath = await downloadExtension(extensionId, crxDir);
        
        // 2. Extract
        await extractExtension(crxPath, sourceDir);
        
        // 3. Read Manifest
        const manifestPath = path.join(sourceDir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
             throw new Error('Manifest file not found');
        }
        
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        
        let publisher = '';
        if (typeof manifest.author === 'string') {
            publisher = manifest.author;
        } else if (typeof manifest.author === 'object' && manifest.author?.name) {
            publisher = manifest.author.name;
        } else if (manifest.developer && manifest.developer.name) {
             publisher = manifest.developer.name;
        }

        const resolvedName = resolveLocalizedString(manifest.name, sourceDir, manifest);
        
        // 4. Upsert Extension
        const extension = await prisma.globalExtension.upsert({
            where: { storeId: extensionId },
            update: {
                name: resolvedName || extensionId,
                version: manifest.version,
                description: resolveLocalizedString(manifest.description, sourceDir, manifest),
                publisher: publisher || null,
                updatedAt: new Date()
            },
            create: {
                storeId: extensionId,
                name: resolvedName || extensionId,
                version: manifest.version,
                description: resolveLocalizedString(manifest.description, sourceDir, manifest),
                publisher: publisher || null,
                platform: 'CHROME'
            }
        });

        // 5. Trigger Async Analysis
        // Fire and forget, but catch errors to avoid unhandled rejections
        triggerAsyncAnalysis(extension.id, extensionId, sourceDir).catch(e => console.error("Async analysis error:", e));

        return extension;
    } catch (error) {
        // Cleanup if error occurs before analysis starts
        if (fs.existsSync(tempDir)) {
             try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        }
        throw error;
    }
}

export async function triggerAsyncAnalysis(dbId: string, extensionId: string, sourceDir: string) {
    try {
        // Create initial analysis record
        const analysis = await prisma.extensionAnalysisResult.create({
            data: {
                extensionId: dbId,
                status: 'RUNNING',
            }
        });

        // Import scanner dynamically or use the one we have
        // lib/analysis-service.ts -> lib/extension-analyzer/scanner.ts
        const { scanDirectory } = await import('@/lib/extension-analyzer/scanner');
        
        const results = scanDirectory(sourceDir);

        // Update record with results
        await prisma.extensionAnalysisResult.update({
            where: { id: analysis.id },
            data: {
                status: 'COMPLETED',
                domains: Array.from(results.domains),
                ips: Array.from(results.ips),
                urls: Array.from(results.urls),
                filesScanned: results.fileCount
            }
        });
        
        // Cleanup temp files
        const tempExtensionDir = path.dirname(sourceDir); // .../extensionId
        if (fs.existsSync(tempExtensionDir)) {
            fs.rmSync(tempExtensionDir, { recursive: true, force: true });
        }

    } catch (e) {
        console.error('Async analysis failed:', e);
        // We might want to update the status to FAILED here if we had the ID
    }
}
