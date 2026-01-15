-- Migration: Add tags column to knowledge_base_docs
-- This enables flexible tagging for documents, especially those from scrapers
-- Tags will be used for filtering, search, and intelligent matching

-- Add tags column as TEXT array
ALTER TABLE knowledge_base_docs
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create GIN index for efficient tag queries
CREATE INDEX IF NOT EXISTS idx_knowledge_base_docs_tags
ON knowledge_base_docs USING GIN (tags);

-- Helper function to search documents by tag within a project
CREATE OR REPLACE FUNCTION search_docs_by_tag(
  p_project_id UUID,
  p_tag TEXT
) RETURNS SETOF knowledge_base_docs AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM knowledge_base_docs
  WHERE project_id = p_project_id
  AND p_tag = ANY(tags)
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get all unique tags for a project
CREATE OR REPLACE FUNCTION get_project_tags(
  p_project_id UUID
) RETURNS TABLE(tag TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT UNNEST(tags) as tag, COUNT(*) as count
  FROM knowledge_base_docs
  WHERE project_id = p_project_id
  AND tags IS NOT NULL
  AND array_length(tags, 1) > 0
  GROUP BY tag
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON COLUMN knowledge_base_docs.tags IS 'Array of tags for filtering and intelligent matching. Auto-generated for scraped documents (company name, source, date).';
