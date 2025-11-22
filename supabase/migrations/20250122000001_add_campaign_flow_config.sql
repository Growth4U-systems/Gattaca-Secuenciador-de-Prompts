-- Migration: Add flow_config to campaigns for campaign-level flow customization
-- Description: Allows each campaign to have its own flow configuration independent of the project

-- Add flow_config column to campaigns
ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS flow_config JSONB DEFAULT NULL;

-- Comment explaining the purpose
COMMENT ON COLUMN ecp_campaigns.flow_config IS
'Campaign-specific flow configuration. When set, overrides the project''s default flow_config.
Allows each campaign to customize which documents and steps are used.
If NULL, falls back to the project''s flow_config.
Structure: {"steps": [{"id":"step-1","name":"Research","order":1,"prompt":"...","base_doc_ids":[],"auto_receive_from":[]}], "version": "1.0", "description": "..."}';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_flow_config ON ecp_campaigns USING GIN (flow_config);
