-- Add income_level column to personas table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personas' AND column_name = 'income_level') THEN
        ALTER TABLE personas ADD COLUMN income_level text;
    END IF;
END $$;
