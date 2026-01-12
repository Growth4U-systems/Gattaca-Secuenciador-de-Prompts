-- Gattaca v2: Data Migration
-- Version: 2.0.0
-- Description: Migrate existing data from v1 (projects, knowledge_base_docs) to v2 (agencies, clients, documents)

-- ============================================================================
-- STEP 1: Create agencies for existing users
-- ============================================================================

INSERT INTO agencies (id, name, slug, owner_id, created_at)
SELECT DISTINCT
    gen_random_uuid(),
    COALESCE(
        (SELECT raw_user_meta_data->>'company' FROM auth.users WHERE id = p.user_id),
        'Mi Agencia'
    ),
    LOWER(REGEXP_REPLACE(
        COALESCE(
            (SELECT raw_user_meta_data->>'company' FROM auth.users WHERE id = p.user_id),
            'agency-' || LEFT(p.user_id::text, 8)
        ),
        '[^a-z0-9]+', '-', 'g'
    )),
    p.user_id,
    MIN(p.created_at)
FROM projects p
WHERE NOT EXISTS (
    SELECT 1 FROM agencies a WHERE a.owner_id = p.user_id
)
GROUP BY p.user_id
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 2: Migrate projects to clients
-- ============================================================================

INSERT INTO clients (id, agency_id, name, slug, description, settings, created_at, updated_at)
SELECT
    p.id,
    a.id,
    p.name,
    LOWER(REGEXP_REPLACE(p.name, '[^a-z0-9]+', '-', 'g')) || '-' || LEFT(p.id::text, 4),
    p.description,
    jsonb_build_object(
        'legacy_flow_config', p.flow_config,
        'legacy_variable_definitions', p.variable_definitions,
        'legacy_context_config', p.context_config,
        'legacy_prompts', jsonb_build_object(
            'deep_research', p.prompt_deep_research,
            'find_place', p.prompt_1_find_place,
            'select_assets', p.prompt_2_select_assets,
            'proof_legit', p.prompt_3_proof_legit,
            'final_output', p.prompt_4_final_output
        )
    ),
    p.created_at,
    p.updated_at
FROM projects p
JOIN agencies a ON a.owner_id = p.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM clients c WHERE c.id = p.id
);

-- ============================================================================
-- STEP 3: Migrate knowledge_base_docs to documents
-- ============================================================================

INSERT INTO documents (
    id,
    client_id,
    title,
    slug,
    tier,
    document_type,
    content,
    content_format,
    authority_score,
    approval_status,
    source_type,
    source_file_name,
    token_count,
    created_at,
    updated_at
)
SELECT
    k.id,
    k.project_id,  -- Now points to clients table (same IDs)
    k.filename,
    LOWER(REGEXP_REPLACE(k.filename, '[^a-z0-9]+', '-', 'g')) || '-' || LEFT(k.id::text, 4),
    -- Map category to tier
    CASE k.category::text
        WHEN 'product' THEN 1
        WHEN 'competitor' THEN 2
        WHEN 'research' THEN 2
        WHEN 'output' THEN 3
        ELSE 3
    END,
    -- Keep category as document_type
    k.category::text,
    k.extracted_content,
    'text',
    -- Calculate authority based on tier
    CASE k.category::text
        WHEN 'product' THEN 0.9
        WHEN 'competitor' THEN 0.6
        WHEN 'research' THEN 0.6
        WHEN 'output' THEN 0.3
        ELSE 0.5
    END,
    'approved'::approval_status,
    'import',
    k.filename,
    k.token_count,
    k.created_at,
    k.created_at  -- Use created_at as updated_at for migrated docs
FROM knowledge_base_docs k
WHERE EXISTS (
    SELECT 1 FROM clients c WHERE c.id = k.project_id
)
AND NOT EXISTS (
    SELECT 1 FROM documents d WHERE d.id = k.id
);

-- ============================================================================
-- STEP 4: Create default playbooks from legacy flow_configs
-- ============================================================================

