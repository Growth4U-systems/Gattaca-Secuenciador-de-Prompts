-- Add column to track selected URLs for scraping
ALTER TABLE niche_finder_urls
ADD COLUMN IF NOT EXISTS selected BOOLEAN DEFAULT false;
