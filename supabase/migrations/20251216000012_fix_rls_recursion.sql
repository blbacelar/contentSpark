-- Fix Infinite Recursion in RLS policies
-- We use a SECURITY DEFINER function to fetch committee membership without triggering RLS recursion.

-- 1. Create Helper Function (Bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_team_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT team_id FROM team_members WHERE user_id = auth.uid();
$$;

-- 2. Fix 'teams' Policy
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;

CREATE POLICY "Users can view teams they are members of" ON teams
    FOR SELECT USING (
        id IN (SELECT get_my_team_ids())
        OR 
        owner_id = auth.uid()
    );

-- 3. Fix 'team_members' Policy
DROP POLICY IF EXISTS "Users can view members of their teams" ON team_members;

CREATE POLICY "Users can view members of their teams" ON team_members
    FOR SELECT USING (
        team_id IN (SELECT get_my_team_ids())
    );
