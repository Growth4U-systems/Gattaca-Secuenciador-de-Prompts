-- Disable RLS on knowledge_base_docs to allow document operations
-- This matches the pattern used for other tables in 20250201000001_disable_rls_all_tables.sql
--
-- Bug: Moving documents to folders was failing because RLS was enabled
-- but the table was not included in the original RLS disable migration

ALTER TABLE knowledge_base_docs DISABLE ROW LEVEL SECURITY;
