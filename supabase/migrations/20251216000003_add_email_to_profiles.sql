-- Fix missing email column in profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Optional: Create an index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
