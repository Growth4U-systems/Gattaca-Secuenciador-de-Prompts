-- Disable RLS on tables for development without authentication
-- WARNING: Enable RLS and proper policies before going to production

-- Disable RLS on legacy tables
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_docs DISABLE ROW LEVEL SECURITY;
ALTER TABLE ecp_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs DISABLE ROW LEVEL SECURITY;

-- Disable RLS on v2 tables (they were enabled in the v2 migration)
ALTER TABLE agencies DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks DISABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_executions DISABLE ROW LEVEL SECURITY;
