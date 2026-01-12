-- =============================================================================
-- FIX RLS POLICIES FOR SHARED ACCESS
-- =============================================================================
-- Este SQL debe ejecutarse en Supabase Dashboard > SQL Editor
-- Permite que cualquier usuario autenticado vea todos los datos
-- =============================================================================

-- Drop existing restrictive policies on v2 tables
DROP POLICY IF EXISTS "Agency owner manages agency" ON agencies;
DROP POLICY IF EXISTS "Agency owner manages clients" ON clients;
DROP POLICY IF EXISTS "Agency owner manages documents" ON documents;
DROP POLICY IF EXISTS "Agency owner manages playbooks" ON playbooks;
DROP POLICY IF EXISTS "Agency owner manages executions" ON playbook_executions;

-- Drop existing policies (if renamed)
DROP POLICY IF EXISTS "Authenticated users access agencies" ON agencies;
DROP POLICY IF EXISTS "Authenticated users access clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users access documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users access playbooks" ON playbooks;
DROP POLICY IF EXISTS "Authenticated users access executions" ON playbook_executions;

-- Create permissive policies for authenticated users
CREATE POLICY "Authenticated users access agencies"
    ON agencies FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users access clients"
    ON clients FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users access documents"
    ON documents FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users access playbooks"
    ON playbooks FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users access executions"
    ON playbook_executions FOR ALL
    USING (auth.role() = 'authenticated');

-- Also fix legacy tables (projects, etc.) if they have RLS enabled
DROP POLICY IF EXISTS "Users manage own projects" ON projects;
DROP POLICY IF EXISTS "Users access projects" ON projects;
DROP POLICY IF EXISTS "Users manage docs in own projects" ON knowledge_base_docs;
DROP POLICY IF EXISTS "Users access docs" ON knowledge_base_docs;
DROP POLICY IF EXISTS "Users manage campaigns in own projects" ON ecp_campaigns;
DROP POLICY IF EXISTS "Users access campaigns" ON ecp_campaigns;
DROP POLICY IF EXISTS "Users view logs for own campaigns" ON execution_logs;
DROP POLICY IF EXISTS "Users access logs" ON execution_logs;

-- Create permissive policies for legacy tables
CREATE POLICY "Authenticated users access projects"
    ON projects FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users access kb docs"
    ON knowledge_base_docs FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users access campaigns"
    ON ecp_campaigns FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users access logs"
    ON execution_logs FOR ALL
    USING (auth.role() = 'authenticated');

-- Verify RLS is enabled
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- After running, test by:
-- 1. Logging in as alfonso@growth4u.io
-- 2. The clients should now be visible
-- =============================================================================
