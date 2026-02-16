-- =====================================================
-- INTERACTIVE ANALYSIS: Review statuses + edited_content
-- Allows step-by-step review between analysis steps
-- =====================================================

-- Add review statuses to niche_finder_jobs
ALTER TABLE niche_finder_jobs
DROP CONSTRAINT IF EXISTS niche_finder_jobs_status_check;

ALTER TABLE niche_finder_jobs
ADD CONSTRAINT niche_finder_jobs_status_check CHECK (status IN (
  'pending',
  'serp_running',
  'serp_done',
  'scraping',
  'scrape_done',
  'extracting',
  'extract_done',
  'review_extract',   -- User reviewing extraction CSV
  'analyzing_1',
  'review_1',         -- User reviewing clean-filter output
  'analyzing_2',
  'review_2',         -- User reviewing scoring output
  'analyzing_3',
  'review_3',         -- User reviewing consolidate output
  'completed',
  'failed'
));

-- Add edited_content column for user edits on step outputs
ALTER TABLE niche_finder_step_outputs
ADD COLUMN IF NOT EXISTS edited_content TEXT;
