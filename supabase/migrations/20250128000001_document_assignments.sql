-- ============================================================================
-- DOCUMENT ASSIGNMENT & SYNTHESIS SYSTEM
-- ============================================================================
-- This migration creates the infrastructure for:
-- 1. Assigning multiple source documents to foundational types
-- 2. AI-powered synthesis of sources into unified documents
-- 3. Completeness scoring and validation
-- 4. Human-in-the-loop approval workflow
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DOCUMENT ASSIGNMENTS TABLE
-- Many-to-many: source documents → foundational types
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    source_document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    target_foundational_type TEXT NOT NULL,

    -- Ordering and weighting for synthesis priority
    display_order INTEGER DEFAULT 0,
    weight FLOAT DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 2),

    -- Metadata
    assigned_by UUID,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT,

    -- Prevent duplicate assignments
    UNIQUE(source_document_id, target_foundational_type),

    -- Ensure valid foundational types
    CONSTRAINT valid_foundational_type CHECK (
        target_foundational_type IN (
            'brand_dna', 'icp', 'tone_of_voice',
            'product_docs', 'pricing', 'competitor_analysis'
        )
    )
);

-- Indexes for common queries
CREATE INDEX idx_assignments_client_type
    ON document_assignments(client_id, target_foundational_type);
CREATE INDEX idx_assignments_source
    ON document_assignments(source_document_id);

-- ----------------------------------------------------------------------------
-- 2. SYNTHESIS JOBS TABLE
-- Tracks AI synthesis attempts and their results
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS synthesis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    foundational_type TEXT NOT NULL,

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (
        status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
    ),

    -- Input snapshot (for change detection)
    source_document_ids UUID[] NOT NULL,
    source_hash TEXT NOT NULL,

    -- Output reference
    synthesized_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,

    -- Execution details
    model_used TEXT,
    prompt_version TEXT DEFAULT '1.0',
    tokens_used JSONB, -- {input: X, output: Y, total: Z}

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),

    -- Prevent duplicate synthesis for same source state
    UNIQUE(client_id, foundational_type, source_hash)
);

CREATE INDEX idx_synthesis_client_type
    ON synthesis_jobs(client_id, foundational_type);
CREATE INDEX idx_synthesis_status
    ON synthesis_jobs(status) WHERE status IN ('pending', 'running');
CREATE INDEX idx_synthesis_output
    ON synthesis_jobs(synthesized_document_id) WHERE synthesized_document_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. COMPLETENESS SCORES TABLE
-- AI-evaluated completeness of foundational documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS completeness_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL UNIQUE,

    -- Overall score (0-100)
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),

    -- Section-by-section scores (JSONB for flexibility)
    section_scores JSONB DEFAULT '{}',
    -- Example for brand_dna:
    -- {
    --   "mission": { "score": 90, "present": true, "feedback": "Clear and concise" },
    --   "vision": { "score": 70, "present": true, "feedback": "Could be more specific" },
    --   "values": { "score": 85, "present": true, "feedback": "Well defined" },
    --   "personality": { "score": 0, "present": false, "feedback": "Missing section" },
    --   "value_proposition": { "score": 60, "present": true, "feedback": "Needs more detail" }
    -- }

    -- Missing elements
    missing_sections TEXT[] DEFAULT '{}',
    suggestions TEXT[] DEFAULT '{}',

    -- Evaluation metadata
    evaluated_at TIMESTAMPTZ DEFAULT now(),
    model_used TEXT,
    evaluation_version TEXT DEFAULT '1.0',

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_completeness_document
    ON completeness_scores(document_id);
CREATE INDEX idx_completeness_score
    ON completeness_scores(overall_score);

-- ----------------------------------------------------------------------------
-- 4. MODIFICATIONS TO DOCUMENTS TABLE
-- Add columns for synthesis and completeness tracking
-- ----------------------------------------------------------------------------

-- Add 'synthesized' to source_type enum
-- First, check if the constraint exists and drop it
DO $$
BEGIN
    ALTER TABLE documents
    DROP CONSTRAINT IF EXISTS documents_source_type_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Add new constraint with 'synthesized' option
ALTER TABLE documents
ADD CONSTRAINT documents_source_type_check
CHECK (source_type IS NULL OR source_type IN (
    'manual', 'enricher', 'ingestion', 'import',
    'playbook_output', 'synthesized'
));

-- Flag for compiled foundational documents
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS is_compiled_foundational BOOLEAN DEFAULT FALSE;

