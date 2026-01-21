-- Fix default value for selected column to be true (all URLs selected by default)
ALTER TABLE niche_finder_urls
ALTER COLUMN selected SET DEFAULT true;

-- Update existing scraped URLs to be selected by default
UPDATE niche_finder_urls
SET selected = true
WHERE status = 'scraped' AND selected IS NOT true;
