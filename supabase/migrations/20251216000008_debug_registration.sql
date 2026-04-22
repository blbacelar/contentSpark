-- Create a debug table to capture errors
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    operation text,
    error_message text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS but allow insert for debugging (or just leave open for dev)
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow generic access for debug" ON public.debug_logs FOR ALL USING (true) WITH CHECK (true);

-- Update the handle_new_user function with error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      first_name,
      last_name,
      avatar_url,
      credits,
      tier,
      has_completed_onboarding
    )
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'first_name', ''),
      COALESCE(new.raw_user_meta_data->>'last_name', ''),
      new.raw_user_meta_data->>'avatar_url',
      4,
      'free',
      false
    )
    ON CONFLICT (id) DO UPDATE
    SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      email = EXCLUDED.email;
      
  EXCEPTION WHEN OTHERS THEN
    -- Log the error and continue (so we don't block user creation, though profile will be missing)
    -- OR re-raise. For 500 debugging, capturing is better.
    INSERT INTO public.debug_logs (operation, error_message)
    VALUES ('handle_new_user', SQLERRM);
    
    -- We can choose to RAISE NOTICE or just let the user creation succeed without profile
    -- RAISE WARNING 'Profile creation failed: %', SQLERRM;
  END;

  return new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
