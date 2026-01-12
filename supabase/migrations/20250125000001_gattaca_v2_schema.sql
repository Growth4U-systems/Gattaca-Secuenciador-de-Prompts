-- Gattaca v2: Transformation to Playbook Orchestrator
-- Version: 2.0.0
-- Description: Multi-tenant architecture with agencies, clients, Context Lake, and playbooks

-- ============================================================================
-- NEW TYPES
-- ============================================================================

CREATE TYPE document_tier AS ENUM ('1', '2', '3');
CREATE TYPE approval_status AS ENUM ('draft', 'approved', 'archived');
CREATE TYPE playbook_type AS ENUM ('playbook', 'enricher');
CREATE TYPE playbook_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE execution_status AS ENUM ('pending', 'running', 'waiting_human', 'completed', 'failed', 'cancelled');

-- ============================================================================
-- NEW TABLES
-- ============================================================================

-- AGENCIES: Top-level organization (multi-tenant)
CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT agencies_name_check CHECK (char_length(name) >= 1 AND char_length(name) <= 200),
    CONSTRAINT agencies_slug_check CHECK (slug ~ '^[a-z0-9-]+$')
);

COMMENT ON TABLE agencies IS 'Top-level organization container for multi-tenancy';
COMMENT ON COLUMN agencies.slug IS 'URL-friendly identifier, e.g., growth4u';
COMMENT ON COLUMN agencies.settings IS 'Agency settings: timezone, default_model, branding, etc.';

-- CLIENTS: Client accounts within an agency (replaces projects conceptually)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    industry TEXT,
    website_url TEXT,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),

    -- Structured metadata
    competitors JSONB DEFAULT '[]'::jsonb,
    social_channels JSONB DEFAULT '{}'::jsonb,

    -- Settings and legacy data
    settings JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT clients_name_check CHECK (char_length(name) >= 1 AND char_length(name) <= 200),
    CONSTRAINT clients_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    UNIQUE(agency_id, slug)
);

COMMENT ON TABLE clients IS 'Client accounts within an agency, each with their own Context Lake';
COMMENT ON COLUMN clients.competitors IS 'Array of competitor objects: [{name, url, notes}]';
COMMENT ON COLUMN clients.social_channels IS 'Social channel URLs: {linkedin, twitter, instagram, ...}';

-- DOCUMENTS: Context Lake with tiers (replaces knowledge_base_docs)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,

    -- Identification
    title TEXT NOT NULL,
    slug TEXT NOT NULL,

    -- Tier system
    tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
    document_type TEXT NOT NULL,

    -- Content
    content TEXT,
    content_format TEXT DEFAULT 'markdown' CHECK (content_format IN ('markdown', 'json', 'text', 'html')),

    -- Authority metadata
    authority_score FLOAT DEFAULT 0.5 CHECK (authority_score >= 0 AND authority_score <= 1),
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approval_status approval_status DEFAULT 'draft',

    -- Temporal validity
    validity_start DATE DEFAULT CURRENT_DATE,
    validity_end DATE,

    -- Source tracking
    source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'enricher', 'ingestion', 'import', 'playbook_output')),
    source_id UUID,
    source_file_url TEXT,
    source_file_name TEXT,

    -- Token management
    token_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT documents_title_check CHECK (char_length(title) >= 1),
    CONSTRAINT documents_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    UNIQUE(client_id, slug)
);

COMMENT ON TABLE documents IS 'Context Lake: hierarchical document storage with tier-based authority';
COMMENT ON COLUMN documents.tier IS '1=La Verdad (immutable), 2=Operativo (expires), 3=Efímero (low authority)';
COMMENT ON COLUMN documents.document_type IS 'Type: brand_dna, icp, tone_of_voice, competitor_analysis, etc.';
COMMENT ON COLUMN documents.authority_score IS 'Computed authority 0-1, based on tier, author, approval';

