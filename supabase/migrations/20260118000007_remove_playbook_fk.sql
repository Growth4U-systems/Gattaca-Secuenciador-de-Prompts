-- ============================================================================
-- REMOVE FOREIGN KEY ON source_playbook_id
-- The playbook ID from campaigns may not exist in the playbooks table
-- (it could be a flow configuration ID, not a playbook template ID)
-- ============================================================================

-- Drop the foreign key constraint if it exists
ALTER TABLE knowledge_base_docs
DROP CONSTRAINT IF EXISTS knowledge_base_docs_source_playbook_id_fkey;

-- The column remains but without the FK constraint
-- This allows storing any playbook/flow ID without validation
COMMENT ON COLUMN knowledge_base_docs.source_playbook_id IS 'ID of the playbook or flow that generated this document (no FK - may reference flow configs)';
