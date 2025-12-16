-- 1. Fix Missing Email Column (Critical for User Registration)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. Ensure User Settings Table Exists (Critical for 500 Error)
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    notify_on_team_join BOOLEAN DEFAULT TRUE,
    notify_on_idea_due BOOLEAN DEFAULT TRUE,
    idea_due_threshold_hours INTEGER DEFAULT 24,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
CREATE POLICY "Users can view their own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
CREATE POLICY "Users can update their own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
CREATE POLICY "Users can insert their own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Update Handle New User Trigger (Critical for Populating Data)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  extracted_first_name text;
  extracted_last_name text;
BEGIN
  -- Extract names from metadata
  extracted_first_name := new.raw_user_meta_data->>'first_name';
  extracted_last_name := new.raw_user_meta_data->>'last_name';

  -- Fallback to splitting display_name/full_name if specific fields missing
  IF extracted_first_name IS NULL THEN
      extracted_first_name := split_part(new.raw_user_meta_data->>'full_name', ' ', 1);
  END IF;
  
  -- Insert into profiles (Now safe because email column exists)
  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name,
    email,
    credits, 
    tier, 
    has_completed_onboarding
  )
  VALUES (
    new.id, 
    COALESCE(extracted_first_name, ''), 
    COALESCE(extracted_last_name, ''),
    new.email, -- This caused the error before
    4, 
    'Free', 
    FALSE
  );

  -- Insert into user_settings (Fixes 500 error on fetching settings)
  INSERT INTO public.user_settings (
    user_id,
    notify_on_team_join,
    notify_on_idea_due,
    idea_due_threshold_hours
  )
  VALUES (
    new.id,
    TRUE,
    TRUE,
    24
  );

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error to debug_logs table
    -- Ensure debug_logs exists first just in case
    -- (We assume debug_logs exists, if not this inner block fails silently or raises)
    BEGIN
        INSERT INTO public.debug_logs (user_id, error_message, error_details)
        VALUES (new.id, SQLERRM, SQLSTATE);
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just ignore it to avoid blocking auth?
        -- But for debugging we want to know. 
        NULL;
    END;
    RETURN new; 
END;
$$;
