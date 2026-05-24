-- CreateEnum
CREATE TYPE "BrowserAgentTaskStatus" AS ENUM ('QUEUED', 'DISPATCHED', 'RUNNING', 'COMPLETE', 'ERROR', 'CANCELLED');

-- CreateTable
CREATE TABLE "BrowserAgentTask" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "extensionName" TEXT,
    "reason" TEXT NOT NULL,
    "status" "BrowserAgentTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserAgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrowserAgentTask_sessionId_key" ON "BrowserAgentTask"("sessionId");

-- CreateIndex
CREATE INDEX "BrowserAgentTask_status_createdAt_idx" ON "BrowserAgentTask"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BrowserAgentTask_storeId_version_idx" ON "BrowserAgentTask"("storeId", "version");
