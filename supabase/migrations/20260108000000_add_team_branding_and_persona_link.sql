-- Add Branding to Teams
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb;

-- Add team_id to Personas
ALTER TABLE personas
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_personas_team_id ON personas(team_id);

-- Update RLS for Personas to allow Team access
-- (Assuming existing RLS was user-centric, we need to allow team members to view)

-- Drop existing generic policy if it conflicts or append new one
-- Let's add a policy: "Team members can view team personas"
CREATE POLICY "Team members can view team personas" ON personas
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Team members can create team personas" ON personas
    FOR INSERT WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Team members can update team personas" ON personas
    FOR UPDATE USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Team members can delete team personas" ON personas
    FOR DELETE USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );
