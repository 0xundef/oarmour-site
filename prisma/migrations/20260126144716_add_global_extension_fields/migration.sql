-- AlterTable
ALTER TABLE "GlobalExtension" ADD COLUMN     "description" TEXT,
ADD COLUMN     "iconUrl" TEXT,
ADD COLUMN     "version" TEXT;

-- CreateTable
CREATE TABLE "ExtensionAnalysisResult" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "domains" TEXT[],
    "ips" TEXT[],
    "urls" TEXT[],
    "filesScanned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionAnalysisResult_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExtensionAnalysisResult" ADD CONSTRAINT "ExtensionAnalysisResult_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "GlobalExtension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
