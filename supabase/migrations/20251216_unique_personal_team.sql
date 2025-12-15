-- Create a unique partial index to ensure a user has only one "Personal Team"
-- This prevents race conditions where multiple personal teams could be created
CREATE UNIQUE INDEX IF NOT EXISTS unique_personal_team_per_user 
ON teams (owner_id) 
WHERE name = 'Personal Team';
