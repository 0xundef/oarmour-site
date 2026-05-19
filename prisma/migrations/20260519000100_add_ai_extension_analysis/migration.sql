-- CreateTable
CREATE TABLE "AiExtensionAnalysisResult" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "staticAnalysisId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "runtimeDomains" TEXT[],
    "novelDomains" TEXT[],
    "networkRequestCount" INTEGER,
    "networkCapturedAt" TIMESTAMP(3),
    "riskLevel" "RiskLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiExtensionAnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDomainEnrichment" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "isMalicious" BOOLEAN,
    "registrar" TEXT,
    "status" TEXT,
    "nameservers" TEXT[],
    "createdDate" TIMESTAMP(3),
    "expiresDate" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiDomainEnrichment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiExtensionAnalysisResult_staticAnalysisId_idx" ON "AiExtensionAnalysisResult"("staticAnalysisId");

-- CreateIndex
CREATE INDEX "AiExtensionAnalysisResult_storeId_version_idx" ON "AiExtensionAnalysisResult"("storeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AiExtensionAnalysisResult_extensionId_runId_key" ON "AiExtensionAnalysisResult"("extensionId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "AiDomainEnrichment_analysisId_domain_key" ON "AiDomainEnrichment"("analysisId", "domain");

-- AddForeignKey
ALTER TABLE "AiExtensionAnalysisResult" ADD CONSTRAINT "AiExtensionAnalysisResult_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "GlobalExtension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExtensionAnalysisResult" ADD CONSTRAINT "AiExtensionAnalysisResult_staticAnalysisId_fkey" FOREIGN KEY ("staticAnalysisId") REFERENCES "ExtensionAnalysisResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDomainEnrichment" ADD CONSTRAINT "AiDomainEnrichment_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AiExtensionAnalysisResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
