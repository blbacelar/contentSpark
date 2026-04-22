-- Persist full content editing fields in content_ideas.
-- Without these columns, refresh loses caption-oriented data saved in the modal.
ALTER TABLE public.content_ideas
	ADD COLUMN IF NOT EXISTS hook text,
	ADD COLUMN IF NOT EXISTS caption text,
	ADD COLUMN IF NOT EXISTS cta text,
	ADD COLUMN IF NOT EXISTS hashtags text;
