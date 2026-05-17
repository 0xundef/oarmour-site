DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GlobalExtension' AND column_name = 'aiTestingEnabled') THEN
    ALTER TABLE "GlobalExtension" ADD COLUMN "aiTestingEnabled" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;