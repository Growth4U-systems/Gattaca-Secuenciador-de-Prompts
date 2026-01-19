-- Add playbook_state column to ecp_campaigns to persist playbook progress
-- This stores the full PlaybookState including completed steps, selections, etc.

ALTER TABLE ecp_campaigns
ADD COLUMN IF NOT EXISTS playbook_state JSONB;

-- Add comment for documentation
COMMENT ON COLUMN ecp_campaigns.playbook_state IS 'Full playbook state including phases, steps, selections, and progress. Persisted on each step completion.';
