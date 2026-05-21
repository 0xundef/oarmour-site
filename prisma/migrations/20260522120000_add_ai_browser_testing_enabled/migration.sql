ALTER TABLE "GlobalExtension" ADD COLUMN IF NOT EXISTS "aiBrowserTestingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Preserve prior behavior: monitored extensions previously always queued AI browser tests.
UPDATE "GlobalExtension"
SET "aiBrowserTestingEnabled" = true
WHERE "isMonitored" = true;
