-- Migration: Add description field to knowledge_base_docs
-- Purpose: Enable intelligent document matching by allowing users to describe document content

-- Add description column to knowledge_base_docs
ALTER TABLE knowledge_base_docs
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- Add comment for documentation
COMMENT ON COLUMN knowledge_base_docs.description IS
'User-provided description of the document content for intelligent matching and search';

-- Create index for text search on description (optional, for future search optimization)
CREATE INDEX IF NOT EXISTS idx_kb_docs_description
ON knowledge_base_docs USING gin(to_tsvector('spanish', COALESCE(description, '')));
