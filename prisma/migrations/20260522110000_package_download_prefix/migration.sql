-- Replace testingMode with persisted first-download package URL prefix (CDN versioned packages).
ALTER TABLE "GlobalExtension" ADD COLUMN IF NOT EXISTS "packageDownloadPrefix" TEXT;
ALTER TABLE "GlobalExtension" ADD COLUMN IF NOT EXISTS "packageDownloadSuffix" TEXT;

UPDATE "GlobalExtension"
SET
  "packageDownloadPrefix" = 'https://cdn.oarmour.com/' || "storeId" || '/',
  "packageDownloadSuffix" = COALESCE("packageDownloadSuffix", '.zip')
WHERE COALESCE("testingMode", false) = true
  AND "packageDownloadPrefix" IS NULL;

ALTER TABLE "GlobalExtension" DROP COLUMN IF EXISTS "testingMode";
