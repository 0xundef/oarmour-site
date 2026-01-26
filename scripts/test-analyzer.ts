import { analyzeExtension } from '../lib/extension-analyzer';
import path from 'path';

async function main() {
  const extensionId = 'egjidjbpglichdcondbcbdnbeeppgdph';
  const workDir = path.join(process.cwd(), 'temp_analysis');
  
  console.log(`Starting analysis for ${extensionId}...`);
  console.log(`Work Dir: ${workDir}`);
  
  try {
    const result = await analyzeExtension(extensionId, { 
        workDir, 
        cleanup: false 
    }); 
    
    console.log('Analysis Complete!');
    console.log(`Files Scanned: ${result.filesScanned}`);
    console.log(`Domains Found: ${result.domains.length}`);
    console.log(`IPs Found: ${result.ips.length}`);
    
    console.log('\n--- Sample Domains ---');
    console.log(result.domains.slice(0, 20).join('\n'));

    console.log('\n--- Sample IPs ---');
    console.log(result.ips.slice(0, 20).join('\n'));
    
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

main();
