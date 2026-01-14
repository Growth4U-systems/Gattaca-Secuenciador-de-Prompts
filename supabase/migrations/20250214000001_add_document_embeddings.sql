-- ============================================================================
-- DOCUMENT EMBEDDINGS FOR RAG
-- Date: 2025-02-14
-- Description: Adds embedding support to knowledge_base_docs for RAG retrieval
-- ============================================================================

-- Enable pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to knowledge_base_docs
ALTER TABLE knowledge_base_docs
ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-3-small',
ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'completed', 'error'));

-- Create chunks table for storing document chunks with embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_base_docs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  start_char INTEGER,
  end_char INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(document_id, chunk_index)
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for document lookup
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);

-- Comments
COMMENT ON TABLE document_chunks IS 'Stores document chunks with embeddings for RAG retrieval';
COMMENT ON COLUMN document_chunks.embedding IS 'Vector embedding from OpenAI text-embedding-3-small (1536 dimensions)';
COMMENT ON COLUMN knowledge_base_docs.embedding_status IS 'Status of embedding generation: pending, processing, completed, error';

-- RLS policies for document_chunks (inherit from parent document access)
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Allow read if user can read the parent document
CREATE POLICY "Users can read chunks of their documents" ON document_chunks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM knowledge_base_docs d
    WHERE d.id = document_chunks.document_id
    AND d.project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  )
);

-- Service role can do anything
CREATE POLICY "Service role full access to chunks" ON document_chunks
FOR ALL USING (auth.role() = 'service_role');

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_document_ids uuid[],
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  token_count int,
  similarity float,
  filename text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.token_count,
    1 - (dc.embedding <=> query_embedding) as similarity,
    kbd.filename
  FROM document_chunks dc
  JOIN knowledge_base_docs kbd ON kbd.id = dc.document_id
  WHERE dc.document_id = ANY(match_document_ids)
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
