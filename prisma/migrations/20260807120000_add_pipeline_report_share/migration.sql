-- CreateTable
CREATE TABLE "PipelineReportShare" (
    "id" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "extensionName" TEXT,
    "version" TEXT,
    "runId" TEXT NOT NULL,
    "reportMarkdown" TEXT NOT NULL,
    "reportJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "PipelineReportShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PipelineReportShare_shareToken_key" ON "PipelineReportShare"("shareToken");

-- CreateIndex
CREATE INDEX "PipelineReportShare_createdByUserId_createdAt_idx" ON "PipelineReportShare"("createdByUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PipelineReportShare_storeId_createdAt_idx" ON "PipelineReportShare"("storeId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PipelineReportShare" ADD CONSTRAINT "PipelineReportShare_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
