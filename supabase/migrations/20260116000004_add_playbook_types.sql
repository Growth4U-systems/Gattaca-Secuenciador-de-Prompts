-- Migration: Add new playbook types to enum
-- Description: Adds niche_finder and competitor_analysis types

-- Add new values to playbook_type enum
ALTER TYPE playbook_type ADD VALUE IF NOT EXISTS 'niche_finder';
ALTER TYPE playbook_type ADD VALUE IF NOT EXISTS 'competitor_analysis';

-- Update comment for documentation
COMMENT ON COLUMN projects.playbook_type IS 'Type of playbook: ecp (ECP Positioning), niche_finder (Niche Finder), competitor_analysis (Competitor Analysis), video_viral_ia (Video Viral IA), custom (other)';
