import fs from 'fs';
import path from 'path';
import { getDomain } from 'tldts';

const URL_REGEX = /(https?:\/\/[^\s/$.?#].[^\s"'`]*)/gi;

export interface ScanResult {
    urls: Set<string>;
    ips: Set<string>;
    domains: Set<string>;
    fileCount: number;
}

export function scanDirectory(dir: string): ScanResult {
    const results: ScanResult = {
        urls: new Set<string>(),
        ips: new Set<string>(),
        domains: new Set<string>(),
        fileCount: 0
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
                    // Only scan text-like files to avoid binaries
                    if (/\.(js|json)$/i.test(file)) {
                        results.fileCount++;
                        // Read file with limit to avoid OOM on huge minified files, but usually extensions are manageable.
                        // For safety, let's read as utf-8.
                        const content = fs.readFileSync(filePath, 'utf-8');
                        
                        const urls = content.match(URL_REGEX);
                        if (urls) {
                            urls.forEach(u => {
                                results.urls.add(u);
                                const apex = getDomain(u);
                                if (apex) {
                                    results.domains.add(apex);
                                }
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
    return results;
}
