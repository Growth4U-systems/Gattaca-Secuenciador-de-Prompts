-- ============================================================================
-- COMBINED MIGRATION: Document Assignments + Transformers
-- ============================================================================
-- Apply this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/zgzhpnxtyidugrrmwqar/sql
-- ============================================================================

-- ============================================================================
-- PART 1: DOCUMENT ASSIGNMENTS SYSTEM
-- ============================================================================

-- 1. DOCUMENT ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS document_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    source_document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    target_foundational_type TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    weight FLOAT DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 2),
    assigned_by UUID,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    UNIQUE(source_document_id, target_foundational_type),
    CONSTRAINT valid_foundational_type CHECK (
        target_foundational_type IN (
            'brand_dna', 'icp', 'tone_of_voice',
            'product_docs', 'pricing', 'competitor_analysis'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_assignments_client_type
    ON document_assignments(client_id, target_foundational_type);
CREATE INDEX IF NOT EXISTS idx_assignments_source
    ON document_assignments(source_document_id);

-- 2. SYNTHESIS JOBS TABLE
CREATE TABLE IF NOT EXISTS synthesis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    foundational_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (
        status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
    ),
    source_document_ids UUID[] NOT NULL,
    source_hash TEXT NOT NULL,
    synthesized_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    model_used TEXT,
    prompt_version TEXT DEFAULT '1.0',
    tokens_used JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, foundational_type, source_hash)
);

CREATE INDEX IF NOT EXISTS idx_synthesis_client_type
    ON synthesis_jobs(client_id, foundational_type);
CREATE INDEX IF NOT EXISTS idx_synthesis_status
    ON synthesis_jobs(status) WHERE status IN ('pending', 'running');

-- 3. COMPLETENESS SCORES TABLE
CREATE TABLE IF NOT EXISTS completeness_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL UNIQUE,
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    section_scores JSONB DEFAULT '{}',
    missing_sections TEXT[] DEFAULT '{}',
    suggestions TEXT[] DEFAULT '{}',
    evaluated_at TIMESTAMPTZ DEFAULT now(),
    model_used TEXT,
    evaluation_version TEXT DEFAULT '1.0',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_completeness_document
    ON completeness_scores(document_id);

