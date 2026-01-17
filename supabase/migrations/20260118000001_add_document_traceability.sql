-- ============================================================================
-- DOCUMENT TRACEABILITY MIGRATION
-- Adds user tracking, campaign/step linkage, soft delete, and version history
-- ============================================================================

-- 1. Add traceability columns to knowledge_base_docs
-- ============================================================================

-- User tracking
ALTER TABLE knowledge_base_docs
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Campaign/Step linkage for playbook outputs
ALTER TABLE knowledge_base_docs
  ADD COLUMN IF NOT EXISTS source_campaign_id UUID REFERENCES ecp_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_step_id TEXT,
  ADD COLUMN IF NOT EXISTS source_step_name TEXT;

-- Soft delete for audit trail
ALTER TABLE knowledge_base_docs
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ensure updated_at exists (may already exist from previous migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base_docs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE knowledge_base_docs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 2. Create indexes for new columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_kb_docs_created_by ON knowledge_base_docs(created_by);
CREATE INDEX IF NOT EXISTS idx_kb_docs_updated_by ON knowledge_base_docs(updated_by);
CREATE INDEX IF NOT EXISTS idx_kb_docs_source_campaign ON knowledge_base_docs(source_campaign_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_source_step ON knowledge_base_docs(source_step_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_not_deleted ON knowledge_base_docs(is_deleted) WHERE is_deleted = FALSE;

-- 3. Create document_versions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_base_docs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  extracted_content TEXT NOT NULL,
  token_count INTEGER,
  change_type TEXT NOT NULL CHECK (change_type IN (
    'created',        -- Initial creation
    'manual_edit',    -- User manually edited
    'ai_suggestion',  -- AI-assisted edit
    'regenerated',    -- Re-ran the step
    'imported',       -- Imported from external source
    'merged',         -- Merged from multiple sources
    'restored'        -- Restored from previous version
  )),
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique version numbers per document
  CONSTRAINT unique_version_per_doc UNIQUE (document_id, version_number)
);

-- Indexes for document_versions
CREATE INDEX IF NOT EXISTS idx_doc_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_created_at ON document_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_versions_created_by ON document_versions(created_by);

-- 4. Create trigger for updated_at on knowledge_base_docs
-- ============================================================================

CREATE OR REPLACE FUNCTION update_kb_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kb_docs_updated_at_trigger ON knowledge_base_docs;
CREATE TRIGGER kb_docs_updated_at_trigger
  BEFORE UPDATE ON knowledge_base_docs
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_docs_updated_at();

-- 5. Create function to auto-create version on document content update
-- ============================================================================

CREATE OR REPLACE FUNCTION create_document_version_on_update()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Only create version if content actually changed
  IF OLD.extracted_content IS DISTINCT FROM NEW.extracted_content THEN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM document_versions
    WHERE document_id = NEW.id;

    -- Insert version record with the NEW content
    INSERT INTO document_versions (
      document_id,
      version_number,
      extracted_content,
      token_count,
      change_type,
      change_summary,
      created_by,
      created_at
    ) VALUES (
      NEW.id,
      next_version,
      NEW.extracted_content,
      NEW.token_count,
      'manual_edit',
      NULL,
      NEW.updated_by,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kb_docs_version_on_update_trigger ON knowledge_base_docs;
CREATE TRIGGER kb_docs_version_on_update_trigger
  AFTER UPDATE ON knowledge_base_docs
  FOR EACH ROW
  EXECUTE FUNCTION create_document_version_on_update();

-- 6. Create function to create initial version on document insert
-- ============================================================================

CREATE OR REPLACE FUNCTION create_initial_document_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Create version 1 for new documents
  INSERT INTO document_versions (
    document_id,
    version_number,
    extracted_content,
    token_count,
    change_type,
    change_summary,
    created_by,
    created_at
  ) VALUES (
    NEW.id,
    1,
    NEW.extracted_content,
    NEW.token_count,
    'created',
    'Versión inicial',
    NEW.created_by,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kb_docs_initial_version_trigger ON knowledge_base_docs;
CREATE TRIGGER kb_docs_initial_version_trigger
  AFTER INSERT ON knowledge_base_docs
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_document_version();

-- 7. RLS policies for document_versions
-- ============================================================================

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view versions of documents they can access
CREATE POLICY "Users can view versions of accessible documents"
  ON document_versions FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM knowledge_base_docs
      WHERE project_id IN (
        SELECT p.id FROM projects p
        INNER JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = auth.uid()
      )
      OR client_id IN (
        SELECT c.id FROM clients c
        INNER JOIN agencies a ON a.id = c.agency_id
        INNER JOIN agency_members am ON am.agency_id = a.id
        WHERE am.user_id = auth.uid()
      )
    )
  );

-- Policy: Users can create versions for documents they can edit
CREATE POLICY "Users can create versions for accessible documents"
  ON document_versions FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT id FROM knowledge_base_docs
      WHERE project_id IN (
        SELECT p.id FROM projects p
        INNER JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
      )
      OR client_id IN (
        SELECT c.id FROM clients c
        INNER JOIN agencies a ON a.id = c.agency_id
        INNER JOIN agency_members am ON am.agency_id = a.id
        WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'admin')
      )
    )
  );

-- 8. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN knowledge_base_docs.created_by IS 'User who originally created this document';
COMMENT ON COLUMN knowledge_base_docs.updated_by IS 'User who last modified this document';
COMMENT ON COLUMN knowledge_base_docs.source_campaign_id IS 'Campaign from which this document was generated (for playbook outputs)';
COMMENT ON COLUMN knowledge_base_docs.source_step_id IS 'Flow step ID that generated this document';
COMMENT ON COLUMN knowledge_base_docs.source_step_name IS 'Human-readable name of the source step';
COMMENT ON COLUMN knowledge_base_docs.is_deleted IS 'Soft delete flag - document hidden but retained for audit';
COMMENT ON COLUMN knowledge_base_docs.deleted_at IS 'Timestamp when document was soft-deleted';
COMMENT ON COLUMN knowledge_base_docs.deleted_by IS 'User who soft-deleted the document';

COMMENT ON TABLE document_versions IS 'Version history for document content changes. Auto-populated by triggers.';
COMMENT ON COLUMN document_versions.version_number IS 'Sequential version number per document, starting at 1';
COMMENT ON COLUMN document_versions.change_type IS 'Type of change: created, manual_edit, ai_suggestion, regenerated, imported, merged, restored';
COMMENT ON COLUMN document_versions.change_summary IS 'Optional human-readable description of what changed';
