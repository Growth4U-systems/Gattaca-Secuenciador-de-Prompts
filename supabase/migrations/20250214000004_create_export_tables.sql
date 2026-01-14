-- Migration: Create Export Tables for ECP Data
-- Description: Creates 3 tables to store parsed step outputs for CSV export
-- Based on actual Monzo project output format

-- Tabla 1: Find Your Place to Win (Step 4)
-- Combina dos tablas del output:
--   1. Evaluation Criteria: Evaluation Criteria | Relevance | Justification
--   2. Competitive Positioning Map: Evaluation Criteria | [Competitor] Score | Analysis & Opportunity
CREATE TABLE IF NOT EXISTS export_find_place (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES ecp_campaigns(id) ON DELETE CASCADE,
  ecp_name TEXT NOT NULL,

  -- Datos de Tabla 1: Evaluation Criteria
  evaluation_criterion TEXT NOT NULL,
  relevance TEXT,           -- Critical, High, Medium-High, Medium, Low
  justification TEXT,

  -- Datos de Tabla 2: Competitive Positioning Map
  -- Scores de competidores (JSONB para flexibilidad ya que varian por ECP)
  -- Formato: {"CIRCE": {"score": 3}, "Qonto": {"score": 5}, "BBVA": {"score": 4}, ...}
  competitor_scores JSONB DEFAULT '{}',

  -- Analisis y oportunidad (ultima columna de tabla 2)
  analysis_opportunity TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, evaluation_criterion)
);

CREATE INDEX IF NOT EXISTS idx_export_find_place_project ON export_find_place(project_id);
CREATE INDEX IF NOT EXISTS idx_export_find_place_campaign ON export_find_place(campaign_id);

-- Tabla 2: Prove That You Are Legit (Step 5 + Step 6)
-- Combina datos de:
--   Step 5 (Select Assets): Asset | Value Criteria | Category | Justification for Differentiation
--   Step 6 (Proof Points): Unique Asset | Competitive Advantage | Benefit for the User | Proof
CREATE TABLE IF NOT EXISTS export_prove_legit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES ecp_campaigns(id) ON DELETE CASCADE,
  ecp_name TEXT NOT NULL,

  -- Datos de Select Assets (step 5)
  asset_name TEXT NOT NULL,
  value_criteria TEXT,
  category TEXT,            -- Differentiator, Qualifier
  justification_differentiation TEXT,

  -- Datos de Proof Points (step 6)
  competitive_advantage TEXT,
  benefit_for_user TEXT,
  proof TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, asset_name)
);

CREATE INDEX IF NOT EXISTS idx_export_prove_legit_project ON export_prove_legit(project_id);
CREATE INDEX IF NOT EXISTS idx_export_prove_legit_campaign ON export_prove_legit(campaign_id);

-- Tabla 3: USP y UVP (Step 7)
-- Mensajes de positioning: Message Category | Hypothesis | Value Criteria | Objective | Final Message (EN) | Final Message (ES)
CREATE TABLE IF NOT EXISTS export_usp_uvp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES ecp_campaigns(id) ON DELETE CASCADE,
  ecp_name TEXT NOT NULL,

  -- Datos del mensaje
  message_category TEXT NOT NULL,  -- Core UVP, USP: Pre-CIF Onboarding, USP: Human Support, etc.
  hypothesis TEXT,
  value_criteria TEXT,
  objective TEXT,
  message_en TEXT,
  message_es TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, message_category)
);

CREATE INDEX IF NOT EXISTS idx_export_usp_uvp_project ON export_usp_uvp(project_id);
CREATE INDEX IF NOT EXISTS idx_export_usp_uvp_campaign ON export_usp_uvp(campaign_id);

-- Trigger para actualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_export_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_export_find_place_updated_at ON export_find_place;
CREATE TRIGGER update_export_find_place_updated_at
  BEFORE UPDATE ON export_find_place
  FOR EACH ROW EXECUTE FUNCTION update_export_updated_at();

DROP TRIGGER IF EXISTS update_export_prove_legit_updated_at ON export_prove_legit;
CREATE TRIGGER update_export_prove_legit_updated_at
  BEFORE UPDATE ON export_prove_legit
  FOR EACH ROW EXECUTE FUNCTION update_export_updated_at();

DROP TRIGGER IF EXISTS update_export_usp_uvp_updated_at ON export_usp_uvp;
CREATE TRIGGER update_export_usp_uvp_updated_at
  BEFORE UPDATE ON export_usp_uvp
  FOR EACH ROW EXECUTE FUNCTION update_export_updated_at();

-- Comentarios para documentacion
COMMENT ON TABLE export_find_place IS 'Datos parseados del Step 4 - Find Your Place to Win para exportacion CSV';
COMMENT ON TABLE export_prove_legit IS 'Datos combinados de Step 5 (Select Assets) + Step 6 (Proof Points) para exportacion CSV';
COMMENT ON TABLE export_usp_uvp IS 'Datos parseados del Step 7 - Positioning and Messaging para exportacion CSV';
COMMENT ON COLUMN export_find_place.competitor_scores IS 'JSONB con scores por competidor. Formato: {"CompetitorName": {"score": N, "explanation": "..."}}';
