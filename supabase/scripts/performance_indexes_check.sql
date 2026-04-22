-- Verification and performance-check script for index rollout.

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('content_ideas', 'personas')
ORDER BY tablename, indexname;

-- Example baseline query for EXPLAIN ANALYZE:
-- Replace the UUID below with a valid user id in your environment.
EXPLAIN ANALYZE
SELECT *
FROM public.content_ideas
WHERE user_id = '00000000-0000-0000-0000-000000000000';
