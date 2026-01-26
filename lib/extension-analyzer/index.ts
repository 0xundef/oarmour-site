import path from 'path';
import fs from 'fs';
import os from 'os';
import { downloadExtension } from './downloader';
import { extractExtension } from './extractor';
import { scanDirectory } from './scanner';
import { AnalysisResult, AnalyzerOptions } from './types';

export class ExtensionAnalyzer {
    private options: AnalyzerOptions;

    constructor(options: AnalyzerOptions = {}) {
        this.options = {
            workDir: options.workDir || path.join(os.tmpdir(), 'chrome-extension-analyzer'),
            cleanup: options.cleanup ?? true,
        };
    }

    async analyze(extensionId: string): Promise<AnalysisResult> {
        const tempDir = path.join(this.options.workDir!, extensionId);
        const crxDir = path.join(tempDir, 'crx');
        const sourceDir = path.join(tempDir, 'source');

        // Clean previous runs if any
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        try {
            // 1. Download
            console.log(`Downloading extension ${extensionId}...`);
            const crxPath = await downloadExtension(extensionId, crxDir);

            // 2. Extract
            console.log(`Extracting to ${sourceDir}...`);
            await extractExtension(crxPath, sourceDir);

            // 3. Scan
            console.log(`Scanning files...`);
            const scanResults = scanDirectory(sourceDir);

            const result: AnalysisResult = {
                extensionId,
                domains: Array.from(scanResults.domains),
                ips: Array.from(scanResults.ips),
                urls: Array.from(scanResults.urls),
                filesScanned: scanResults.fileCount
            };

            return result;

        } catch (error) {
            throw error;
        } finally {
            // Cleanup
            if (this.options.cleanup) {
                try {
                    if (fs.existsSync(tempDir)) {
                        fs.rmSync(tempDir, { recursive: true, force: true });
                    }
                } catch (e) {
                    console.error('Failed to cleanup temp directory:', e);
                }
            }
        }
    }
}

// Standalone function export for ease of use
export async function analyzeExtension(extensionId: string, options?: AnalyzerOptions): Promise<AnalysisResult> {
    const analyzer = new ExtensionAnalyzer(options);
    return analyzer.analyze(extensionId);
}

export * from './types';
export * from './downloader';
export * from './extractor';
