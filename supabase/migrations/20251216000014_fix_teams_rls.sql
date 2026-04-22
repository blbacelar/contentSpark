-- Fix RLS policy to allow owners to see their teams immediately after creation
-- (Before they are added to team_members)

DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;

CREATE POLICY "Users can view teams they are members of" ON teams
    FOR SELECT USING (
        auth.uid() IN (SELECT user_id FROM team_members WHERE team_id = id)
        OR 
        owner_id = auth.uid()
    );
