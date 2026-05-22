-- AlterTable
ALTER TABLE "GlobalExtension" ADD COLUMN "pendingVersion" TEXT;

-- Backfill: version ahead of COMPLETED static becomes pendingVersion
UPDATE "GlobalExtension" ge
SET "pendingVersion" = TRIM(ge."version")
WHERE ge."version" IS NOT NULL
  AND TRIM(ge."version") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "ExtensionAnalysisResult" ear
    WHERE ear."extensionId" = ge."id"
      AND ear."status" = 'COMPLETED'
      AND ear."version" = TRIM(ge."version")
  );

-- Point version at latest COMPLETED static analysis per extension
UPDATE "GlobalExtension" ge
SET "version" = sub."version"
FROM (
  SELECT DISTINCT ON (ear."extensionId")
    ear."extensionId",
    TRIM(ear."version") AS "version"
  FROM "ExtensionAnalysisResult" ear
  WHERE ear."status" = 'COMPLETED'
    AND ear."version" IS NOT NULL
    AND TRIM(ear."version") <> ''
  ORDER BY ear."extensionId", ear."updatedAt" DESC
) sub
WHERE ge."id" = sub."extensionId";

-- Extensions with no COMPLETED static: clear version (pending may still hold target)
UPDATE "GlobalExtension" ge
SET "version" = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM "ExtensionAnalysisResult" ear
  WHERE ear."extensionId" = ge."id"
    AND ear."status" = 'COMPLETED'
);
