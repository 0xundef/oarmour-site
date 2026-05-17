-- CreateTable
CREATE TABLE "DomainEnrichment" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "registrar" TEXT,
    "status" TEXT,
    "nameservers" TEXT[],
    "createdDate" TIMESTAMP(3),
    "expiresDate" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEnrichment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DomainEnrichment" ADD CONSTRAINT "DomainEnrichment_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "ExtensionAnalysisResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;