-- 4. FOUNDATIONAL SCHEMAS TABLE
CREATE TABLE IF NOT EXISTS foundational_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    foundational_type TEXT NOT NULL UNIQUE,
    required_sections JSONB NOT NULL,
    optional_sections JSONB DEFAULT '[]',
    synthesis_prompt TEXT,
    validation_prompt TEXT,
    tier INTEGER DEFAULT 1 CHECK (tier IN (1, 2, 3)),
    priority TEXT DEFAULT 'important' CHECK (priority IN ('critical', 'important', 'recommended')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ADD COLUMNS TO DOCUMENTS TABLE
DO $$
BEGIN
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_source_type_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE documents
ADD CONSTRAINT documents_source_type_check
CHECK (source_type IS NULL OR source_type IN (
    'manual', 'enricher', 'ingestion', 'import',
    'playbook_output', 'synthesized'
));

ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_compiled_foundational BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS synthesis_job_id UUID REFERENCES synthesis_jobs(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS completeness_score INTEGER CHECK (
    completeness_score IS NULL OR (completeness_score >= 0 AND completeness_score <= 100)
);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_by UUID;

CREATE INDEX IF NOT EXISTS idx_documents_compiled
    ON documents(client_id, is_compiled_foundational)
    WHERE is_compiled_foundational = TRUE;

-- ============================================================================
-- PART 2: FOUNDATIONAL TRANSFORMERS SYSTEM
-- ============================================================================

-- 1. FOUNDATIONAL TRANSFORMERS TABLE
CREATE TABLE IF NOT EXISTS foundational_transformers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    foundational_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    model TEXT DEFAULT 'anthropic/claude-sonnet-4',
    temperature FLOAT DEFAULT 0.3 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens INTEGER DEFAULT 8000 CHECK (max_tokens > 0 AND max_tokens <= 100000),
    name TEXT,
    description TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agency_id, foundational_type),
    CONSTRAINT valid_transformer_type CHECK (
        foundational_type IN (
            'brand_dna', 'icp', 'tone_of_voice',
            'product_docs', 'pricing', 'competitor_analysis'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_transformers_agency ON foundational_transformers(agency_id);
CREATE INDEX IF NOT EXISTS idx_transformers_type ON foundational_transformers(foundational_type);

-- 2. ADD VERSIONING COLUMNS TO DOCUMENTS
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_stale BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sources_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_version_chain
    ON documents(previous_version_id)
    WHERE previous_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_stale
    ON documents(client_id, is_stale)
    WHERE is_stale = TRUE;

-- ============================================================================
-- PART 3: DEFAULT DATA
-- ============================================================================

-- Insert default foundational schemas
INSERT INTO foundational_schemas (foundational_type, required_sections, tier, priority, synthesis_prompt, validation_prompt)
VALUES
(
    'brand_dna',
    '[
        {"key": "mission", "label": "Misión", "weight": 20, "description": "El propósito fundamental de la marca"},
        {"key": "vision", "label": "Visión", "weight": 15, "description": "Hacia dónde se dirige la marca"},
        {"key": "values", "label": "Valores", "weight": 20, "description": "Los principios que guían las decisiones"},
        {"key": "personality", "label": "Personalidad de Marca", "weight": 15, "description": "Características humanas de la marca"},
        {"key": "value_proposition", "label": "Propuesta de Valor", "weight": 30, "description": "Qué hace única a la marca"}
    ]'::jsonb,
    1,
    'critical',
    'Eres un experto en branding. Sintetiza los documentos fuente en un Brand DNA unificado.

## DOCUMENTOS FUENTE
{{sources}}

## SECCIONES REQUERIDAS
- **Misión**: El propósito fundamental
- **Visión**: Hacia dónde se dirige
- **Valores**: Principios que guían decisiones
- **Personalidad de Marca**: Características humanas
- **Propuesta de Valor**: Qué hace única a la marca

Devuelve markdown estructurado.',
    'Evalúa el Brand DNA y determina su completitud. Responde en JSON con overall_score (0-100), sections, missing, suggestions.'
),
(
    'icp',
    '[
        {"key": "demographics", "label": "Datos Demográficos", "weight": 15},
        {"key": "psychographics", "label": "Psicografía", "weight": 20},
        {"key": "pain_points", "label": "Puntos de Dolor", "weight": 25},
        {"key": "goals", "label": "Objetivos", "weight": 20},
        {"key": "buying_behavior", "label": "Comportamiento de Compra", "weight": 20}
    ]'::jsonb,
    1,
    'critical',
    'Sintetiza los documentos en un ICP unificado.',
    'Evalúa el ICP. Responde en JSON.'
),
(
    'tone_of_voice',
    '[
        {"key": "personality_traits", "label": "Rasgos de Personalidad", "weight": 25},
        {"key": "language_style", "label": "Estilo de Lenguaje", "weight": 25},
        {"key": "do_examples", "label": "Qué SÍ Hacer", "weight": 20},
        {"key": "dont_examples", "label": "Qué NO Hacer", "weight": 20},
        {"key": "channel_adaptations", "label": "Adaptaciones por Canal", "weight": 10}
    ]'::jsonb,
    1,
    'critical',
    'Sintetiza las guías en un Tone of Voice unificado.',
    'Evalúa el Tone of Voice. Responde en JSON.'
),
(
    'product_docs',
    '[
        {"key": "overview", "label": "Descripción General", "weight": 20},
        {"key": "features", "label": "Características", "weight": 25},
        {"key": "benefits", "label": "Beneficios", "weight": 25},
        {"key": "differentiators", "label": "Diferenciadores", "weight": 20},
        {"key": "pricing", "label": "Precios", "weight": 10}
    ]'::jsonb,
    1,
    'important',
    'Sintetiza la documentación de producto.',
    'Evalúa la documentación. Responde en JSON.'
),
(
    'competitor_analysis',
    '[
        {"key": "competitors_list", "label": "Lista de Competidores", "weight": 20},
        {"key": "strengths_weaknesses", "label": "Fortalezas y Debilidades", "weight": 30},
        {"key": "positioning", "label": "Posicionamiento", "weight": 25},
        {"key": "opportunities", "label": "Oportunidades", "weight": 25}
    ]'::jsonb,
    2,
    'recommended',
    'Sintetiza el análisis competitivo.',
    'Evalúa el análisis. Responde en JSON.'
),
(
    'pricing',
    '[
        {"key": "model", "label": "Modelo de Precios", "weight": 30},
        {"key": "tiers", "label": "Planes/Tiers", "weight": 30},
        {"key": "comparison", "label": "Comparativa", "weight": 20},
        {"key": "policies", "label": "Políticas", "weight": 20}
    ]'::jsonb,
    1,
    'important',
    'Sintetiza la estrategia de precios.',
    'Evalúa la documentación de precios. Responde en JSON.'
)
ON CONFLICT (foundational_type) DO UPDATE SET
    required_sections = EXCLUDED.required_sections,
    synthesis_prompt = EXCLUDED.synthesis_prompt,
    validation_prompt = EXCLUDED.validation_prompt,
    updated_at = now();

-- ============================================================================
-- PART 4: TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Update timestamp trigger for completeness_scores
CREATE OR REPLACE FUNCTION update_completeness_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS completeness_scores_updated_at ON completeness_scores;
CREATE TRIGGER completeness_scores_updated_at
    BEFORE UPDATE ON completeness_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_completeness_updated_at();

-- Sync completeness score to documents table
CREATE OR REPLACE FUNCTION sync_completeness_to_document()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE documents
    SET completeness_score = NEW.overall_score,
        updated_at = now()
    WHERE id = NEW.document_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_completeness_score ON completeness_scores;
CREATE TRIGGER sync_completeness_score
    AFTER INSERT OR UPDATE ON completeness_scores
    FOR EACH ROW
    EXECUTE FUNCTION sync_completeness_to_document();

