import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import { setAnalyzeDownloadProgress, setAnalyzeProgressStage } from '@/lib/analyze-progress';

const TESTING_DOWNLOAD_CACHE_ROOT = path.join(os.tmpdir(), 'chrome-extension-download-cache')

function getTestingModeCachePath(downloadUrl?: string): string | null {
  if (!downloadUrl) return null
  try {
    const parsed = new URL(downloadUrl)
    if (parsed.hostname.toLowerCase() !== 'cdn.oarmour.com') return null
    const key = createHash('sha256').update(parsed.toString()).digest('hex')
    const ext = path.extname(parsed.pathname).toLowerCase()
    const suffix = ext && ext.length <= 10 ? ext : '.bin'
    return path.join(TESTING_DOWNLOAD_CACHE_ROOT, `${key}${suffix}`)
  } catch {
    return null
  }
}

export async function downloadExtension(extensionId: string, outputDir: string, downloadUrl?: string): Promise<string> {
  const url = downloadUrl || `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.0.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;
  const filePath = path.join(outputDir, `${extensionId}.crx`);
  const testingCachePath = getTestingModeCachePath(downloadUrl)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.warn('[analysis] downloadExtension:start', { extensionId, url, filePath });
  setAnalyzeProgressStage(extensionId, 'DOWNLOADING', 1, 'Starting download')
  if (testingCachePath && fs.existsSync(testingCachePath)) {
    const stats = fs.statSync(testingCachePath)
    if (stats.size > 0) {
      fs.copyFileSync(testingCachePath, filePath)
      setAnalyzeDownloadProgress(extensionId, stats.size, stats.size)
      setAnalyzeProgressStage(extensionId, 'EXTRACTING', 65, 'Reused cached testing package, extracting')
      console.warn('[analysis] downloadExtension:cacheHit', { extensionId, url, filePath, testingCachePath, bytesWritten: stats.size })
      return filePath
    }
  }
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
        if (testingCachePath) {
          if (!fs.existsSync(TESTING_DOWNLOAD_CACHE_ROOT)) {
            fs.mkdirSync(TESTING_DOWNLOAD_CACHE_ROOT, { recursive: true })
          }
          fs.copyFileSync(filePath, testingCachePath)
          console.warn('[analysis] downloadExtension:cacheStored', { extensionId, url, testingCachePath, bytesWritten })
        }
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
