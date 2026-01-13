-- ============================================================================
-- PROJECT SOFT DELETE
-- Date: 2025-02-02
-- Description: Adds status column to projects for soft delete functionality
-- ============================================================================

-- Add status column to projects table (defaults to 'active')
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add check constraint for valid statuses
ALTER TABLE projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('active', 'deleted'));

-- Add deleted_at timestamp column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add index for filtering by status
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Comment for clarity
COMMENT ON COLUMN projects.status IS 'Project status: active (normal) or deleted (soft deleted)';
COMMENT ON COLUMN projects.deleted_at IS 'Timestamp when project was soft deleted';
