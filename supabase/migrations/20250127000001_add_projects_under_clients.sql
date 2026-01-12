-- Add Projects table under Clients
-- Version: 2.1.0
-- Description: Projects live under Clients. Context Lake is at Client level, Projects use the same context.

-- ============================================================================
-- HANDLE EXISTING LEGACY PROJECTS TABLE
-- ============================================================================

-- First, rename the old projects table if it exists and has old structure
DO $$
BEGIN
    -- Check if old projects table exists with legacy structure (has user_id column but not client_id)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'projects'
        AND column_name = 'user_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'projects'
        AND column_name = 'client_id'
    ) THEN
        -- Rename old table to preserve data
        ALTER TABLE projects RENAME TO projects_legacy;
        RAISE NOTICE 'Renamed old projects table to projects_legacy';
    END IF;
END $$;

-- ============================================================================
-- PROJECTS TABLE (v2)
-- ============================================================================

-- Projects: Individual projects within a client account
-- Each client can have multiple projects, all sharing the same Context Lake
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,

    -- Identification
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived', 'completed')),

    -- Project metadata
    project_type TEXT,  -- campaign, evergreen, research, etc.
    start_date DATE,
    end_date DATE,

    -- Goals and KPIs
    goals JSONB DEFAULT '[]'::jsonb,  -- [{name, target, current, unit}]

    -- Settings and legacy data migration
    settings JSONB DEFAULT '{}'::jsonb,

    -- Legacy fields from old projects table (for migration)
    legacy_flow_config JSONB,
    legacy_variable_definitions JSONB,
    legacy_prompts JSONB,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT projects_name_check CHECK (char_length(name) >= 1 AND char_length(name) <= 200),
    CONSTRAINT projects_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    UNIQUE(client_id, slug)
);

COMMENT ON TABLE projects IS 'Projects within a client account. All projects share the client Context Lake.';
COMMENT ON COLUMN projects.client_id IS 'Parent client - projects inherit the client Context Lake';
COMMENT ON COLUMN projects.project_type IS 'Type: campaign, evergreen, research, content_series, etc.';
COMMENT ON COLUMN projects.goals IS 'Project goals: [{name, target, current, unit}]';

-- ============================================================================
-- UPDATE PLAYBOOK_EXECUTIONS TO REFERENCE PROJECT
-- ============================================================================

-- Add project_id to executions (optional - executions can be project-specific)
ALTER TABLE playbook_executions
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN playbook_executions.project_id IS 'Optional project context for this execution';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_slug ON projects(client_id, slug);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type) WHERE project_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_executions_project ON playbook_executions(project_id) WHERE project_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Agency owner manages projects" ON projects;

-- Projects: Access through client → agency ownership
CREATE POLICY "Agency owner manages projects"
    ON projects FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients
            JOIN agencies ON agencies.id = clients.agency_id
            WHERE clients.id = projects.client_id
            AND agencies.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Drop trigger if exists
DROP TRIGGER IF EXISTS projects_updated_at ON projects;

CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get client_id for a project (useful for Context Lake access)
CREATE OR REPLACE FUNCTION get_project_client_id(p_project_id UUID)
RETURNS UUID AS $$
DECLARE
    v_client_id UUID;
BEGIN
    SELECT client_id INTO v_client_id
    FROM projects
    WHERE id = p_project_id;

    RETURN v_client_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get all projects with their client info
CREATE OR REPLACE FUNCTION get_projects_with_clients(p_agency_id UUID)
RETURNS TABLE (
    project_id UUID,
    project_name TEXT,
    project_status TEXT,
    client_id UUID,
    client_name TEXT,
    agency_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id as project_id,
        p.name as project_name,
        p.status as project_status,
        c.id as client_id,
        c.name as client_name,
        c.agency_id
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE c.agency_id = p_agency_id
    ORDER BY c.name, p.name;
END;
$$ LANGUAGE plpgsql STABLE;
