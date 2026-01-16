-- Migration: Add source columns to knowledge_base_docs for scraper integration
-- These columns track the origin of documents created by scrapers

-- Add source_type column (e.g., 'scraper', 'upload', 'manual')
ALTER TABLE knowledge_base_docs
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'upload';

-- Add source_job_id to link back to the scraper job
ALTER TABLE knowledge_base_docs
ADD COLUMN IF NOT EXISTS source_job_id UUID;

-- Add source_url to store the original URL that was scraped
ALTER TABLE knowledge_base_docs
ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Add source_metadata as JSONB for flexible storage of scraper-specific data
ALTER TABLE knowledge_base_docs
ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}';

-- Create index for source_type for filtering
CREATE INDEX IF NOT EXISTS idx_kb_docs_source_type
ON knowledge_base_docs (source_type);

-- Create index for source_job_id for lookups
CREATE INDEX IF NOT EXISTS idx_kb_docs_source_job_id
ON knowledge_base_docs (source_job_id);

-- Add foreign key constraint to scraper_jobs (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scraper_jobs') THEN
    ALTER TABLE knowledge_base_docs
    ADD CONSTRAINT fk_kb_docs_scraper_job
    FOREIGN KEY (source_job_id) REFERENCES scraper_jobs(id)
    ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
  NULL;
END $$;

-- Comments for documentation
COMMENT ON COLUMN knowledge_base_docs.source_type IS 'Origin of the document: upload (default), scraper, manual, api';
COMMENT ON COLUMN knowledge_base_docs.source_job_id IS 'Reference to scraper_jobs.id if document was created by a scraper';
COMMENT ON COLUMN knowledge_base_docs.source_url IS 'Original URL that was scraped to create this document';
COMMENT ON COLUMN knowledge_base_docs.source_metadata IS 'JSON metadata about the source (scraper_type, scraped_at, total_items, etc.)';
