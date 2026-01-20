-- Add columns to track SERP progress in real-time
ALTER TABLE niche_finder_jobs
ADD COLUMN IF NOT EXISTS serp_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS serp_completed INTEGER DEFAULT 0;