-- Reference to the synthesis job that created this document
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS synthesis_job_id UUID REFERENCES synthesis_jobs(id) ON DELETE SET NULL;

-- Completeness score (denormalized for quick access)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS completeness_score INTEGER CHECK (
    completeness_score IS NULL OR (completeness_score >= 0 AND completeness_score <= 100)
);

-- Approval workflow fields
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT FALSE;

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS reviewed_by UUID;

-- Index for finding synthesized foundational docs
CREATE INDEX IF NOT EXISTS idx_documents_compiled
    ON documents(client_id, is_compiled_foundational)
    WHERE is_compiled_foundational = TRUE;

-- Index for pending reviews
CREATE INDEX IF NOT EXISTS idx_documents_pending_review
    ON documents(client_id, requires_review)
    WHERE requires_review = TRUE;

-- ----------------------------------------------------------------------------
-- 5. FOUNDATIONAL SCHEMAS TABLE
-- Defines what each foundational type should contain
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS foundational_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    foundational_type TEXT NOT NULL UNIQUE,

    -- Schema definition
    required_sections JSONB NOT NULL,
    -- Example for brand_dna:
    -- [
    --   {"key": "mission", "label": "Misión", "weight": 20, "description": "..."},
    --   {"key": "vision", "label": "Visión", "weight": 15, "description": "..."},
    --   {"key": "values", "label": "Valores", "weight": 20, "description": "..."},
    --   {"key": "personality", "label": "Personalidad de Marca", "weight": 15, "description": "..."},
    --   {"key": "value_proposition", "label": "Propuesta de Valor", "weight": 30, "description": "..."}
    -- ]

    optional_sections JSONB DEFAULT '[]',

    -- Synthesis prompt template
    synthesis_prompt TEXT,

    -- Validation prompt template
    validation_prompt TEXT,

    -- Metadata
    tier INTEGER DEFAULT 1 CHECK (tier IN (1, 2, 3)),
    priority TEXT DEFAULT 'important' CHECK (priority IN ('critical', 'important', 'recommended')),

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default schemas for foundational types
INSERT INTO foundational_schemas (foundational_type, required_sections, tier, priority, synthesis_prompt, validation_prompt)
VALUES
(
    'brand_dna',
    '[
        {"key": "mission", "label": "Misión", "weight": 20, "description": "El propósito fundamental de la marca, por qué existe"},
        {"key": "vision", "label": "Visión", "weight": 15, "description": "Hacia dónde se dirige la marca, su aspiración a futuro"},
        {"key": "values", "label": "Valores", "weight": 20, "description": "Los principios que guían las decisiones y comportamiento"},
        {"key": "personality", "label": "Personalidad de Marca", "weight": 15, "description": "Características humanas que definen cómo se expresa la marca"},
        {"key": "value_proposition", "label": "Propuesta de Valor", "weight": 30, "description": "Qué hace única a la marca y por qué los clientes la eligen"}
    ]'::jsonb,
    1,
    'critical',
    'Eres un experto en branding y estrategia de marca. Tu tarea es sintetizar múltiples documentos fuente en UN documento unificado de Brand DNA.

## DOCUMENTOS FUENTE
{{sources}}

## INSTRUCCIONES
1. Analiza todos los documentos fuente cuidadosamente
2. Extrae la información relevante para cada sección del Brand DNA
3. Sintetiza la información de forma coherente y profesional
4. Resuelve contradicciones favoreciendo la información más completa/reciente
5. El resultado debe leerse como UN documento autoritativo

## SECCIONES REQUERIDAS
- **Misión**: El propósito fundamental, por qué existe la marca
- **Visión**: Hacia dónde se dirige, su aspiración a futuro
- **Valores**: Los principios que guían decisiones y comportamiento
- **Personalidad de Marca**: Características humanas de la marca
- **Propuesta de Valor**: Qué hace única a la marca

