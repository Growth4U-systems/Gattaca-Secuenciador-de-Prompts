-- ============================================
-- Migration: Add Unique Constraint on source_job_id
-- ============================================
-- Purpose: Prevent duplicate documents when webhook and polling
--          both try to save results from the same scraper job
-- Date: 2026-02-07
-- ============================================

-- Add unique constraint to prevent duplicates
-- This ensures only one document per scraper job
ALTER TABLE knowledge_base_docs
ADD CONSTRAINT unique_source_job_id
UNIQUE (source_job_id);

-- Note: This migration will fail if there are existing duplicates.
-- If the migration fails, first clean up duplicates with:
--
-- DELETE FROM knowledge_base_docs a
-- USING knowledge_base_docs b
-- WHERE a.id > b.id
--   AND a.source_job_id = b.source_job_id
--   AND a.source_job_id IS NOT NULL;
--
-- Then re-run this migration.
