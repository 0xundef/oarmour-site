import AdmZip from 'adm-zip';
import fs from 'fs';

export async function extractExtension(crxPath: string, outputDir: string): Promise<string> {
    try {
        // Read the file buffer
        const buffer = fs.readFileSync(crxPath);
        
        // Find the start of the ZIP content (PK\x03\x04)
        // CRX files have a header before the actual ZIP data.
        const zipStart = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
        
        if (zipStart === -1) {
             // Try standard unzip if header not found (maybe it's already a raw zip or different format)
             const zip = new AdmZip(crxPath);
             zip.extractAllTo(outputDir, true);
             return outputDir;
        }

        const zipBuffer = buffer.subarray(zipStart);
        const zip = new AdmZip(zipBuffer);
        zip.extractAllTo(outputDir, true);
        
        return outputDir;
    } catch (e) {
        throw new Error(`Failed to extract extension: ${e instanceof Error ? e.message : String(e)}`);
    }
}
