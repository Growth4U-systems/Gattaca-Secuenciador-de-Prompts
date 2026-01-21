-- Add columns for partial results display during execution
-- These fields allow the UI to show what's happening in real-time

ALTER TABLE niche_finder_jobs
ADD COLUMN IF NOT EXISTS last_scraped_url TEXT,
ADD COLUMN IF NOT EXISTS last_scraped_snippet TEXT,
ADD COLUMN IF NOT EXISTS last_extracted_problems JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS scrape_success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scrape_failed_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extract_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extract_completed INTEGER DEFAULT 0;

COMMENT ON COLUMN niche_finder_jobs.last_scraped_url IS 'Last URL that was successfully scraped';
COMMENT ON COLUMN niche_finder_jobs.last_scraped_snippet IS 'First 200 chars of last scraped content';
COMMENT ON COLUMN niche_finder_jobs.last_extracted_problems IS 'Last 3 problems extracted, for UI preview';
COMMENT ON COLUMN niche_finder_jobs.scrape_success_count IS 'Count of successfully scraped URLs';
COMMENT ON COLUMN niche_finder_jobs.scrape_failed_count IS 'Count of failed scrape attempts';
COMMENT ON COLUMN niche_finder_jobs.extract_total IS 'Total URLs to extract problems from';
COMMENT ON COLUMN niche_finder_jobs.extract_completed IS 'URLs that have completed extraction';
