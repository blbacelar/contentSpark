-- ⚠️ DANGER: This script will delete ALL data from your database! ⚠️
-- Use this only for development/testing purposes.

-- 1. Truncate all public tables with CASCADE to clean up dependencies
-- dependent tables first (optional with CASCADE but good for clarity)
TRUNCATE TABLE 
  public.notifications,
  public.user_settings,
  public.team_members,
  public.content_ideas,
  public.teams,
  public.personas,
  public.profiles
RESTART IDENTITY CASCADE;

-- 2. Optional: Delete all Auth Users (requires appropriate permissions)
-- This ensures that you don't have "orphan" users in the auth system without profiles
-- Uncomment the line below if you want to wipe all user accounts too:

-- DELETE FROM auth.users;

-- 3. Reset any sequences if needed (usually handled by RESTART IDENTITY)
