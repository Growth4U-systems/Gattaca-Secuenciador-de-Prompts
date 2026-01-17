-- ============================================================================
-- FIX ORPHAN PLAYBOOK REFERENCES IN KNOWLEDGE_BASE_DOCS
-- Some documents reference playbooks that don't exist, violating FK constraint
-- ============================================================================

-- First, set any orphan source_playbook_id references to NULL
UPDATE knowledge_base_docs
SET source_playbook_id = NULL
WHERE source_playbook_id IS NOT NULL
  AND source_playbook_id NOT IN (SELECT id FROM playbooks);

-- Do the same for source_campaign_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base_docs' AND column_name = 'source_campaign_id'
  ) THEN
    EXECUTE 'UPDATE knowledge_base_docs SET source_campaign_id = NULL WHERE source_campaign_id IS NOT NULL AND source_campaign_id NOT IN (SELECT id FROM ecp_campaigns)';
  END IF;
END $$;
