import fs from 'fs';
import path from 'path';
import {
    createProvenanceStore,
    recordUrlOrHostObservation,
    type ProvenanceStore,
} from '@/lib/domain-provenance';

const URL_REGEX = /(https?:\/\/[^\s/$.?#].[^\s"'`]*)/gi;

export interface ScanResult {
    urls: Set<string>;
    ips: Set<string>;
    domains: Set<string>;
    fileCount: number;
    domainProvenance: ProvenanceStore;
}

export function scanDirectory(dir: string): ScanResult {
    const results: ScanResult = {
        urls: new Set<string>(),
        ips: new Set<string>(),
        domains: new Set<string>(),
        fileCount: 0,
        domainProvenance: createProvenanceStore(),
    };

    function traverse(currentDir: string) {
        if (!fs.existsSync(currentDir)) return;

        const files = fs.readdirSync(currentDir);

        for (const file of files) {
            const filePath = path.join(currentDir, file);

            try {
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    traverse(filePath);
                } else {
                    if (/\.(js|json)$/i.test(file)) {
                        results.fileCount++;
                        const relativePath = path.relative(dir, filePath).replace(/\\/g, '/');
                        const content = fs.readFileSync(filePath, 'utf-8');

                        const urls = content.match(URL_REGEX);
                        if (urls) {
                            urls.forEach((u) => {
                                results.urls.add(u);
                                recordUrlOrHostObservation({
                                    store: results.domainProvenance,
                                    input: u,
                                    sourceKind: 'extension_file',
                                    sourcePath: relativePath,
                                    requestUrl: u,
                                });
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn(`Skipping file ${filePath}: ${e}`);
            }
        }
    }

    traverse(dir);

    results.domains = new Set(results.domainProvenance.keys());
    return results;
}
