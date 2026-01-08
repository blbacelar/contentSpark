-- Create a function to create a team and add the creator as owner atomically
create or replace function create_team_with_owner(name text, user_id uuid)
returns json as $$
declare
  new_team_id uuid;
  new_code text;
begin
  -- Generate a simple random code for invitation (can be improved or handled by trigger)
  -- For now, we generate a basic one.
  new_code := encode(gen_random_bytes(6), 'hex');

  -- Insert Team
  insert into teams (name, owner_id, invitation_code)
  values (name, user_id, new_code)
  returning id into new_team_id;

  -- Insert Team Member
  insert into team_members (team_id, user_id, role)
  values (new_team_id, user_id, 'owner');

  -- Return the Team object
  return json_build_object(
    'id', new_team_id,
    'name', name,
    'owner_id', user_id,
    'invitation_code', new_code
  );
end;
$$ language plpgsql security definer;
