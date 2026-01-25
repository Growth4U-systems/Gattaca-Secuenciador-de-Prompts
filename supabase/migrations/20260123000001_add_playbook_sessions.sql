-- Migration: Add playbook sessions and saved docs tables
-- Purpose: Support background job execution, session tracking, and document persistence

-- 1. Playbook Sessions: Track execution sessions across playbooks
CREATE TABLE IF NOT EXISTS playbook_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  playbook_type TEXT NOT NULL, -- 'niche_finder', 'ecp', 'video_viral', etc.

  -- Session state
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  current_phase TEXT,
  current_step TEXT,

  -- Configuration snapshot
  config JSONB DEFAULT '{}',
  variables JSONB DEFAULT '{}', -- product, target, industry, etc.

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- For niche_finder: link to active job
  active_job_id UUID REFERENCES niche_finder_jobs(id) ON DELETE SET NULL
);

-- Indexes for playbook_sessions
CREATE INDEX IF NOT EXISTS idx_playbook_sessions_project ON playbook_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_playbook_sessions_status ON playbook_sessions(status);
CREATE INDEX IF NOT EXISTS idx_playbook_sessions_type ON playbook_sessions(playbook_type);
CREATE INDEX IF NOT EXISTS idx_playbook_sessions_project_type ON playbook_sessions(project_id, playbook_type);

-- 2. Session Steps: Track individual step executions within a session
CREATE TABLE IF NOT EXISTS playbook_session_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES playbook_sessions(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL, -- 'search_and_preview', 'extract_problems', etc.

  -- Step state
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'error', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Input/Output
  input JSONB,
  output JSONB,
  error_message TEXT,

  -- For steps that spawn jobs
  job_id UUID,
  job_type TEXT, -- 'serp', 'scrape', 'extract', 'analyze'

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One step per session
  UNIQUE(session_id, step_id)
);

-- Indexes for session_steps
CREATE INDEX IF NOT EXISTS idx_session_steps_session ON playbook_session_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_session_steps_status ON playbook_session_steps(status);

-- 3. Saved Docs: Link scraped URLs to Context Lake documents
CREATE TABLE IF NOT EXISTS niche_finder_saved_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES niche_finder_jobs(id) ON DELETE CASCADE,
  url_id UUID REFERENCES niche_finder_urls(id) ON DELETE CASCADE,
  doc_id UUID REFERENCES knowledge_base_docs(id) ON DELETE SET NULL,

  -- URL metadata (denormalized for quick access)
  url TEXT NOT NULL,
  title TEXT,
  source_type TEXT, -- 'reddit', 'thematic_forum', 'general_forum'

  -- For content deduplication
  content_hash TEXT, -- SHA256 of content_markdown

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for saved_docs
CREATE INDEX IF NOT EXISTS idx_saved_docs_job ON niche_finder_saved_docs(job_id);
CREATE INDEX IF NOT EXISTS idx_saved_docs_url ON niche_finder_saved_docs(url);
CREATE INDEX IF NOT EXISTS idx_saved_docs_hash ON niche_finder_saved_docs(content_hash);
CREATE INDEX IF NOT EXISTS idx_saved_docs_doc ON niche_finder_saved_docs(doc_id);

-- 4. RLS Policies
-- Using service role access pattern (same as niche_finder tables)
-- These tables are accessed via API endpoints using service role key

ALTER TABLE playbook_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_session_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_finder_saved_docs ENABLE ROW LEVEL SECURITY;

-- Service role full access (API endpoints handle authorization)
CREATE POLICY "Service role full access on playbook_sessions"
  ON playbook_sessions FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on playbook_session_steps"
  ON playbook_session_steps FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on niche_finder_saved_docs"
  ON niche_finder_saved_docs FOR ALL
  USING (true) WITH CHECK (true);

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist (to avoid errors on re-run)
DROP TRIGGER IF EXISTS update_playbook_sessions_updated_at ON playbook_sessions;
DROP TRIGGER IF EXISTS update_playbook_session_steps_updated_at ON playbook_session_steps;

CREATE TRIGGER update_playbook_sessions_updated_at
  BEFORE UPDATE ON playbook_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playbook_session_steps_updated_at
  BEFORE UPDATE ON playbook_session_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Add session_id to niche_finder_jobs for reverse lookup
ALTER TABLE niche_finder_jobs
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES playbook_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_niche_finder_jobs_session ON niche_finder_jobs(session_id);
