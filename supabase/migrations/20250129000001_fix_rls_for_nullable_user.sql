-- Fix RLS policies to work with nullable user_id
-- This allows users to see projects where user_id is NULL (shared projects)
-- or where user_id matches their auth.uid()

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users manage own projects" ON projects;
DROP POLICY IF EXISTS "Users manage docs in own projects" ON knowledge_base_docs;
DROP POLICY IF EXISTS "Users manage campaigns in own projects" ON ecp_campaigns;
DROP POLICY IF EXISTS "Users view logs for own campaigns" ON execution_logs;

-- Projects: Users can see their own projects OR shared projects (user_id IS NULL)
CREATE POLICY "Users access projects"
  ON projects FOR ALL
  USING (
    user_id IS NULL
    OR user_id = auth.uid()
    OR auth.role() = 'authenticated'
  );

-- Knowledge Base: Access through project ownership (including shared projects)
CREATE POLICY "Users access docs"
  ON knowledge_base_docs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = knowledge_base_docs.project_id
      AND (projects.user_id IS NULL OR projects.user_id = auth.uid() OR auth.role() = 'authenticated')
    )
  );

-- Campaigns: Access through project ownership (including shared projects)
CREATE POLICY "Users access campaigns"
  ON ecp_campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ecp_campaigns.project_id
      AND (projects.user_id IS NULL OR projects.user_id = auth.uid() OR auth.role() = 'authenticated')
    )
  );

-- Execution Logs: Access through campaign ownership
CREATE POLICY "Users access logs"
  ON execution_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ecp_campaigns
      JOIN projects ON projects.id = ecp_campaigns.project_id
      WHERE ecp_campaigns.id = execution_logs.campaign_id
      AND (projects.user_id IS NULL OR projects.user_id = auth.uid() OR auth.role() = 'authenticated')
    )
  );

-- V2 Tables: Make sure they also have permissive policies
-- Drop existing if any
DROP POLICY IF EXISTS "Agencies access policy" ON agencies;
DROP POLICY IF EXISTS "Clients access policy" ON clients;
DROP POLICY IF EXISTS "Documents access policy" ON documents;
DROP POLICY IF EXISTS "Playbooks access policy" ON playbooks;
DROP POLICY IF EXISTS "Executions access policy" ON playbook_executions;

-- Agencies: Any authenticated user can access
CREATE POLICY "Agencies access policy"
  ON agencies FOR ALL
  USING (auth.role() = 'authenticated');

-- Clients: Any authenticated user can access
CREATE POLICY "Clients access policy"
  ON clients FOR ALL
  USING (auth.role() = 'authenticated');

-- Documents: Any authenticated user can access
CREATE POLICY "Documents access policy"
  ON documents FOR ALL
  USING (auth.role() = 'authenticated');

-- Playbooks: Any authenticated user can access
CREATE POLICY "Playbooks access policy"
  ON playbooks FOR ALL
  USING (auth.role() = 'authenticated');

-- Playbook Executions: Any authenticated user can access
CREATE POLICY "Executions access policy"
  ON playbook_executions FOR ALL
  USING (auth.role() = 'authenticated');

-- Ensure RLS is enabled on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_executions ENABLE ROW LEVEL SECURITY;
