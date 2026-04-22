-- Create a secure function to find a team by invitation code
-- This bypasses RLS to allow new users to find the team before joining
CREATE OR REPLACE FUNCTION get_team_by_code(code text)
RETURNS SETOF teams
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM teams WHERE invitation_code = code LIMIT 1;
$$;
