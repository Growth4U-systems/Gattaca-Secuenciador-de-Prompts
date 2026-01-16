-- =====================================================
-- NICHE FINDER TABLES
-- Sistema de combinaciones A × B para buscar nichos
-- =====================================================

-- Jobs de Niche Finder (ejecuciones del scraping)
CREATE TABLE IF NOT EXISTS niche_finder_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Creado, esperando inicio
    'serp_running',   -- Buscando URLs en SERP
    'serp_done',      -- URLs encontradas, listo para scrapear
    'scraping',       -- Scrapeando contenido con Firecrawl
    'scrape_done',    -- Scraping completado, listo para extracción
    'extracting',     -- Extrayendo nichos con LLM
    'completed',      -- Completado exitosamente
    'failed'          -- Error
  )),
  config JSONB DEFAULT '{}',       -- ScraperStepConfig completo
  urls_found INTEGER DEFAULT 0,
  urls_scraped INTEGER DEFAULT 0,
  urls_filtered INTEGER DEFAULT 0,
  urls_failed INTEGER DEFAULT 0,
  niches_extracted INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- URLs encontradas por SERP
CREATE TABLE IF NOT EXISTS niche_finder_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES niche_finder_jobs(id) ON DELETE CASCADE,

  -- Datos de la búsqueda (combinación A × B)
  life_context TEXT NOT NULL,         -- Contexto de vida usado (Columna A)
  product_word TEXT NOT NULL,         -- Palabra del producto usada (Columna B)
  indicator TEXT,                     -- Indicador usado (si aplica)
  source_type TEXT CHECK (source_type IN ('reddit', 'thematic_forum', 'general_forum')),

  -- Resultado SERP
  url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  position INTEGER,

  -- Estado y contenido
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Esperando scraping
    'scraped',     -- Contenido obtenido
    'filtered',    -- Descartado por LLM (no relevante)
    'extracted',   -- Nichos extraídos exitosamente
    'failed'       -- Error en scraping
  )),
  content_markdown TEXT,              -- Contenido scrapeado
  filtered_reason TEXT,               -- Si filtered: razón del LLM

  -- Referencias
  doc_id UUID,                        -- Documento creado (si relevante)

  -- Metadata
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Nichos extraídos por el LLM
CREATE TABLE IF NOT EXISTS niche_finder_extracted (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES niche_finder_jobs(id) ON DELETE CASCADE,
  url_id UUID REFERENCES niche_finder_urls(id) ON DELETE CASCADE,

  -- Campos extraídos (formato CSV del prompt)
  problem TEXT,
  persona TEXT,
  functional_cause TEXT,
  emotional_load TEXT,
  evidence TEXT,                      -- 2-3 citas separadas por |
  alternatives TEXT,
  source_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tracking de costes de Niche Finder
CREATE TABLE IF NOT EXISTS niche_finder_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES niche_finder_jobs(id) ON DELETE CASCADE,
  cost_type TEXT CHECK (cost_type IN ('serp', 'firecrawl', 'llm_extraction')),
  service TEXT NOT NULL,              -- serper, firecrawl, openrouter
  units INTEGER NOT NULL,             -- calls, pages, o tokens
  cost_usd DECIMAL(10, 6) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_niche_finder_jobs_project ON niche_finder_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_niche_finder_jobs_status ON niche_finder_jobs(status);
CREATE INDEX IF NOT EXISTS idx_niche_finder_urls_job ON niche_finder_urls(job_id);
CREATE INDEX IF NOT EXISTS idx_niche_finder_urls_status ON niche_finder_urls(status);
CREATE INDEX IF NOT EXISTS idx_niche_finder_extracted_job ON niche_finder_extracted(job_id);
CREATE INDEX IF NOT EXISTS idx_niche_finder_costs_job ON niche_finder_costs(job_id);

-- =====================================================
-- RLS Policies (disabled for service role usage)
-- =====================================================

ALTER TABLE niche_finder_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_finder_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_finder_extracted ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_finder_costs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on niche_finder_jobs"
  ON niche_finder_jobs FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on niche_finder_urls"
  ON niche_finder_urls FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on niche_finder_extracted"
  ON niche_finder_extracted FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on niche_finder_costs"
  ON niche_finder_costs FOR ALL
  USING (true) WITH CHECK (true);
