-- Performance indexes for frequent dashboard queries.

CREATE INDEX IF NOT EXISTS idx_content_ideas_user_id
ON public.content_ideas (user_id);

CREATE INDEX IF NOT EXISTS idx_content_ideas_user_status
ON public.content_ideas (user_id, status);

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'content_ideas'
			AND column_name = 'scheduled_at'
	) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_ideas_scheduled_at ON public.content_ideas (scheduled_at) WHERE scheduled_at IS NOT NULL';
	ELSIF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'content_ideas'
			AND column_name = 'date'
	) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_ideas_date ON public.content_ideas (date) WHERE date IS NOT NULL';
	END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_personas_user_id
ON public.personas (user_id);
