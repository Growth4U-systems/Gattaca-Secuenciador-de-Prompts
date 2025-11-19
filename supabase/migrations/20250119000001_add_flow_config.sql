-- Migration: Add flow_config for dynamic flow builder
-- Non-destructive: adds new column, keeps old columns for backward compatibility

-- Add flow_config to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS flow_config JSONB DEFAULT NULL;

-- Add step_outputs to campaigns table
ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS step_outputs JSONB DEFAULT '{}'::jsonb;
ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS current_step_id TEXT;

-- Update status constraint to include new statuses
ALTER TABLE ecp_campaigns DROP CONSTRAINT IF EXISTS ecp_campaigns_status_check;
ALTER TABLE ecp_campaigns ADD CONSTRAINT ecp_campaigns_status_check
  CHECK (status IN (
    'draft',
    'pending_research',
    'research_complete',
    'step_1_running',
    'step_1_complete',
    'step_2_running',
    'step_2_complete',
    'step_3_running',
    'step_3_complete',
    'step_4_running',
    'completed',
    'error',
    'running',  -- NEW: for dynamic flows
    'paused'    -- NEW: for dynamic flows
  ));

-- Add timestamps for flow execution tracking
ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_current_step ON ecp_campaigns(current_step_id);

-- Comment explaining the system
COMMENT ON COLUMN projects.flow_config IS
'Dynamic flow configuration. If NULL, uses legacy 5-step hardcoded flow.
If set, contains array of step definitions with prompts, doc assignments, and auto-connections.
Example: [{"id":"step-1","name":"Research","order":1,"prompt":"...","base_doc_ids":[],"auto_receive_from":[]}]';

COMMENT ON COLUMN ecp_campaigns.step_outputs IS
'Outputs from each executed step. Structure: {"step-id": {"output": "text", "tokens": 123, "status": "completed", "completed_at": "2025-01-19T..."}}';

COMMENT ON COLUMN ecp_campaigns.current_step_id IS
'ID of the currently executing step (for dynamic flows)';
