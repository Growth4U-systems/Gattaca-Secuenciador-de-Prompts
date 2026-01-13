-- Disable RLS on all tables for development
-- This allows operations without authentication requirements

-- Core tables
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agencies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS playbooks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS playbook_executions DISABLE ROW LEVEL SECURITY;

-- User/Auth related tables
ALTER TABLE IF EXISTS agency_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_share_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_openrouter_tokens DISABLE ROW LEVEL SECURITY;

-- Verify changes
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