-- PLAYBOOKS: Process templates at agency level
CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,

    -- Identification
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    type playbook_type NOT NULL,

    -- Classification
    tags TEXT[] DEFAULT '{}',

    -- Full configuration (blocks, prompts, context requirements, etc.)
    config JSONB NOT NULL,

    -- Versioning
    version TEXT DEFAULT '1.0.0',

    -- Status
    status playbook_status DEFAULT 'draft',

    -- Scheduling (for enrichers)
    schedule_enabled BOOLEAN DEFAULT FALSE,
    schedule_cron TEXT,
    schedule_timezone TEXT DEFAULT 'UTC',

    -- Authorship
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT playbooks_name_check CHECK (char_length(name) >= 1),
    CONSTRAINT playbooks_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    UNIQUE(agency_id, slug)
);

COMMENT ON TABLE playbooks IS 'Reusable process templates shared at agency level';
COMMENT ON COLUMN playbooks.type IS 'playbook=produces assets, enricher=feeds Context Lake';
COMMENT ON COLUMN playbooks.config IS 'Full playbook config: blocks, prompts, context_requirements, input_schema, output_config';

-- PLAYBOOK_EXECUTIONS: Execution instances
CREATE TABLE playbook_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,

    -- User input
    input_data JSONB DEFAULT '{}'::jsonb,

    -- Status
    status execution_status DEFAULT 'pending',
    current_block_id TEXT,

    -- Block outputs
    block_outputs JSONB DEFAULT '{}'::jsonb,

    -- HITL state
    hitl_pending JSONB,

    -- Context snapshot (docs used)
    context_snapshot JSONB DEFAULT '{}'::jsonb,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Errors
    error_message TEXT,

    -- Metadata
    triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE playbook_executions IS 'Individual execution instances of playbooks';
COMMENT ON COLUMN playbook_executions.block_outputs IS 'Outputs per block: {block_id: {output, tokens, status, ...}}';
COMMENT ON COLUMN playbook_executions.hitl_pending IS 'Pending human decision: {block_id, interface_config, options, ...}';

-- ============================================================================
-- MODIFY EXISTING TABLES
-- ============================================================================

-- Add new columns to execution_logs for v2 compatibility
ALTER TABLE execution_logs
    ADD COLUMN IF NOT EXISTS execution_id UUID REFERENCES playbook_executions(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS block_id TEXT,
    ADD COLUMN IF NOT EXISTS prompt_id TEXT,
    ADD COLUMN IF NOT EXISTS provider TEXT;

-- Update status constraint to include new statuses
ALTER TABLE ecp_campaigns
    DROP CONSTRAINT IF EXISTS ecp_campaigns_status_check;

-- Update any invalid status values to 'draft' before adding constraint
UPDATE ecp_campaigns
SET status = 'draft'
WHERE status NOT IN (
    'pending_research', 'research_complete',
    'step_1_running', 'step_1_complete',
    'step_2_running', 'step_2_complete',
    'step_3_running', 'step_3_complete',
    'step_4_running', 'completed', 'error',
    'draft', 'running', 'paused', 'pending', 'waiting_human', 'failed', 'cancelled'
);

ALTER TABLE ecp_campaigns
    ADD CONSTRAINT ecp_campaigns_status_check CHECK (status IN (
        'pending_research', 'research_complete',
        'step_1_running', 'step_1_complete',
        'step_2_running', 'step_2_complete',
        'step_3_running', 'step_3_complete',
        'step_4_running', 'completed', 'error',
        'draft', 'running', 'paused', 'pending', 'waiting_human', 'failed', 'cancelled'
    ));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_agencies_owner ON agencies(owner_id);
CREATE INDEX idx_agencies_slug ON agencies(slug);

CREATE INDEX idx_clients_agency ON clients(agency_id);
CREATE INDEX idx_clients_slug ON clients(agency_id, slug);
CREATE INDEX idx_clients_status ON clients(status);

CREATE INDEX idx_documents_client ON documents(client_id);
CREATE INDEX idx_documents_client_tier ON documents(client_id, tier);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_validity ON documents(validity_end) WHERE validity_end IS NOT NULL;
CREATE INDEX idx_documents_slug ON documents(client_id, slug);

CREATE INDEX idx_playbooks_agency ON playbooks(agency_id);
CREATE INDEX idx_playbooks_agency_type ON playbooks(agency_id, type);
CREATE INDEX idx_playbooks_tags ON playbooks USING gin(tags);
CREATE INDEX idx_playbooks_status ON playbooks(status);

CREATE INDEX idx_executions_playbook ON playbook_executions(playbook_id);
CREATE INDEX idx_executions_client ON playbook_executions(client_id);
CREATE INDEX idx_executions_status ON playbook_executions(status);
CREATE INDEX idx_executions_created ON playbook_executions(created_at DESC);

CREATE INDEX idx_logs_execution ON execution_logs(execution_id) WHERE execution_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_executions ENABLE ROW LEVEL SECURITY;

-- Agencies: Owner can manage
CREATE POLICY "Agency owner manages agency"
    ON agencies FOR ALL
    USING (auth.uid() = owner_id);

-- Clients: Access through agency ownership
CREATE POLICY "Agency owner manages clients"
    ON clients FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agencies
            WHERE agencies.id = clients.agency_id
            AND agencies.owner_id = auth.uid()
        )
    );

