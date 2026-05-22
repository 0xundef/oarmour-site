import fs from 'fs';
import path from 'path';
import {
    createProvenanceStore,
    recordUrlOrHostObservation,
    type ProvenanceStore,
} from '@/lib/domain-provenance';
import { logWarn } from '@/lib/app-logger';

const URL_REGEX = /(https?:\/\/[^\s/$.?#].[^\s"'`]*)/gi;

/** Whole-file read below this; larger files use chunked scan to limit peak RSS. */
const MAX_WHOLE_FILE_BYTES = 512_000;
const CHUNK_READ_SIZE = 256 * 1024;
/** Overlap so URLs split across chunk boundaries are still matched. */
const CHUNK_OVERLAP = 2048;

export interface ScanResult {
    urls: Set<string>;
    ips: Set<string>;
    domains: Set<string>;
    fileCount: number;
    domainProvenance: ProvenanceStore;
}

function recordUrlsFromMatches(
    matches: RegExpMatchArray | null,
    relativePath: string,
    results: ScanResult,
) {
    if (!matches) return;
    for (const u of matches) {
        results.urls.add(u);
        recordUrlOrHostObservation({
            store: results.domainProvenance,
            input: u,
            sourceKind: 'extension_file',
            sourcePath: relativePath,
            requestUrl: u,
        });
    }
}

function scanLargeFile(filePath: string, relativePath: string, results: ScanResult) {
    const stat = fs.statSync(filePath);
    const fd = fs.openSync(filePath, 'r');
    try {
        let prefix = '';
        for (let pos = 0; pos < stat.size; pos += CHUNK_READ_SIZE) {
            const readLen = Math.min(CHUNK_READ_SIZE, stat.size - pos);
            const buf = Buffer.alloc(readLen);
            fs.readSync(fd, buf, 0, readLen, pos);
            const chunk = buf.toString('utf-8');
            const window = prefix + chunk;
            recordUrlsFromMatches(window.match(URL_REGEX), relativePath, results);
            prefix = window.slice(-CHUNK_OVERLAP);
        }
    } finally {
        fs.closeSync(fd);
    }
}

function scanFile(filePath: string, relativePath: string, results: ScanResult) {
    results.fileCount++;
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_WHOLE_FILE_BYTES) {
        scanLargeFile(filePath, relativePath, results);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    recordUrlsFromMatches(content.match(URL_REGEX), relativePath, results);
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
                } else if (/\.(js|json)$/i.test(file)) {
                    const relativePath = path.relative(dir, filePath).replace(/\\/g, '/');
                    scanFile(filePath, relativePath, results);
                }
            } catch (e) {
                logWarn('[analysis] skipping file', { filePath, error: e });
            }
        }
    }

    traverse(dir);

    results.domains = new Set(results.domainProvenance.keys());
    return results;
}
