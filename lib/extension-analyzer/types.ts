export interface AnalysisResult {
  extensionId: string;
  domains: string[];
  ips: string[];
  urls: string[];
  filesScanned: number;
}

export interface AnalyzerOptions {
  workDir?: string; // Temporary directory for download/extraction
  cleanup?: boolean; // Whether to remove temp files after analysis
}
