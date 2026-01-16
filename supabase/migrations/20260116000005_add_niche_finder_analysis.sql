-- =====================================================
-- NICHE FINDER ANALYSIS TABLES
-- Tables and status for LLM analysis steps (1-3)
-- =====================================================

-- Add new status values for analysis steps
ALTER TABLE niche_finder_jobs
DROP CONSTRAINT IF EXISTS niche_finder_jobs_status_check;

ALTER TABLE niche_finder_jobs
ADD CONSTRAINT niche_finder_jobs_status_check CHECK (status IN (
  'pending',        -- Creado, esperando inicio
  'serp_running',   -- Buscando URLs en SERP
  'serp_done',      -- URLs encontradas, listo para scrapear
  'scraping',       -- Scrapeando contenido con Firecrawl
  'scrape_done',    -- Scraping completado, listo para extracción
  'extracting',     -- Extrayendo nichos con LLM
  'extract_done',   -- Extracción completada, listo para análisis
  'analyzing_1',    -- Step 1: Clean & Filter
  'analyzing_2',    -- Step 2: Scoring (Deep Research)
  'analyzing_3',    -- Step 3: Consolidate Final Table
  'completed',      -- Completado exitosamente
  'failed'          -- Error
));

-- Add columns for tracking analysis progress
ALTER TABLE niche_finder_jobs
ADD COLUMN IF NOT EXISTS current_analysis_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS analysis_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS analysis_completed_at TIMESTAMPTZ;

-- Table for storing LLM step outputs
CREATE TABLE IF NOT EXISTS niche_finder_step_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES niche_finder_jobs(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,          -- 1, 2, or 3
  step_name TEXT NOT NULL,               -- 'clean_filter', 'scoring', 'consolidate'

  -- Input/Output
  input_content TEXT,                    -- What was sent to the LLM
  output_content TEXT,                   -- Raw LLM response

  -- Model info
  model TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10, 6),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'running',
    'completed',
    'failed'
  )),
  error_message TEXT,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for step outputs
CREATE INDEX IF NOT EXISTS idx_niche_finder_step_outputs_job ON niche_finder_step_outputs(job_id);
CREATE INDEX IF NOT EXISTS idx_niche_finder_step_outputs_step ON niche_finder_step_outputs(step_number);

-- RLS for step outputs
ALTER TABLE niche_finder_step_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on niche_finder_step_outputs"
  ON niche_finder_step_outputs FOR ALL
  USING (true) WITH CHECK (true);

-- Update cost tracking to include analysis costs
ALTER TABLE niche_finder_costs
DROP CONSTRAINT IF EXISTS niche_finder_costs_cost_type_check;

ALTER TABLE niche_finder_costs
ADD CONSTRAINT niche_finder_costs_cost_type_check CHECK (cost_type IN (
  'serp',
  'firecrawl',
  'llm_extraction',
  'llm_analysis_1',   -- Clean & Filter
  'llm_analysis_2',   -- Scoring
  'llm_analysis_3'    -- Consolidate
));
