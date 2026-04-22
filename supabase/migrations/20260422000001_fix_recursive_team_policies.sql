-- Fix recursive RLS policies that can cause 42P17 on teams/team_members/content_ideas/personas queries.
-- Safe to run multiple times.

-- Ensure RLS is enabled where expected.
ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.personas ENABLE ROW LEVEL SECURITY;

-- Helper runs as definer to avoid recursive policy evaluation on team_members.
CREATE OR REPLACE FUNCTION public.get_my_team_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT tm.team_id
    FROM public.team_members tm
    WHERE tm.user_id = auth.uid();
$$;

-- Teams select policy
DROP POLICY IF EXISTS "Users can view teams they are members of" ON public.teams;
CREATE POLICY "Users can view teams they are members of" ON public.teams
FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT public.get_my_team_ids())
);

-- Team members select policy
DROP POLICY IF EXISTS "Users can view members of their teams" ON public.team_members;
CREATE POLICY "Users can view members of their teams" ON public.team_members
FOR SELECT USING (
    team_id IN (SELECT public.get_my_team_ids())
);

-- Content ideas select/insert/update/delete policies
DROP POLICY IF EXISTS "Users can view team ideas" ON public.content_ideas;
CREATE POLICY "Users can view team ideas" ON public.content_ideas
FOR SELECT USING (
    (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
    OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can insert team ideas" ON public.content_ideas;
CREATE POLICY "Users can insert team ideas" ON public.content_ideas
FOR INSERT WITH CHECK (
    (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
    OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can update their own ideas" ON public.content_ideas;
CREATE POLICY "Users can update their own ideas" ON public.content_ideas
FOR UPDATE USING (
    (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
    OR user_id = auth.uid()
)
WITH CHECK (
    (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
    OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can delete their own ideas" ON public.content_ideas;
CREATE POLICY "Users can delete their own ideas" ON public.content_ideas
FOR DELETE USING (
    (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
    OR user_id = auth.uid()
);

-- Personas select policy (same recursion risk pattern)
DROP POLICY IF EXISTS "Users can view team personas" ON public.personas;
CREATE POLICY "Users can view team personas" ON public.personas
FOR SELECT USING (
    (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
    OR user_id = auth.uid()
);
