-- 1. FIX THE "INVISIBLE TEAMS" BUG (RLS Recursion)
-- Checks membership without causing an infinite loop.

CREATE OR REPLACE FUNCTION get_my_team_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT team_id FROM team_members WHERE user_id = auth.uid();
$$;

-- Fix 'teams' Policy
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;

CREATE POLICY "Users can view teams they are members of" ON teams
    FOR SELECT USING (
        id IN (SELECT get_my_team_ids())
        OR 
        owner_id = auth.uid()
    );

-- Fix 'team_members' Policy
DROP POLICY IF EXISTS "Users can view members of their teams" ON team_members;

CREATE POLICY "Users can view members of their teams" ON team_members
    FOR SELECT USING (
        team_id IN (SELECT get_my_team_ids())
    );

-- 2. FIX THE "DATA MESS" (Orphaned Ideas)
-- User request: "ideas that don't have a user ID you can assign any user id"
-- Assigning to User: 5610e481-186e-4ec1-89aa-775c5214bdfc (Bruno)

UPDATE content_ideas
SET user_id = '5610e481-186e-4ec1-89aa-775c5214bdfc'
WHERE user_id IS NULL;

-- Optional: Ensure all Bruno's ideas belong to his Marketing team if they have no team?
-- Commenting this out to preserve "Personal" ideas (which have NULL team_id).
-- UPDATE content_ideas
-- SET team_id = '6040bf8d-cc99-40f1-8f08-1ca17ae6dc3d'
-- WHERE team_id IS NULL AND user_id = '5610e481-186e-4ec1-89aa-775c5214bdfc';
