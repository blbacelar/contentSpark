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

  -- Fallback to splitting display_name/full_name if specific fields missing (optional)
  IF extracted_first_name IS NULL THEN
      extracted_first_name := split_part(new.raw_user_meta_data->>'full_name', ' ', 1);
  END IF;
  
  -- Insert into profiles
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
    new.email,
    4, 
    'Free', 
    FALSE
  );

  -- Insert into user_settings (New addition)
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
    INSERT INTO public.debug_logs (user_id, error_message, error_details)
    VALUES (new.id, SQLERRM, SQLSTATE);
    
    -- IMPORTANT: Re-raise the error so Supabase Auth knows it failed!
    -- Or suppress it if you want the user created anyway (but profile will be missing)
    -- RAISE EXCEPTION 'Profile creation failed: %', SQLERRM;
    RETURN new; -- Continue even if profile creation fails (debug_logs will catch it)
END;
$$;
