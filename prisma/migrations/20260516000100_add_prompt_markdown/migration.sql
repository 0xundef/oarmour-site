DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GlobalExtension' AND column_name = 'promptMarkdown') THEN
    ALTER TABLE "GlobalExtension" ADD COLUMN "promptMarkdown" TEXT;
  END IF;
END $$;