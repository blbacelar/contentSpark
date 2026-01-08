-- Add description column to personas table
ALTER TABLE personas ADD COLUMN IF NOT EXISTS description TEXT;
