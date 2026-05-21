-- CreateTable
CREATE TABLE "IssueInvestigationShare" (
    "id" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "issueSnapshot" JSONB NOT NULL,
    "messages" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueInvestigationShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssueInvestigationShare_shareToken_key" ON "IssueInvestigationShare"("shareToken");

-- CreateIndex
CREATE INDEX "IssueInvestigationShare_createdByUserId_createdAt_idx" ON "IssueInvestigationShare"("createdByUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "IssueInvestigationShare" ADD CONSTRAINT "IssueInvestigationShare_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
