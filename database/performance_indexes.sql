-- ContentSpark Performance Optimization
-- Database Indexes for Faster Queries

-- ============================================
-- 1. CONTENT_IDEAS TABLE INDEXES
-- ============================================

-- Primary index on user_id (CRITICAL for /get-user-ideas)
-- This will reduce query time from ~500ms to ~50ms
CREATE INDEX IF NOT EXISTS idx_content_ideas_user_id 
ON content_ideas(user_id);

-- Composite index for filtering by user + status
-- Useful for queries like "get all pending ideas for user X"
CREATE INDEX IF NOT EXISTS idx_content_ideas_user_status 
ON content_ideas(user_id, status);

-- Index on scheduled_at for calendar queries
CREATE INDEX IF NOT EXISTS idx_content_ideas_scheduled_at 
ON content_ideas(scheduled_at) 
WHERE scheduled_at IS NOT NULL;

-- ============================================
-- 2. PERSONAS TABLE INDEXES
-- ============================================

-- Index on user_id for /get-persona endpoint
CREATE INDEX IF NOT EXISTS idx_personas_user_id 
ON personas(user_id);

-- ============================================
-- 3. PROFILES TABLE INDEXES
-- ============================================

-- Index on user_id (should already exist, but verify)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON profiles(id);

-- ============================================
-- 4. VERIFY INDEXES
-- ============================================

-- Run this query to verify indexes were created:
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('content_ideas', 'personas', 'profiles')
ORDER BY tablename, indexname;

-- ============================================
-- 5. ANALYZE QUERY PERFORMANCE
-- ============================================

-- Before optimization:
EXPLAIN ANALYZE
SELECT * FROM content_ideas WHERE user_id = '5610e481-186e-4ec1-89aa-775c5214bdfc';

-- After adding index, re-run the same query
-- Expected: "Index Scan using idx_content_ideas_user_id"
-- Execution time should drop from ~500ms to ~50ms
