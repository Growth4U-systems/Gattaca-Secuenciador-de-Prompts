-- ============================================================================
-- ADD CLIENT_ID TO PROJECTS
-- Date: 2025-02-02
-- Description: Adds client_id foreign key to projects table
-- ============================================================================

-- Add client_id column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Add index for faster client lookups
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);

-- Comment for clarity
COMMENT ON COLUMN projects.client_id IS 'Reference to the client this project belongs to';
