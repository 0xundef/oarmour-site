import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { setAnalyzeDownloadProgress, setAnalyzeProgressStage } from '@/lib/analyze-progress';

export async function downloadExtension(extensionId: string, outputDir: string, downloadUrl?: string): Promise<string> {
  const url = downloadUrl || `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.0.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;
  const filePath = path.join(outputDir, `${extensionId}.crx`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.warn('[analysis] downloadExtension:start', { extensionId, url, filePath });
  setAnalyzeProgressStage(extensionId, 'DOWNLOADING', 1, 'Starting download')
  const writer = fs.createWriteStream(filePath);

  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 120000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    console.warn('[analysis] downloadExtension:response', {
      extensionId,
      status: response.status,
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length'],
      filePath,
    });
    const contentLengthHeader = response.headers['content-length']
    const totalBytes =
      typeof contentLengthHeader === 'string' ? Number.parseInt(contentLengthHeader, 10) : null
    let bytesWritten = 0;
    response.data.on('data', (chunk: Buffer) => {
      bytesWritten += chunk.length;
      setAnalyzeDownloadProgress(extensionId, bytesWritten, Number.isFinite(totalBytes || NaN) ? totalBytes : null);
    });
    response.data.on('end', () => {
      console.warn('[analysis] downloadExtension:streamEnded', {
        extensionId,
        filePath,
        bytesWritten,
      });
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.warn('[analysis] downloadExtension:finished', { extensionId, filePath, bytesWritten });
        setAnalyzeProgressStage(extensionId, 'EXTRACTING', 65, 'Download complete, extracting package');
        resolve(filePath);
      });
      writer.on('error', reject);
    });
  } catch (error) {
    writer.close();
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    setAnalyzeProgressStage(extensionId, 'FAILED', 100, 'Download failed');
    console.error('[analysis] downloadExtension:failed', { extensionId, url, filePath, error });
    throw new Error(`Failed to download extension: ${error instanceof Error ? error.message : String(error)}`);
  }
}