-- Update timestamp trigger for foundational_transformers
CREATE OR REPLACE FUNCTION update_transformers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transformers_updated_at ON foundational_transformers;
CREATE TRIGGER transformers_updated_at
    BEFORE UPDATE ON foundational_transformers
    FOR EACH ROW
    EXECUTE FUNCTION update_transformers_updated_at();

-- Mark documents as stale when assignments change
CREATE OR REPLACE FUNCTION mark_documents_stale_on_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE documents
    SET is_stale = TRUE,
        updated_at = now()
    WHERE client_id = COALESCE(NEW.client_id, OLD.client_id)
      AND document_type = COALESCE(NEW.target_foundational_type, OLD.target_foundational_type)
      AND is_compiled_foundational = TRUE
      AND approval_status = 'approved';
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assignments_mark_stale ON document_assignments;
CREATE TRIGGER assignments_mark_stale
    AFTER INSERT OR UPDATE OR DELETE ON document_assignments
    FOR EACH ROW
    EXECUTE FUNCTION mark_documents_stale_on_assignment_change();

-- Mark foundational stale on source document update
CREATE OR REPLACE FUNCTION mark_foundational_stale_on_source_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        UPDATE documents d
        SET is_stale = TRUE,
            updated_at = now()
        FROM document_assignments da
        WHERE da.source_document_id = NEW.id
          AND d.client_id = da.client_id
          AND d.document_type = da.target_foundational_type
          AND d.is_compiled_foundational = TRUE
          AND d.approval_status = 'approved';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS source_doc_mark_stale ON documents;
CREATE TRIGGER source_doc_mark_stale
    AFTER UPDATE ON documents
    FOR EACH ROW
    WHEN (OLD.content IS DISTINCT FROM NEW.content)
    EXECUTE FUNCTION mark_foundational_stale_on_source_update();

-- ============================================================================
-- PART 5: HELPER FUNCTIONS
-- ============================================================================

-- Get assigned sources for a foundational type
CREATE OR REPLACE FUNCTION get_assigned_sources(
    p_client_id UUID,
    p_foundational_type TEXT
)
RETURNS TABLE (
    document_id UUID,
    title TEXT,
    content TEXT,
    weight FLOAT,
    display_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id as document_id,
        d.title,
        d.content,
        da.weight,
        da.display_order
    FROM document_assignments da
    JOIN documents d ON d.id = da.source_document_id
    WHERE da.client_id = p_client_id
      AND da.target_foundational_type = p_foundational_type
    ORDER BY da.display_order ASC, da.weight DESC;
END;
$$ LANGUAGE plpgsql;

-- Check if synthesis is needed
CREATE OR REPLACE FUNCTION needs_resynthesis(
    p_client_id UUID,
    p_foundational_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_hash TEXT;
    v_last_hash TEXT;
BEGIN
    SELECT md5(string_agg(d.id::text || d.updated_at::text, '|' ORDER BY d.id))
    INTO v_current_hash
    FROM document_assignments da
    JOIN documents d ON d.id = da.source_document_id
    WHERE da.client_id = p_client_id
      AND da.target_foundational_type = p_foundational_type;

    SELECT source_hash INTO v_last_hash
    FROM synthesis_jobs
    WHERE client_id = p_client_id
      AND foundational_type = p_foundational_type
      AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

    RETURN v_last_hash IS NULL OR v_current_hash != v_last_hash;
END;
$$ LANGUAGE plpgsql;

-- Get transformer for a foundational type
CREATE OR REPLACE FUNCTION get_transformer(
    p_agency_id UUID,
    p_foundational_type TEXT
)
RETURNS TABLE (
    id UUID,
    prompt TEXT,
    model TEXT,
    temperature FLOAT,
    max_tokens INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ft.id,
        ft.prompt,
        ft.model,
        ft.temperature,
        ft.max_tokens
    FROM foundational_transformers ft
    WHERE ft.agency_id = p_agency_id
      AND ft.foundational_type = p_foundational_type;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            fs.id,
            fs.synthesis_prompt as prompt,
            'anthropic/claude-sonnet-4'::TEXT as model,
            0.3::FLOAT as temperature,
            8000::INTEGER as max_tokens
        FROM foundational_schemas fs
        WHERE fs.foundational_type = p_foundational_type;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Calculate sources hash
CREATE OR REPLACE FUNCTION calculate_sources_hash(
    p_client_id UUID,
    p_foundational_type TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_hash TEXT;
BEGIN
    SELECT md5(string_agg(
        d.id::text || '|' || COALESCE(d.content, '') || '|' || d.updated_at::text,
        '||'
        ORDER BY da.display_order, d.id
    ))
    INTO v_hash
    FROM document_assignments da
    JOIN documents d ON d.id = da.source_document_id
    WHERE da.client_id = p_client_id
      AND da.target_foundational_type = p_foundational_type;

    RETURN COALESCE(v_hash, 'empty');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 6: DISABLE RLS FOR DEV (remove in production!)
-- ============================================================================

ALTER TABLE document_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE completeness_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE foundational_schemas DISABLE ROW LEVEL SECURITY;
ALTER TABLE foundational_transformers DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- Now verify by running:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- ============================================================================
