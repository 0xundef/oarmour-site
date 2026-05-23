-- CreateTable
CREATE TABLE "ExtensionPublisherVersion" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "extensionName" TEXT,
    "version" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionPublisherVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionPublisherVersion_storeId_version_key" ON "ExtensionPublisherVersion"("storeId", "version");

-- CreateIndex
CREATE INDEX "ExtensionPublisherVersion_storeId_publishedAt_idx" ON "ExtensionPublisherVersion"("storeId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "ExtensionPublisherVersion_extensionId_publishedAt_idx" ON "ExtensionPublisherVersion"("extensionId", "publishedAt" DESC);
