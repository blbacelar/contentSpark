-- Make team creation idempotent and reset RLS policies to eliminate recursion (42P17).
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.personas ENABLE ROW LEVEL SECURITY;

-- Canonical helper to resolve memberships without recursive policy evaluation.
CREATE OR REPLACE FUNCTION public.get_my_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
	SELECT tm.team_id
	FROM public.team_members tm
	WHERE tm.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_team_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_team_ids() TO authenticated;

-- Idempotent personal team creation to prevent 409 conflicts under races/retries.
CREATE OR REPLACE FUNCTION public.create_team_with_owner(name text, user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	existing_team RECORD;
	new_team RECORD;
	new_code text;
BEGIN
	IF name = 'Personal Team' THEN
		SELECT id, name, owner_id, invitation_code, created_at
		INTO existing_team
		FROM public.teams
		WHERE owner_id = user_id
			AND name = 'Personal Team'
		LIMIT 1;

		IF existing_team.id IS NOT NULL THEN
			INSERT INTO public.team_members (team_id, user_id, role)
			VALUES (existing_team.id, user_id, 'owner')
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
	VALUES (name, user_id, new_code)
	RETURNING id, name, owner_id, invitation_code, created_at
	INTO new_team;

	INSERT INTO public.team_members (team_id, user_id, role)
	VALUES (new_team.id, user_id, 'owner')
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
		IF name = 'Personal Team' THEN
			SELECT id, name, owner_id, invitation_code, created_at
			INTO existing_team
			FROM public.teams
			WHERE owner_id = user_id
				AND name = 'Personal Team'
			LIMIT 1;

			IF existing_team.id IS NOT NULL THEN
				INSERT INTO public.team_members (team_id, user_id, role)
				VALUES (existing_team.id, user_id, 'owner')
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

-- Remove all existing policies on affected tables to avoid legacy recursive variants.
DO $$
DECLARE
	p RECORD;
BEGIN
	FOR p IN
		SELECT schemaname, tablename, policyname
		FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename IN ('teams', 'team_members', 'content_ideas', 'personas')
	LOOP
		EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
	END LOOP;
END $$;

-- teams
CREATE POLICY teams_select_member_or_owner ON public.teams
FOR SELECT USING (
	owner_id = auth.uid()
	OR id IN (SELECT public.get_my_team_ids())
);

CREATE POLICY teams_insert_owner ON public.teams
FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY teams_update_owner ON public.teams
FOR UPDATE USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY teams_delete_owner ON public.teams
FOR DELETE USING (owner_id = auth.uid());

-- team_members
CREATE POLICY team_members_select_same_team ON public.team_members
FOR SELECT USING (
	team_id IN (SELECT public.get_my_team_ids())
);

CREATE POLICY team_members_insert_owner_or_self ON public.team_members
FOR INSERT WITH CHECK (
	user_id = auth.uid()
	OR EXISTS (
		SELECT 1
		FROM public.teams t
		WHERE t.id = team_id
			AND t.owner_id = auth.uid()
	)
);

CREATE POLICY team_members_update_owner ON public.team_members
FOR UPDATE USING (
	EXISTS (
		SELECT 1
		FROM public.teams t
		WHERE t.id = team_id
			AND t.owner_id = auth.uid()
	)
)
WITH CHECK (
	EXISTS (
		SELECT 1
		FROM public.teams t
		WHERE t.id = team_id
			AND t.owner_id = auth.uid()
	)
);

CREATE POLICY team_members_delete_owner_or_self ON public.team_members
FOR DELETE USING (
	user_id = auth.uid()
	OR EXISTS (
		SELECT 1
		FROM public.teams t
		WHERE t.id = team_id
			AND t.owner_id = auth.uid()
	)
);

-- content_ideas
CREATE POLICY content_ideas_select_visible ON public.content_ideas
FOR SELECT USING (
	user_id = auth.uid()
	OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
);

CREATE POLICY content_ideas_insert_visible ON public.content_ideas
FOR INSERT WITH CHECK (
	user_id = auth.uid()
	OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
);

CREATE POLICY content_ideas_update_visible ON public.content_ideas
FOR UPDATE USING (
	user_id = auth.uid()
	OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
)
WITH CHECK (
	user_id = auth.uid()
	OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
);

CREATE POLICY content_ideas_delete_visible ON public.content_ideas
FOR DELETE USING (
	user_id = auth.uid()
	OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
);

-- personas
CREATE POLICY personas_select_visible ON public.personas
FOR SELECT USING (
	user_id = auth.uid()
	OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
);

CREATE POLICY personas_insert_visible ON public.personas
FOR INSERT WITH CHECK (
	user_id = auth.uid()
	OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
);

CREATE POLICY personas_update_visible ON public.personas
FOR UPDATE USING (
	user_id = auth.uid()
	OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
)
WITH CHECK (
	user_id = auth.uid()
	OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
);

CREATE POLICY personas_delete_visible ON public.personas
FOR DELETE USING (
	user_id = auth.uid()
	OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_my_team_ids()))
);
