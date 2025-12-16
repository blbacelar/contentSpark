ALTER TABLE teams ADD COLUMN IF NOT EXISTS invitation_code TEXT;
CREATE INDEX IF NOT EXISTS teams_invitation_code_idx ON teams(invitation_code);

-- Populate existing teams with a random code
UPDATE teams 
SET invitation_code = substr(md5(random()::text), 0, 12) 
WHERE invitation_code IS NULL;
