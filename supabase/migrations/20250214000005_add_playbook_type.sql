-- Migration: Add playbook_type field to projects
-- Description: Allows distinguishing between different playbook types (ECP, video_viral_ia, etc.)

-- Create enum type for playbook types
DO $$ BEGIN
  CREATE TYPE playbook_type AS ENUM ('ecp', 'video_viral_ia', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add playbook_type column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS playbook_type playbook_type DEFAULT 'custom';

-- Add playbook_type column to projects_legacy table
ALTER TABLE projects_legacy
ADD COLUMN IF NOT EXISTS playbook_type playbook_type DEFAULT 'custom';

-- Update existing projects based on their flow_config content
-- Projects with ECP-specific steps get 'ecp' type
UPDATE projects
SET playbook_type = 'ecp'
WHERE legacy_flow_config IS NOT NULL
  AND (
    legacy_flow_config::text LIKE '%step-4-find-place%'
    OR legacy_flow_config::text LIKE '%step-5-select-assets%'
    OR legacy_flow_config::text LIKE '%step-6-proof-points%'
    OR legacy_flow_config::text LIKE '%step-7-final-output%'
  );

UPDATE projects_legacy
SET playbook_type = 'ecp'
WHERE flow_config IS NOT NULL
  AND (
    flow_config::text LIKE '%step-4-find-place%'
    OR flow_config::text LIKE '%step-5-select-assets%'
    OR flow_config::text LIKE '%step-6-proof-points%'
    OR flow_config::text LIKE '%step-7-final-output%'
  );

-- Update sync trigger to include playbook_type
CREATE OR REPLACE FUNCTION sync_projects_to_legacy()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO projects_legacy (id, user_id, name, description, flow_config, created_at, updated_at, playbook_type)
    VALUES (NEW.id, NEW.user_id, NEW.name, NEW.description, NEW.legacy_flow_config, NEW.created_at, NEW.updated_at, NEW.playbook_type)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      flow_config = EXCLUDED.flow_config,
      updated_at = EXCLUDED.updated_at,
      playbook_type = EXCLUDED.playbook_type;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE projects_legacy SET
      user_id = NEW.user_id,
      name = NEW.name,
      description = NEW.description,
      flow_config = NEW.legacy_flow_config,
      updated_at = NEW.updated_at,
      playbook_type = NEW.playbook_type
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM projects_legacy WHERE id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON COLUMN projects.playbook_type IS 'Type of playbook used by this project: ecp (ECP Positioning), video_viral_ia (Video Viral IA), custom (other)';
COMMENT ON COLUMN projects_legacy.playbook_type IS 'Type of playbook used by this project: ecp (ECP Positioning), video_viral_ia (Video Viral IA), custom (other)';
