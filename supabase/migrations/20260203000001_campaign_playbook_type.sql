-- Migration: Add playbook_type to campaigns
-- Description: Allows each campaign to have its own playbook type, independent of project
-- This enables a single project to have campaigns of different playbook types

-- 1. Add playbook_type column to ecp_campaigns
ALTER TABLE ecp_campaigns
ADD COLUMN IF NOT EXISTS playbook_type TEXT;

-- 2. Backfill existing campaigns with their project's playbook_type
UPDATE ecp_campaigns c
SET playbook_type = p.playbook_type::TEXT
FROM projects p
WHERE c.project_id = p.id
AND c.playbook_type IS NULL;

-- 3. Set default for campaigns without a project playbook_type
UPDATE ecp_campaigns
SET playbook_type = 'ecp'
WHERE playbook_type IS NULL;

-- 4. Add index for playbook_type queries
CREATE INDEX IF NOT EXISTS idx_ecp_campaigns_playbook_type
ON ecp_campaigns(playbook_type);

-- 5. Add composite index for project + playbook type
CREATE INDEX IF NOT EXISTS idx_ecp_campaigns_project_playbook
ON ecp_campaigns(project_id, playbook_type);

-- Comment for documentation
COMMENT ON COLUMN ecp_campaigns.playbook_type IS 'Type of playbook for this campaign (ecp, competitor_analysis, niche_finder, etc.). Allows different campaign types within the same project.';
