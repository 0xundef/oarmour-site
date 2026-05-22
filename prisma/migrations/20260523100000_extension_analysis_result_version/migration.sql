ALTER TABLE "ExtensionAnalysisResult" ADD COLUMN IF NOT EXISTS "version" TEXT;

UPDATE "ExtensionAnalysisResult" AS e
SET "version" = g."version"
FROM "GlobalExtension" AS g
WHERE e."extensionId" = g."id"
  AND e."status" = 'COMPLETED'
  AND g."version" IS NOT NULL
  AND (e."version" IS NULL OR e."version" = '');

CREATE INDEX IF NOT EXISTS "ExtensionAnalysisResult_extensionId_version_status_idx"
  ON "ExtensionAnalysisResult" ("extensionId", "version", "status");
