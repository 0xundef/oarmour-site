import path from 'path';
import fs from 'fs';
import { downloadExtension } from './downloader';
import { extractExtension } from './extractor';
import { scanDirectory } from './scanner';
import { buildApexDomainProvenanceList } from '@/lib/domain-provenance';
import { AnalysisResult, AnalyzerOptions } from './types';
import { getExtensionAnalyzerRoot } from '@/lib/extension-storage';
import { logError, logInfo } from '@/lib/app-logger';

export class ExtensionAnalyzer {
    private options: AnalyzerOptions;

    constructor(options: AnalyzerOptions = {}) {
        this.options = {
            workDir: options.workDir || getExtensionAnalyzerRoot(),
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
            logInfo(`[analysis] downloading extension ${extensionId}`);
            const crxPath = await downloadExtension(extensionId, crxDir);

            // 2. Extract
            logInfo(`[analysis] extracting extension ${extensionId}`, { sourceDir });
            await extractExtension(crxPath, sourceDir);

            // 3. Scan
            logInfo(`[analysis] scanning extension ${extensionId}`);
            const scanResults = scanDirectory(sourceDir);

            const result: AnalysisResult = {
                extensionId,
                domains: Array.from(scanResults.domains),
                ips: Array.from(scanResults.ips),
                urls: Array.from(scanResults.urls),
                filesScanned: scanResults.fileCount,
                domainProvenance: buildApexDomainProvenanceList(scanResults.domainProvenance),
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
                    logError('[analysis] failed to cleanup temp directory', { extensionId, error: e });
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