## FORMATO
Devuelve un documento markdown estructurado con headers claros (##).
NO incluyas atribuciones a fuentes - debe ser un documento unificado.
Si alguna sección no tiene información suficiente, indica claramente "[Información insuficiente]".',

    'Evalúa el siguiente documento de Brand DNA y determina qué tan completo está.

## DOCUMENTO
{{content}}

## SECCIONES A EVALUAR
1. Misión (20 puntos)
2. Visión (15 puntos)
3. Valores (20 puntos)
4. Personalidad de Marca (15 puntos)
5. Propuesta de Valor (30 puntos)

## INSTRUCCIONES
Para cada sección:
1. Determina si está presente (true/false)
2. Evalúa su calidad de 0 a 100
3. Proporciona feedback específico
4. Sugiere mejoras si es necesario

## FORMATO DE RESPUESTA (JSON)
{
    "overall_score": 75,
    "sections": {
        "mission": {"present": true, "score": 90, "feedback": "Clara y concisa"},
        "vision": {"present": true, "score": 70, "feedback": "Podría ser más específica"},
        "values": {"present": true, "score": 85, "feedback": "Bien definidos"},
        "personality": {"present": false, "score": 0, "feedback": "Sección faltante"},
        "value_proposition": {"present": true, "score": 60, "feedback": "Necesita más detalle"}
    },
    "missing": ["personality"],
    "suggestions": ["Agregar descripción de personalidad de marca", "Expandir propuesta de valor"]
}'
),
(
    'icp',
    '[
        {"key": "demographics", "label": "Datos Demográficos", "weight": 15, "description": "Edad, género, ubicación, nivel socioeconómico"},
        {"key": "psychographics", "label": "Psicografía", "weight": 20, "description": "Valores, intereses, estilo de vida, motivaciones"},
        {"key": "pain_points", "label": "Puntos de Dolor", "weight": 25, "description": "Problemas, frustraciones, necesidades no satisfechas"},
        {"key": "goals", "label": "Objetivos y Aspiraciones", "weight": 20, "description": "Qué quieren lograr, sus metas"},
        {"key": "buying_behavior", "label": "Comportamiento de Compra", "weight": 20, "description": "Cómo toman decisiones, qué valoran al comprar"}
    ]'::jsonb,
    1,
    'critical',
    'Eres un experto en marketing y buyer personas. Sintetiza los documentos fuente en un perfil de cliente ideal (ICP) unificado.

## DOCUMENTOS FUENTE
{{sources}}

## SECCIONES REQUERIDAS
- **Datos Demográficos**: Edad, género, ubicación, nivel socioeconómico
- **Psicografía**: Valores, intereses, estilo de vida, motivaciones
- **Puntos de Dolor**: Problemas y frustraciones principales
- **Objetivos y Aspiraciones**: Qué quieren lograr
- **Comportamiento de Compra**: Cómo toman decisiones',

    'Evalúa el ICP/Buyer Persona proporcionado...'
),
(
    'tone_of_voice',
    '[
        {"key": "personality_traits", "label": "Rasgos de Personalidad", "weight": 25, "description": "Características que definen cómo suena la marca"},
        {"key": "language_style", "label": "Estilo de Lenguaje", "weight": 25, "description": "Formal/informal, técnico/accesible, etc."},
        {"key": "do_examples", "label": "Ejemplos de Qué SÍ Hacer", "weight": 20, "description": "Frases y estilos que sí usar"},
        {"key": "dont_examples", "label": "Ejemplos de Qué NO Hacer", "weight": 20, "description": "Frases y estilos a evitar"},
        {"key": "channel_adaptations", "label": "Adaptaciones por Canal", "weight": 10, "description": "Cómo varía el tono según el canal"}
    ]'::jsonb,
    1,
    'critical',
    'Sintetiza las guías de comunicación en un documento de Tone of Voice unificado...',
    'Evalúa el documento de Tone of Voice...'
),
(
    'product_docs',
    '[
        {"key": "overview", "label": "Descripción General", "weight": 20, "description": "Qué es el producto/servicio"},
        {"key": "features", "label": "Características", "weight": 25, "description": "Funcionalidades y capacidades"},
        {"key": "benefits", "label": "Beneficios", "weight": 25, "description": "Valor que aporta al cliente"},
        {"key": "differentiators", "label": "Diferenciadores", "weight": 20, "description": "Qué lo hace único vs competencia"},
        {"key": "pricing", "label": "Precios", "weight": 10, "description": "Estructura de precios si aplica"}
    ]'::jsonb,
    1,
    'important',
    'Sintetiza la documentación de producto...',
    'Evalúa la documentación de producto...'
),
(
    'competitor_analysis',
    '[
        {"key": "competitors_list", "label": "Lista de Competidores", "weight": 20, "description": "Quiénes son los competidores principales"},
        {"key": "strengths_weaknesses", "label": "Fortalezas y Debilidades", "weight": 30, "description": "Análisis FODA de cada competidor"},
        {"key": "positioning", "label": "Posicionamiento", "weight": 25, "description": "Cómo se posiciona cada competidor"},
        {"key": "opportunities", "label": "Oportunidades", "weight": 25, "description": "Gaps y oportunidades identificadas"}
    ]'::jsonb,
    2,
    'recommended',
    'Sintetiza el análisis competitivo...',
    'Evalúa el análisis de competencia...'
)
ON CONFLICT (foundational_type) DO UPDATE SET
    required_sections = EXCLUDED.required_sections,
    synthesis_prompt = EXCLUDED.synthesis_prompt,
    validation_prompt = EXCLUDED.validation_prompt,
    updated_at = now();

