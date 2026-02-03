-- Migration: Add project_playbooks table for M:M relationship
-- Description: Allows a project to have multiple playbooks instead of just one
-- Hierarchy: Cliente → Proyecto → Playbooks → Campañas

-- 1. Create the project_playbooks table
CREATE TABLE IF NOT EXISTS project_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  playbook_type TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, playbook_type)
);

-- 2. Migrate existing projects to the new table
-- This ensures backwards compatibility - all existing projects get their playbook_type added
INSERT INTO project_playbooks (project_id, playbook_type, position)
SELECT id, playbook_type::TEXT, 0
FROM projects
WHERE playbook_type IS NOT NULL
  AND playbook_type::TEXT != ''
ON CONFLICT (project_id, playbook_type) DO NOTHING;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_playbooks_project ON project_playbooks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_playbooks_type ON project_playbooks(playbook_type);
CREATE INDEX IF NOT EXISTS idx_project_playbooks_position ON project_playbooks(project_id, position);

-- 4. Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_project_playbooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_playbooks_updated_at ON project_playbooks;
CREATE TRIGGER project_playbooks_updated_at
  BEFORE UPDATE ON project_playbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_project_playbooks_updated_at();

-- 5. Comments for documentation
COMMENT ON TABLE project_playbooks IS 'Relationship table allowing projects to have multiple playbooks';
COMMENT ON COLUMN project_playbooks.playbook_type IS 'Type of playbook (ecp, competitor_analysis, niche_finder, etc.)';
COMMENT ON COLUMN project_playbooks.config IS 'Optional playbook-specific configuration for this project';
COMMENT ON COLUMN project_playbooks.position IS 'Display order of playbooks within the project';

-- 6. Disable RLS for simplicity (matching other tables in this project)
ALTER TABLE project_playbooks DISABLE ROW LEVEL SECURITY;
