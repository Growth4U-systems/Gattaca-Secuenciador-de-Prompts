-- Add folder organization and document references to knowledge_base_docs
-- This enables:
-- 1. Organizing documents into folders (single level)
-- 2. Referencing Context Lake documents in projects without duplication

-- 1. Add folder field for organizing documents
ALTER TABLE knowledge_base_docs
ADD COLUMN IF NOT EXISTS folder VARCHAR(100) DEFAULT NULL;

-- 2. Add reference fields to link to source documents
ALTER TABLE knowledge_base_docs
ADD COLUMN IF NOT EXISTS is_reference BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS source_doc_id UUID REFERENCES knowledge_base_docs(id) ON DELETE RESTRICT;

-- 3. Create index for folder queries
CREATE INDEX IF NOT EXISTS idx_knowledge_base_docs_folder
ON knowledge_base_docs(folder)
WHERE folder IS NOT NULL;

-- 4. Create index for reference lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_base_docs_source_doc
ON knowledge_base_docs(source_doc_id)
WHERE source_doc_id IS NOT NULL;

-- 5. Create function to check if document has active references before deletion
CREATE OR REPLACE FUNCTION check_document_references_before_delete()
RETURNS TRIGGER AS $$
DECLARE
  ref_count INTEGER;
  ref_projects TEXT[];
BEGIN
  -- Check if this is a soft delete (is_deleted being set to true) or hard delete
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.is_deleted = true AND OLD.is_deleted = false) THEN
    -- Count active references to this document
    SELECT COUNT(*), ARRAY_AGG(DISTINCT p.name)
    INTO ref_count, ref_projects
    FROM knowledge_base_docs d
    LEFT JOIN projects p ON d.project_id = p.id
    WHERE d.source_doc_id = OLD.id
    AND d.is_deleted = false;

    IF ref_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete document: it is referenced by % document(s) in projects: %',
        ref_count,
        ARRAY_TO_STRING(ref_projects, ', ');
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for deletion check
DROP TRIGGER IF EXISTS check_doc_references_trigger ON knowledge_base_docs;
CREATE TRIGGER check_doc_references_trigger
BEFORE DELETE OR UPDATE ON knowledge_base_docs
FOR EACH ROW
EXECUTE FUNCTION check_document_references_before_delete();

-- 7. Add comment for documentation
COMMENT ON COLUMN knowledge_base_docs.folder IS 'Optional folder name for organizing documents (single level, no nesting)';
COMMENT ON COLUMN knowledge_base_docs.is_reference IS 'True if this document is a reference to another document (source_doc_id)';
COMMENT ON COLUMN knowledge_base_docs.source_doc_id IS 'Reference to the source document in Context Lake. Content is read from source.';