-- ----------------------------------------------------------------------------
-- 6. TRIGGERS
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 7. HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Get all source documents for a foundational type
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

-- Check if synthesis is needed (sources changed)
CREATE OR REPLACE FUNCTION needs_resynthesis(
    p_client_id UUID,
    p_foundational_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_hash TEXT;
    v_last_hash TEXT;
BEGIN
    -- Calculate current hash of source documents
    SELECT md5(string_agg(d.id::text || d.updated_at::text, '|' ORDER BY d.id))
    INTO v_current_hash
    FROM document_assignments da
    JOIN documents d ON d.id = da.source_document_id
    WHERE da.client_id = p_client_id
      AND da.target_foundational_type = p_foundational_type;

    -- Get last successful synthesis hash
    SELECT source_hash INTO v_last_hash
    FROM synthesis_jobs
    WHERE client_id = p_client_id
      AND foundational_type = p_foundational_type
      AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

    -- If no previous synthesis or hash differs, needs resynthesis
    RETURN v_last_hash IS NULL OR v_current_hash != v_last_hash;
END;
$$ LANGUAGE plpgsql;

-- Get synthesized document for a foundational type
CREATE OR REPLACE FUNCTION get_synthesized_document(
    p_client_id UUID,
    p_foundational_type TEXT
)
RETURNS UUID AS $$
DECLARE
    v_doc_id UUID;
BEGIN
    SELECT d.id INTO v_doc_id
    FROM documents d
    WHERE d.client_id = p_client_id
      AND d.document_type = p_foundational_type
      AND d.is_compiled_foundational = TRUE
      AND d.approval_status = 'approved'
    ORDER BY d.updated_at DESC
    LIMIT 1;

    RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 8. RLS POLICIES (if RLS is enabled)
-- ----------------------------------------------------------------------------

-- Policies for document_assignments
ALTER TABLE document_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assignments for their agency's clients"
    ON document_assignments FOR SELECT
    USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN agencies a ON c.agency_id = a.id
            WHERE a.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage assignments for their agency's clients"
    ON document_assignments FOR ALL
    USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN agencies a ON c.agency_id = a.id
            WHERE a.owner_id = auth.uid()
        )
    );

-- Policies for synthesis_jobs
ALTER TABLE synthesis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view synthesis jobs for their agency's clients"
    ON synthesis_jobs FOR SELECT
    USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN agencies a ON c.agency_id = a.id
            WHERE a.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage synthesis jobs for their agency's clients"
    ON synthesis_jobs FOR ALL
    USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN agencies a ON c.agency_id = a.id
            WHERE a.owner_id = auth.uid()
        )
    );

-- Policies for completeness_scores
ALTER TABLE completeness_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view completeness scores for their documents"
    ON completeness_scores FOR SELECT
    USING (
        document_id IN (
            SELECT d.id FROM documents d
            JOIN clients c ON d.client_id = c.id
            JOIN agencies a ON c.agency_id = a.id
            WHERE a.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage completeness scores for their documents"
    ON completeness_scores FOR ALL
    USING (
        document_id IN (
            SELECT d.id FROM documents d
            JOIN clients c ON d.client_id = c.id
            JOIN agencies a ON c.agency_id = a.id
            WHERE a.owner_id = auth.uid()
        )
    );

-- Policies for foundational_schemas (read-only for most users)
ALTER TABLE foundational_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view foundational schemas"
    ON foundational_schemas FOR SELECT
    USING (true);

-- ----------------------------------------------------------------------------
-- MIGRATION COMPLETE
-- ----------------------------------------------------------------------------
COMMENT ON TABLE document_assignments IS 'Links source documents to foundational document types for synthesis';
COMMENT ON TABLE synthesis_jobs IS 'Tracks AI synthesis attempts and their outcomes';
COMMENT ON TABLE completeness_scores IS 'AI-evaluated completeness scores for documents';
COMMENT ON TABLE foundational_schemas IS 'Defines required sections and prompts for each foundational type';
