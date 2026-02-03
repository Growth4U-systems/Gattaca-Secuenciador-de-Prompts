-- Add wizard state fields to ecp_campaigns for Knowledge Base Generator
-- This enables persisting the user's progress in the sequential wizard

-- Phase of the campaign workflow
-- Values: 'knowledge_base' (generating docs), 'analysis' (running playbook), 'completed'
ALTER TABLE ecp_campaigns
ADD COLUMN IF NOT EXISTS current_phase TEXT DEFAULT 'knowledge_base';

-- Current step index within the phase
-- For knowledge_base phase: index of current document (0-19)
-- For analysis phase: index of current playbook step (0-4)
ALTER TABLE ecp_campaigns
ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;

-- Progress of each document in the knowledge base phase
-- Format: { "deep_research": "completed", "website": "in_progress", "instagram_posts": "skipped", ... }
-- Values: 'pending', 'in_progress', 'completed', 'skipped'
ALTER TABLE ecp_campaigns
ADD COLUMN IF NOT EXISTS documents_progress JSONB DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN ecp_campaigns.current_phase IS 'Current phase of campaign: knowledge_base, analysis, or completed';
COMMENT ON COLUMN ecp_campaigns.current_step IS 'Current step index within the phase (0-indexed)';
COMMENT ON COLUMN ecp_campaigns.documents_progress IS 'Progress of each document source type: pending, in_progress, completed, or skipped';

-- Create index for faster queries on active campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_current_phase ON ecp_campaigns(current_phase);
