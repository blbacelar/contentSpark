-- Fix Infinite Recursion in team_members RLS Policy

-- 1. Create a helper function to get user's teams securely
-- This avoids recursion because it is SECURITY DEFINER (runs with owner permissions)
-- and we will trust it to only return the current user's data.
CREATE OR REPLACE FUNCTION get_my_teams()
RETURNS TABLE (team_id UUID) 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid();
$$;

-- 2. Drop the problematic policy
DROP POLICY IF EXISTS "Users can view members of their teams" ON team_members;

-- 3. Re-create the policy using the helper function
-- Policies:
-- A. I can see a row if it is MY row (user_id = auth.uid()) [Optimization to avoid function call for self]
-- B. OR if the row belongs to a team I am in (using the function)
CREATE POLICY "Users can view members of their teams" ON team_members
    FOR SELECT USING (
        user_id = auth.uid() 
        OR
        team_id IN (SELECT * FROM get_my_teams())
    );
