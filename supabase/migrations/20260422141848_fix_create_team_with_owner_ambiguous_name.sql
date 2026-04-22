-- Fix ambiguous parameter references in create_team_with_owner RPC.

CREATE OR REPLACE FUNCTION public.create_team_with_owner(name text, user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	p_name text := name;
	p_user_id uuid := user_id;
	existing_team RECORD;
	new_team RECORD;
	new_code text;
BEGIN
	IF p_name = 'Personal Team' THEN
		SELECT t.id, t.name, t.owner_id, t.invitation_code, t.created_at
		INTO existing_team
		FROM public.teams t
		WHERE t.owner_id = p_user_id
			AND t.name = 'Personal Team'
		LIMIT 1;

		IF existing_team.id IS NOT NULL THEN
			INSERT INTO public.team_members (team_id, user_id, role)
			VALUES (existing_team.id, p_user_id, 'owner')
			ON CONFLICT (team_id, user_id) DO NOTHING;

			RETURN json_build_object(
				'id', existing_team.id,
				'name', existing_team.name,
				'owner_id', existing_team.owner_id,
				'invitation_code', existing_team.invitation_code,
				'created_at', existing_team.created_at
			);
		END IF;
	END IF;

	new_code := encode(gen_random_bytes(6), 'hex');

	INSERT INTO public.teams (name, owner_id, invitation_code)
	VALUES (p_name, p_user_id, new_code)
	RETURNING id, name, owner_id, invitation_code, created_at
	INTO new_team;

	INSERT INTO public.team_members (team_id, user_id, role)
	VALUES (new_team.id, p_user_id, 'owner')
	ON CONFLICT (team_id, user_id) DO NOTHING;

	RETURN json_build_object(
		'id', new_team.id,
		'name', new_team.name,
		'owner_id', new_team.owner_id,
		'invitation_code', new_team.invitation_code,
		'created_at', new_team.created_at
	);

EXCEPTION
	WHEN unique_violation THEN
		IF p_name = 'Personal Team' THEN
			SELECT t.id, t.name, t.owner_id, t.invitation_code, t.created_at
			INTO existing_team
			FROM public.teams t
			WHERE t.owner_id = p_user_id
				AND t.name = 'Personal Team'
			LIMIT 1;

			IF existing_team.id IS NOT NULL THEN
				INSERT INTO public.team_members (team_id, user_id, role)
				VALUES (existing_team.id, p_user_id, 'owner')
				ON CONFLICT (team_id, user_id) DO NOTHING;

				RETURN json_build_object(
					'id', existing_team.id,
					'name', existing_team.name,
					'owner_id', existing_team.owner_id,
					'invitation_code', existing_team.invitation_code,
					'created_at', existing_team.created_at
				);
			END IF;
		END IF;

		RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_with_owner(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_team_with_owner(text, uuid) TO authenticated;
