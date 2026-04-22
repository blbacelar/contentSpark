-- Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. VIEW POLICY: Allow users to view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- 2. UPDATE POLICY: Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 3. INSERT POLICY: Allow users to insert their own profile (e.g. on signup trigger)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 4. PUBLIC READ POLICY (Optional): If you want other users to see names (e.g. in team list)
-- We need this so Team Members can see each other's names!
DROP POLICY IF EXISTS "Users can view team members profiles" ON public.profiles;
CREATE POLICY "Users can view team members profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.user_id = auth.uid()
    AND tm.team_id IN (
      SELECT team_id FROM team_members WHERE user_id = profiles.id
    )
  )
);
