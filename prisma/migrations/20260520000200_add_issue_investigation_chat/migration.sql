-- CreateTable
CREATE TABLE "IssueInvestigationChat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueInvestigationChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssueInvestigationChat_userId_storeId_issueId_key" ON "IssueInvestigationChat"("userId", "storeId", "issueId");

-- CreateIndex
CREATE INDEX "IssueInvestigationChat_userId_storeId_idx" ON "IssueInvestigationChat"("userId", "storeId");

-- AddForeignKey
ALTER TABLE "IssueInvestigationChat" ADD CONSTRAINT "IssueInvestigationChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
