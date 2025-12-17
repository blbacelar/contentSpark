ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branding jsonb DEFAULT '{}'::jsonb;
