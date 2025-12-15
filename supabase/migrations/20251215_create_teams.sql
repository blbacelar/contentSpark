-- Create Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

-- Add team_id to content_ideas
ALTER TABLE content_ideas 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_content_ideas_team_id ON content_ideas(team_id);

-- RLS Policies

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Teams Policies
-- Users can see teams they are members of
CREATE POLICY "Users can view teams they are members of" ON teams
    FOR SELECT USING (
        auth.uid() IN (SELECT user_id FROM team_members WHERE team_id = id)
    );

-- Owners can update their teams
CREATE POLICY "Owners can update their teams" ON teams
    FOR UPDATE USING (
        auth.uid() = owner_id
    );

-- Owners can delete their teams
CREATE POLICY "Owners can delete their teams" ON teams
    FOR DELETE USING (
        auth.uid() = owner_id
    );

-- Authenticated users can create teams
CREATE POLICY "Authenticated users can create teams" ON teams
    FOR INSERT WITH CHECK (
        auth.uid() = owner_id
    );

-- Team Members Policies
-- Users can view members of their teams
CREATE POLICY "Users can view members of their teams" ON team_members
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- Owners/Admins can add members (Implementation details may vary, simplifying for now)
-- Allow anyone to add themselves if they are invited? Or just Owners adding?
-- Going with: Owners/Admins can manage members.
-- For simplicity in this iteration: Owners can do everything on their team members.

CREATE POLICY "Owners can manage team members" ON team_members
    FOR ALL USING (
        auth.uid() IN (
            SELECT owner_id FROM teams WHERE id = team_id
        )
    );

-- Important: When creating a team, the creator needs to be inserted into team_members.
-- The trigger approach is best, but for now we might handle it in the application layer or a function.
-- Let's make sure the creator can insert themselves into team_members:
CREATE POLICY "Creators can join their own teams" ON team_members
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        team_id IN (
            SELECT id FROM teams WHERE owner_id = auth.uid()
        )
    );

-- Content Ideas RLS Updates
-- Users can view ideas if they are in the team
CREATE POLICY "Users can view team ideas" ON content_ideas
    FOR SELECT USING (
        team_id IS NOT NULL AND
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- Users can insert ideas into teams they belong to
CREATE POLICY "Users can insert team ideas" ON content_ideas
    FOR INSERT WITH CHECK (
        team_id IS NOT NULL AND
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );
