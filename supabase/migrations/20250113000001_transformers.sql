-- ============================================================================
-- FOUNDATIONAL TRANSFORMERS SYSTEM
-- ============================================================================
-- This migration evolves the synthesis system into a transformer architecture:
-- 1. Dedicated prompts per foundational type (configurable by agency)
-- 2. Document versioning and history
-- 3. Stale detection when sources change after approval
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FOUNDATIONAL TRANSFORMERS TABLE
-- Agency-specific transformer configurations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS foundational_transformers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    foundational_type TEXT NOT NULL,

    -- Transformer configuration
    prompt TEXT NOT NULL,
    model TEXT DEFAULT 'anthropic/claude-sonnet-4',
    temperature FLOAT DEFAULT 0.3 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens INTEGER DEFAULT 8000 CHECK (max_tokens > 0 AND max_tokens <= 100000),

    -- Metadata
    name TEXT, -- Display name override
    description TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- One transformer per type per agency
    UNIQUE(agency_id, foundational_type),

    -- Valid foundational types
    CONSTRAINT valid_transformer_type CHECK (
        foundational_type IN (
            'brand_dna', 'icp', 'tone_of_voice',
            'product_docs', 'pricing', 'competitor_analysis'
        )
    )
);

CREATE INDEX idx_transformers_agency ON foundational_transformers(agency_id);
CREATE INDEX idx_transformers_type ON foundational_transformers(foundational_type);

-- ----------------------------------------------------------------------------
-- 2. DOCUMENT VERSIONING COLUMNS
-- Add version tracking to documents
-- ----------------------------------------------------------------------------

-- Version number (increments with each regeneration)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Reference to previous version for history chain
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- Stale flag: approved but sources have changed
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS is_stale BOOLEAN DEFAULT FALSE;

-- Hash of sources at generation time (for stale detection)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS sources_hash TEXT;

-- Index for version history queries
CREATE INDEX IF NOT EXISTS idx_documents_version_chain
    ON documents(previous_version_id)
    WHERE previous_version_id IS NOT NULL;

-- Index for stale documents
CREATE INDEX IF NOT EXISTS idx_documents_stale
    ON documents(client_id, is_stale)
    WHERE is_stale = TRUE;

-- ----------------------------------------------------------------------------
-- 3. INSERT DEFAULT TRANSFORMERS
-- Create default transformers for each foundational type
-- These will be copied to each agency when they're created
-- ----------------------------------------------------------------------------

-- Note: We'll insert these for agency_id = NULL as templates,
-- then copy to agencies when needed. For now, we use a placeholder.
-- In production, replace with actual default agency ID or use a migration function.

-- Create a function to get or create default transformers for an agency
CREATE OR REPLACE FUNCTION ensure_agency_transformers(p_agency_id UUID)
RETURNS void AS $$
BEGIN
    -- Brand DNA transformer
    INSERT INTO foundational_transformers (agency_id, foundational_type, name, prompt)
    VALUES (
        p_agency_id,
        'brand_dna',
        'Brand DNA Transformer',
        'Eres un experto en branding y estrategia de marca. Tu tarea es analizar los documentos proporcionados y crear un documento estructurado de Brand DNA.

## DOCUMENTOS FUENTE
{{sources}}

## INSTRUCCIONES
1. Analiza cuidadosamente todos los documentos fuente
2. Extrae la información relevante para cada sección
3. Sintetiza de forma coherente y profesional
4. NO inventes información - solo usa lo que encuentres en los documentos
5. Si alguna sección no tiene información, indica "[Información no disponible en documentos fuente]"

## SECCIONES REQUERIDAS

### Misión
El propósito fundamental de la marca, por qué existe.

### Visión
Hacia dónde se dirige la marca, su aspiración a futuro.

### Valores
Los principios que guían las decisiones y comportamiento.

### Personalidad de Marca
Características humanas que definen cómo se expresa la marca.
Incluye: Tono, actitud, arquetipos si los hay.

### Propuesta de Valor
Qué hace única a la marca y por qué los clientes la eligen.
Incluye: Diferenciadores clave, beneficios principales.

### Historia de la Marca (opcional)
Origen, evolución, momentos clave si están disponibles.

## FORMATO
Responde en markdown estructurado. Usa ## para secciones principales.
Sé conciso pero completo. Cada sección debe ser útil para crear contenido de marketing.'
    )
    ON CONFLICT (agency_id, foundational_type) DO NOTHING;

    -- ICP transformer
    INSERT INTO foundational_transformers (agency_id, foundational_type, name, prompt)
    VALUES (
        p_agency_id,
        'icp',
        'ICP / Buyer Persona Transformer',
        'Eres un experto en marketing y buyer personas. Analiza los documentos y crea un perfil de cliente ideal (ICP) estructurado.

## DOCUMENTOS FUENTE
{{sources}}

## INSTRUCCIONES
1. Identifica patrones sobre el cliente objetivo
2. Distingue entre datos demográficos y psicográficos
3. Enfócate en dolores reales y motivaciones de compra
4. NO inventes datos - solo usa información de los documentos

## SECCIONES REQUERIDAS

### Datos Demográficos
- Rango de edad
- Género (si es relevante)
- Ubicación geográfica
- Nivel socioeconómico
- Ocupación/Industria

### Psicografía
- Valores personales
- Intereses y hobbies
- Estilo de vida
- Motivaciones profundas

### Puntos de Dolor
- Problemas principales que enfrenta
- Frustraciones con soluciones actuales
- Necesidades no satisfechas

### Objetivos y Aspiraciones
- Qué quiere lograr
- Cómo define el éxito
- Metas a corto y largo plazo

### Comportamiento de Compra
- Cómo busca información
- Qué factores considera al decidir
- Objeciones comunes
- Canales preferidos

### Mensajes Clave
Qué mensajes resuenan más con este perfil.

## FORMATO
Markdown estructurado. Usa bullets para listas. Sé específico, no genérico.'
    )
    ON CONFLICT (agency_id, foundational_type) DO NOTHING;

    -- Tone of Voice transformer
    INSERT INTO foundational_transformers (agency_id, foundational_type, name, prompt)
    VALUES (
        p_agency_id,
        'tone_of_voice',
        'Tone of Voice Transformer',
        'Eres un experto en comunicación de marca. Crea una guía de Tone of Voice basada en los documentos.

## DOCUMENTOS FUENTE
{{sources}}

## INSTRUCCIONES
1. Identifica patrones de comunicación de la marca
2. Extrae ejemplos concretos de estilo
3. Define qué hacer y qué evitar
4. Considera adaptaciones por canal

## SECCIONES REQUERIDAS

### Personalidad de Voz
Describe la voz de la marca como si fuera una persona.
- Adjetivos que la definen (3-5)
- Cómo NO suena

### Estilo de Lenguaje
- Nivel de formalidad (escala 1-5)
- Vocabulario: técnico vs accesible
- Longitud de oraciones: cortas vs elaboradas
- Uso de jerga o términos propios

### Lo Que SÍ Hacemos
Ejemplos concretos de frases, expresiones, y estilos que representan bien la marca.

### Lo Que NO Hacemos
Ejemplos de lo que la marca NUNCA diría o haría en comunicación.

### Adaptaciones por Canal
Cómo varía el tono según:
- Redes sociales
- Email marketing
- Website
- Atención al cliente

### Ejemplos Prácticos
Al menos 3 ejemplos de antes/después mostrando cómo aplicar el tono.

## FORMATO
Markdown con ejemplos claros. Usa tablas si ayudan a comparar.'
    )
    ON CONFLICT (agency_id, foundational_type) DO NOTHING;

    -- Product Docs transformer
    INSERT INTO foundational_transformers (agency_id, foundational_type, name, prompt)
    VALUES (
        p_agency_id,
        'product_docs',
        'Product Documentation Transformer',
        'Eres un experto en producto. Sintetiza la documentación de producto en un documento unificado.

## DOCUMENTOS FUENTE
{{sources}}

## SECCIONES REQUERIDAS

### Descripción General
Qué es el producto/servicio, para quién es, qué problema resuelve.

### Características Principales
Lista de features con descripción breve de cada uno.

### Beneficios
Traducción de features a beneficios para el usuario.

### Diferenciadores
Qué lo hace único vs la competencia.

### Casos de Uso
Escenarios específicos donde el producto brilla.

### Estructura de Precios (si aplica)
Planes, tiers, o modelo de pricing.

### FAQs Comunes
Preguntas frecuentes sobre el producto.

## FORMATO
Markdown estructurado. Usa tablas para comparativas. Bullets para listas.'
    )
    ON CONFLICT (agency_id, foundational_type) DO NOTHING;

    -- Pricing transformer
    INSERT INTO foundational_transformers (agency_id, foundational_type, name, prompt)
    VALUES (
        p_agency_id,
        'pricing',
        'Pricing Strategy Transformer',
        'Analiza los documentos y crea un documento de estrategia de precios.

## DOCUMENTOS FUENTE
{{sources}}

## SECCIONES REQUERIDAS

### Modelo de Precios
- Tipo de pricing (suscripción, único, freemium, etc.)
- Moneda y periodicidad

### Planes/Tiers
Descripción de cada nivel de servicio.

### Tabla Comparativa
Features por plan.

### Justificación de Valor
Por qué el precio es adecuado para el valor entregado.

### Políticas
- Garantías
- Reembolsos
- Upgrades/Downgrades

## FORMATO
Usa tablas para comparativas de planes.'
    )
    ON CONFLICT (agency_id, foundational_type) DO NOTHING;

    -- Competitor Analysis transformer
    INSERT INTO foundational_transformers (agency_id, foundational_type, name, prompt)
    VALUES (
        p_agency_id,
        'competitor_analysis',
        'Competitor Analysis Transformer',
        'Sintetiza el análisis competitivo en un documento estructurado.

## DOCUMENTOS FUENTE
{{sources}}

## SECCIONES REQUERIDAS

### Competidores Principales
Lista de competidores con breve descripción.

### Análisis por Competidor
Para cada uno:
- Fortalezas
- Debilidades
- Posicionamiento
- Precio (si disponible)

### Mapa de Posicionamiento
Cómo se posiciona cada player en el mercado.

### Oportunidades Identificadas
Gaps en el mercado que podemos explotar.

### Amenazas
Riesgos competitivos a monitorear.

### Diferenciación Recomendada
Cómo distinguirnos de la competencia.

## FORMATO
Markdown con tablas comparativas. Una sección por competidor principal.'
    )
    ON CONFLICT (agency_id, foundational_type) DO NOTHING;

