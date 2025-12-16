-- Secure Join Team RPC
-- This allows a user to join a team if they have the correct invitation code.
-- It bypasses RLS for the team lookup and the team_members insert.
CREATE OR REPLACE FUNCTION join_team_by_code(code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_team_id uuid;
  found_team_name text;
  team_owner_id uuid;
  existing_member_id uuid;
  should_notify boolean;
  joiner_name text;
BEGIN
  -- 1. Find team by code
  SELECT id, name, owner_id INTO found_team_id, found_team_name, team_owner_id
  FROM teams
  WHERE invitation_code = code
  LIMIT 1;

  -- 2. Validate Code
  IF found_team_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired invitation code.');
  END IF;

  -- 3. Check if already a member
  SELECT user_id INTO existing_member_id
  FROM team_members
  WHERE team_id = found_team_id AND user_id = auth.uid();

  IF existing_member_id IS NOT NULL THEN
    -- Already a member, just return success
    RETURN json_build_object('success', true, 'team_id', found_team_id, 'team_name', found_team_name, 'already_member', true);
  END IF;

  -- 4. Not a member? Insert them!
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (found_team_id, auth.uid(), 'member');

  -- 5. Notify Team Owner
  -- Get user name/email for the message (optional, but nice)
  SELECT COALESCE(raw_user_meta_data->>'first_name', 'Someone') INTO joiner_name
  FROM auth.users
  WHERE id = auth.uid();

  -- Check settings
  SELECT notify_on_team_join INTO should_notify
  FROM user_settings
  WHERE user_id = team_owner_id;

  -- Default to true if no settings exist
  IF should_notify IS NULL THEN
    should_notify := true;
  END IF;

  IF should_notify THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      team_owner_id,
      'team_join',
      'New Team Member',
      joiner_name || ' joined ' || found_team_name,
      json_build_object('team_id', found_team_id, 'new_member_id', auth.uid())
    );
  END IF;

  RETURN json_build_object('success', true, 'team_id', found_team_id, 'team_name', found_team_name);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
