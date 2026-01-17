-- Migration: Add Context Lake enhancements to knowledge_base_docs
-- This migration adds client-level document support and tier system

-- Add new columns for Context Lake functionality
ALTER TABLE knowledge_base_docs
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'playbook', 'scraper', 'api', 'import')),
  ADD COLUMN IF NOT EXISTS source_playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'T3' CHECK (tier IN ('T1', 'T2', 'T3')),
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for client-level queries
CREATE INDEX IF NOT EXISTS idx_knowledge_base_docs_client_id ON knowledge_base_docs(client_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_docs_tier ON knowledge_base_docs(tier);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_docs_source_type ON knowledge_base_docs(source_type);

-- Update RLS policies to include client-level access
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can view client documents" ON knowledge_base_docs;

-- Create new policy for client-level access
CREATE POLICY "Users can view client documents"
  ON knowledge_base_docs
  FOR SELECT
  USING (
    -- Can view if document belongs to a project user has access to
    project_id IN (
      SELECT p.id FROM projects p
      INNER JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = auth.uid()
    )
    OR
    -- Can view if document belongs to a client in user's agency
    client_id IN (
      SELECT c.id FROM clients c
      INNER JOIN agencies a ON a.id = c.agency_id
      INNER JOIN agency_members am ON am.agency_id = a.id
      WHERE am.user_id = auth.uid()
    )
  );

-- Policy for inserting documents
DROP POLICY IF EXISTS "Users can insert client documents" ON knowledge_base_docs;

CREATE POLICY "Users can insert client documents"
  ON knowledge_base_docs
  FOR INSERT
  WITH CHECK (
    -- Can insert if user has access to the project
    (project_id IS NOT NULL AND project_id IN (
      SELECT p.id FROM projects p
      INNER JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = auth.uid()
    ))
    OR
    -- Can insert if user has access to the client
    (client_id IS NOT NULL AND client_id IN (
      SELECT c.id FROM clients c
      INNER JOIN agencies a ON a.id = c.agency_id
      INNER JOIN agency_members am ON am.agency_id = a.id
      WHERE am.user_id = auth.uid()
    ))
  );

-- Policy for updating documents
DROP POLICY IF EXISTS "Users can update client documents" ON knowledge_base_docs;

CREATE POLICY "Users can update client documents"
  ON knowledge_base_docs
  FOR UPDATE
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      INNER JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = auth.uid()
    )
    OR
    client_id IN (
      SELECT c.id FROM clients c
      INNER JOIN agencies a ON a.id = c.agency_id
      INNER JOIN agency_members am ON am.agency_id = a.id
      WHERE am.user_id = auth.uid()
    )
  );

-- Policy for deleting documents
DROP POLICY IF EXISTS "Users can delete client documents" ON knowledge_base_docs;

CREATE POLICY "Users can delete client documents"
  ON knowledge_base_docs
  FOR DELETE
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      INNER JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = auth.uid()
    )
    OR
    client_id IN (
      SELECT c.id FROM clients c
      INNER JOIN agencies a ON a.id = c.agency_id
      INNER JOIN agency_members am ON am.agency_id = a.id
      WHERE am.user_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN knowledge_base_docs.tier IS 'Document tier: T1 (always included), T2 (included if relevant), T3 (optional/archived)';
COMMENT ON COLUMN knowledge_base_docs.source_type IS 'How the document was created: manual upload, playbook output, scraper, API, or import';
COMMENT ON COLUMN knowledge_base_docs.client_id IS 'Client-level documents are shared across all projects for that client';
