-- Migration: Allow multiple playbooks of the same type per project
-- Description: Removes unique constraint on (project_id, playbook_type) and adds name field
-- Use case: Multiple "competitor_analysis" playbooks for different competitors

-- 1. Add name column for distinguishing multiple instances
ALTER TABLE project_playbooks
ADD COLUMN IF NOT EXISTS name TEXT;

-- 2. Set default names for existing playbooks based on playbook_type
UPDATE project_playbooks
SET name = playbook_type
WHERE name IS NULL;

-- 3. Make name required going forward
ALTER TABLE project_playbooks
ALTER COLUMN name SET NOT NULL,
ALTER COLUMN name SET DEFAULT 'Untitled';

-- 4. Drop the unique constraint on (project_id, playbook_type)
-- This allows multiple playbooks of the same type
ALTER TABLE project_playbooks
DROP CONSTRAINT IF EXISTS project_playbooks_project_id_playbook_type_key;

-- 5. Create a new unique constraint on (project_id, name)
-- This ensures names are unique within a project
ALTER TABLE project_playbooks
ADD CONSTRAINT project_playbooks_project_id_name_key UNIQUE (project_id, name);

-- 6. Add index for faster lookups by playbook ID
CREATE INDEX IF NOT EXISTS idx_project_playbooks_id ON project_playbooks(id);

-- 7. Comments for documentation
COMMENT ON COLUMN project_playbooks.name IS 'User-friendly name for the playbook instance (e.g., "Competitor: Apple")';
