import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadExtension, extractExtension } from '@/lib/extension-analyzer';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function POST(req: NextRequest) {
  try {
    const { extensionId } = await req.json();

    if (!extensionId) {
      return NextResponse.json({ error: 'Extension ID is required' }, { status: 400 });
    }

    // 1. Check if extension already exists in DB
    let extension = await prisma.globalExtension.findUnique({
      where: { storeId: extensionId },
    });

    // If it exists and has analysis, return it (cache)
    // But user wants to trigger analysis, so maybe we update it?
    // For now, let's assume we always re-check or create if missing.
    
    // Prepare temp directory
    const tempDir = path.join(os.tmpdir(), 'chrome-extension-analyzer', extensionId);
    const crxDir = path.join(tempDir, 'crx');
    const sourceDir = path.join(tempDir, 'source');

    // 2. Download and Extract (Synchronous part to get manifest)
    // We need manifest for name, version, etc.
    try {
        const crxPath = await downloadExtension(extensionId, crxDir);
        await extractExtension(crxPath, sourceDir);
        
        // Read Manifest
        const manifestPath = path.join(sourceDir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
             throw new Error('Manifest file not found');
        }
        
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

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
        
        // Try to get publisher/author
        // V2/V3 can have 'author' string or object, or 'developer' object in some contexts (though rare in raw manifest)
        let publisher = '';
        if (typeof manifest.author === 'string') {
            publisher = manifest.author;
        } else if (typeof manifest.author === 'object' && manifest.author?.name) {
            publisher = manifest.author.name;
        } else if (manifest.developer && manifest.developer.name) {
             publisher = manifest.developer.name;
        }

        // 3. Upsert Extension in DB with basic info
        const resolvedName = resolveLocalizedString(manifest.name, sourceDir, manifest);
        extension = await prisma.globalExtension.upsert({
            where: { storeId: extensionId },
            update: {
                name: resolvedName || extensionId,
                version: manifest.version,
                description: resolveLocalizedString(manifest.description, sourceDir, manifest),
                publisher: publisher || null,
                // manifest icons are usually paths, hard to get full URL without hosting. 
                // We'll skip iconUrl for now or use a placeholder if needed.
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

        // 4. Trigger Async Analysis
        // We don't await this, so the API returns quickly
        triggerAsyncAnalysis(extension.id, extensionId, sourceDir);

        return NextResponse.json({ 
            success: true, 
            data: extension,
            message: 'Extension processing started' 
        });

    } catch (e) {
        console.error('Processing failed:', e);
        return NextResponse.json({ 
            error: 'Failed to process extension',
            details: e instanceof Error ? e.message : String(e)
        }, { status: 500 });
    }
  } catch (error) {
    console.error('Outer handler error:', error);
    return NextResponse.json({ 
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function triggerAsyncAnalysis(dbId: string, extensionId: string, sourceDir: string) {
    try {
        // Create initial analysis record
        const analysis = await prisma.extensionAnalysisResult.create({
            data: {
                extensionId: dbId,
                status: 'RUNNING',
            }
        });

        // Import scanner dynamically or use the one we have
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
        const tempDir = path.join(os.tmpdir(), 'chrome-extension-analyzer', extensionId);
         if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

    } catch (e) {
        console.error('Async analysis failed:', e);
        // We might want to update the status to FAILED here if we had the ID
    }
}