-- Documents: Access through client → agency ownership
CREATE POLICY "Agency owner manages documents"
    ON documents FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients
            JOIN agencies ON agencies.id = clients.agency_id
            WHERE clients.id = documents.client_id
            AND agencies.owner_id = auth.uid()
        )
    );

-- Playbooks: Access through agency ownership
CREATE POLICY "Agency owner manages playbooks"
    ON playbooks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agencies
            WHERE agencies.id = playbooks.agency_id
            AND agencies.owner_id = auth.uid()
        )
    );

-- Executions: Access through client → agency ownership
CREATE POLICY "Agency owner manages executions"
    ON playbook_executions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients
            JOIN agencies ON agencies.id = clients.agency_id
            WHERE clients.id = playbook_executions.client_id
            AND agencies.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers for new tables
CREATE TRIGGER agencies_updated_at
    BEFORE UPDATE ON agencies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER playbooks_updated_at
    BEFORE UPDATE ON playbooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER executions_updated_at
    BEFORE UPDATE ON playbook_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Token estimation for documents
CREATE OR REPLACE FUNCTION estimate_document_tokens()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.content IS NOT NULL THEN
        NEW.token_count = CEIL(char_length(NEW.content)::numeric / 4);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_estimate_tokens
    BEFORE INSERT OR UPDATE OF content ON documents
    FOR EACH ROW
    EXECUTE FUNCTION estimate_document_tokens();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get agency for a user (creates one if doesn't exist)
CREATE OR REPLACE FUNCTION get_or_create_user_agency(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_agency_id UUID;
BEGIN
    -- Try to find existing agency
    SELECT id INTO v_agency_id
    FROM agencies
    WHERE owner_id = p_user_id
    LIMIT 1;

    -- Create if not exists
    IF v_agency_id IS NULL THEN
        INSERT INTO agencies (name, slug, owner_id)
        VALUES (
            'Mi Agencia',
            'agency-' || LEFT(p_user_id::text, 8),
            p_user_id
        )
        RETURNING id INTO v_agency_id;
    END IF;

    RETURN v_agency_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate authority score
CREATE OR REPLACE FUNCTION calculate_authority_score(
    p_tier INTEGER,
    p_approval_status approval_status
)
RETURNS FLOAT AS $$
DECLARE
    tier_weight FLOAT;
    approval_weight FLOAT;
BEGIN
    -- Tier weight (50% of score)
    tier_weight := CASE p_tier
        WHEN 1 THEN 1.0
        WHEN 2 THEN 0.6
        WHEN 3 THEN 0.2
        ELSE 0.2
    END;

    -- Approval weight (50% of score)
    approval_weight := CASE p_approval_status
        WHEN 'approved' THEN 1.0
        WHEN 'draft' THEN 0.5
        WHEN 'archived' THEN 0.1
        ELSE 0.5
    END;

    RETURN (tier_weight * 0.5) + (approval_weight * 0.5);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-calculate authority score on insert/update
CREATE OR REPLACE FUNCTION auto_authority_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.authority_score := calculate_authority_score(NEW.tier, NEW.approval_status);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_auto_authority
    BEFORE INSERT OR UPDATE OF tier, approval_status ON documents
    FOR EACH ROW
    EXECUTE FUNCTION auto_authority_score();
