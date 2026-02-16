-- Disable RLS on document_versions to fix document upload failures
-- The trigger create_initial_document_version() fires after INSERT on knowledge_base_docs
-- and tries to INSERT into document_versions, which fails because RLS blocks it.
-- This matches the pattern used in 20260119000002_disable_rls_knowledge_base_docs.sql

ALTER TABLE document_versions DISABLE ROW LEVEL SECURITY;