END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS
-- ----------------------------------------------------------------------------

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

-- Mark document as stale when sources change
-- This trigger fires when document_assignments change
CREATE OR REPLACE FUNCTION mark_documents_stale_on_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark any approved foundational document for this type as stale
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

-- Also mark stale when a source document is updated
CREATE OR REPLACE FUNCTION mark_foundational_stale_on_source_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger on content changes
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        -- Find all foundational types this document is assigned to
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

-- ----------------------------------------------------------------------------
-- 5. HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Get transformer for a foundational type (falls back to default schema if no custom)
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

    -- If no custom transformer, return from foundational_schemas
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

-- Get document version history
CREATE OR REPLACE FUNCTION get_document_versions(p_document_id UUID)
RETURNS TABLE (
    id UUID,
    version INTEGER,
    created_at TIMESTAMPTZ,
    approval_status TEXT,
    is_current BOOLEAN
) AS $$
WITH RECURSIVE version_chain AS (
    -- Start with the given document
    SELECT
        d.id,
        d.version,
        d.created_at,
        d.approval_status,
        d.previous_version_id,
        TRUE as is_current
    FROM documents d
    WHERE d.id = p_document_id

    UNION ALL

    -- Follow the previous_version_id chain
    SELECT
        d.id,
        d.version,
        d.created_at,
        d.approval_status,
        d.previous_version_id,
        FALSE as is_current
    FROM documents d
    JOIN version_chain vc ON d.id = vc.previous_version_id
)
SELECT
    vc.id,
    vc.version,
    vc.created_at,
    vc.approval_status,
    vc.is_current
FROM version_chain vc
ORDER BY vc.version DESC;
$$ LANGUAGE SQL;

-- Calculate sources hash for a foundational type
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

-- ----------------------------------------------------------------------------
-- 6. RLS POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE foundational_transformers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transformers for their agency"
    ON foundational_transformers FOR SELECT
    USING (
        agency_id IN (
            SELECT id FROM agencies WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage transformers for their agency"
    ON foundational_transformers FOR ALL
    USING (
        agency_id IN (
            SELECT id FROM agencies WHERE owner_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- MIGRATION COMPLETE
-- ----------------------------------------------------------------------------
COMMENT ON TABLE foundational_transformers IS 'Agency-specific transformer configurations for generating foundational documents';
COMMENT ON COLUMN documents.version IS 'Version number, increments with each regeneration';
COMMENT ON COLUMN documents.previous_version_id IS 'Reference to the previous version of this document';
COMMENT ON COLUMN documents.is_stale IS 'True when approved but source documents have changed';
COMMENT ON COLUMN documents.sources_hash IS 'Hash of source documents at generation time';
