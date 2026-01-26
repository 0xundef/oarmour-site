import axios from 'axios';
import fs from 'fs';
import path from 'path';

export async function downloadExtension(extensionId: string, outputDir: string): Promise<string> {
  const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.0.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;
  const filePath = path.join(outputDir, `${extensionId}.crx`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const writer = fs.createWriteStream(filePath);

  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(filePath));
      writer.on('error', reject);
    });
  } catch (error) {
    writer.close();
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    throw new Error(`Failed to download extension: ${error instanceof Error ? error.message : String(error)}`);
  }
}
