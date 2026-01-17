-- Disable RLS on playbooks table to allow all users to view them
-- RLS was re-enabled by the base tables migration which runs after the disable migration

ALTER TABLE playbooks DISABLE ROW LEVEL SECURITY;

-- Also disable on agencies since playbooks reference it
ALTER TABLE agencies DISABLE ROW LEVEL SECURITY;