-- This creates a "Legacy Flow" playbook for each agency that had projects with flow_config
INSERT INTO playbooks (
    id,
    agency_id,
    name,
    slug,
    description,
    type,
    tags,
    config,
    version,
    status,
    created_at
)
SELECT DISTINCT ON (a.id)
    gen_random_uuid(),
    a.id,
    'Legacy ECP Flow',
    'legacy-ecp-flow',
    'Migrated from v1 project flow configuration',
    'playbook'::playbook_type,
    ARRAY['LEGACY', 'STRATEGY'],
    jsonb_build_object(
        'context_requirements', jsonb_build_object(
            'required_documents', '[]'::jsonb,
            'dynamic_queries', '[]'::jsonb
        ),
        'input_schema', jsonb_build_object(
            'ecp_name', jsonb_build_object('type', 'string', 'required', true),
            'problem_core', jsonb_build_object('type', 'string', 'required', true),
            'country', jsonb_build_object('type', 'string', 'required', true),
            'industry', jsonb_build_object('type', 'string', 'required', true)
        ),
        'blocks', '[]'::jsonb,
        'output_config', jsonb_build_object(
            'destination', 'asset_library',
            'asset_type', 'strategy_doc'
        ),
        'legacy', true
    ),
    '1.0.0',
    'active'::playbook_status,
    NOW()
FROM agencies a
JOIN clients c ON c.agency_id = a.id
WHERE NOT EXISTS (
    SELECT 1 FROM playbooks p WHERE p.agency_id = a.id AND p.slug = 'legacy-ecp-flow'
);

-- ============================================================================
-- STEP 5: Migrate ecp_campaigns to playbook_executions (optional, for history)
-- ============================================================================

INSERT INTO playbook_executions (
    id,
    playbook_id,
    client_id,
    input_data,
    status,
    block_outputs,
    started_at,
    completed_at,
    error_message,
    created_at,
    updated_at
)
SELECT
    e.id,
    (SELECT p.id FROM playbooks p WHERE p.agency_id = a.id AND p.slug = 'legacy-ecp-flow' LIMIT 1),
    e.project_id,
    jsonb_build_object(
        'ecp_name', e.ecp_name,
        'problem_core', e.problem_core,
        'country', e.country,
        'industry', e.industry
    ),
    CASE e.status
        WHEN 'completed' THEN 'completed'::execution_status
        WHEN 'error' THEN 'failed'::execution_status
        WHEN 'running' THEN 'running'::execution_status
        WHEN 'paused' THEN 'waiting_human'::execution_status
        ELSE 'pending'::execution_status
    END,
    jsonb_build_object(
        'deep_research', jsonb_build_object('output', e.deep_research_text, 'tokens', e.deep_research_tokens),
        'step_1', jsonb_build_object('output', e.output_1_find_place, 'tokens', e.output_1_tokens),
        'step_2', jsonb_build_object('output', e.output_2_select_assets, 'tokens', e.output_2_tokens),
        'step_3', jsonb_build_object('output', e.output_3_proof_legit, 'tokens', e.output_3_tokens),
        'step_4', jsonb_build_object('output', e.output_final_messages, 'tokens', e.output_final_tokens),
        'legacy_step_outputs', e.step_outputs
    ),
    e.created_at,
    CASE WHEN e.status = 'completed' THEN e.updated_at ELSE NULL END,
    e.error_message,
    e.created_at,
    e.updated_at
FROM ecp_campaigns e
JOIN clients c ON c.id = e.project_id
JOIN agencies a ON a.id = c.agency_id
WHERE NOT EXISTS (
    SELECT 1 FROM playbook_executions pe WHERE pe.id = e.id
);

-- ============================================================================
-- VERIFICATION QUERIES (run manually to check migration)
-- ============================================================================

-- Check agencies created
-- SELECT COUNT(*) as agencies_count FROM agencies;

-- Check clients migrated
-- SELECT COUNT(*) as clients_count FROM clients;

-- Check documents migrated
-- SELECT COUNT(*) as documents_count FROM documents;

-- Check tier distribution
-- SELECT tier, COUNT(*) FROM documents GROUP BY tier ORDER BY tier;

-- Verify all projects have corresponding clients
-- SELECT p.id, p.name, c.id as client_id
-- FROM projects p
-- LEFT JOIN clients c ON c.id = p.id
-- WHERE c.id IS NULL;

-- Verify all knowledge_base_docs have corresponding documents
-- SELECT k.id, k.filename, d.id as doc_id
-- FROM knowledge_base_docs k
-- LEFT JOIN documents d ON d.id = k.id
-- WHERE d.id IS NULL;
