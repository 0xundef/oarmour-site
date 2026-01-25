-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('CHROME', 'FIREFOX', 'EDGE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('UNKNOWN', 'SAFE', 'CAUTION', 'HIGH');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('EXTENSION', 'WEB_PAGE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ThreatSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ThreatType" AS ENUM ('CODE_INJECTION', 'VERSION_ROLLBACK', 'PERMISSION_ESCALATION', 'MALICIOUS_DOMAIN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IocType" AS ENUM ('DOMAIN', 'IP', 'FILE_HASH_SHA256', 'URL_REGEX');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "label" TEXT,
    "permissions" JSONB,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalExtension" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'CHROME',
    "developerEmail" TEXT,
    "officialWebsite" TEXT,
    "checkFrequencyMinutes" INTEGER NOT NULL DEFAULT 30,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalWebPage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "checkFrequencyMinutes" INTEGER NOT NULL DEFAULT 15,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalWebPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "notifyViaEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyViaWebhook" BOOLEAN NOT NULL DEFAULT false,
    "webhookUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extensionId" TEXT,
    "webPageId" TEXT,

    CONSTRAINT "AssetSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetSnapshot" (
    "id" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "version" TEXT,
    "contentHash" TEXT,
    "metadata" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,

    CONSTRAINT "ScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatEvent" (
    "id" TEXT NOT NULL,
    "scanJobId" TEXT,
    "severity" "ThreatSeverity" NOT NULL,
    "type" "ThreatType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreatEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorOfCompromise" (
    "id" TEXT NOT NULL,
    "threatEventId" TEXT,
    "iocType" "IocType" NOT NULL,
    "iocValue" TEXT NOT NULL,
    "confidenceScore" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicatorOfCompromise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalExtension_storeId_key" ON "GlobalExtension"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalWebPage_url_key" ON "GlobalWebPage"("url");

-- CreateIndex
CREATE UNIQUE INDEX "AssetSubscription_userId_targetType_targetId_key" ON "AssetSubscription"("userId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSubscription" ADD CONSTRAINT "AssetSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSubscription" ADD CONSTRAINT "AssetSubscription_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "GlobalExtension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSubscription" ADD CONSTRAINT "AssetSubscription_webPageId_fkey" FOREIGN KEY ("webPageId") REFERENCES "GlobalWebPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatEvent" ADD CONSTRAINT "ThreatEvent_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "ScanJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorOfCompromise" ADD CONSTRAINT "IndicatorOfCompromise_threatEventId_fkey" FOREIGN KEY ("threatEventId") REFERENCES "ThreatEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
