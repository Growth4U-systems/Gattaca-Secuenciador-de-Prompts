-- Migration: Update Playbook Session Management Schema
-- Story: US-001 - Create Playbook Session Management Schema
-- Description: Updates playbook_sessions and playbook_session_steps tables to match
--              the new schema requirements, and creates playbook_session_artifacts table

-- ============================================================================
-- 1. UPDATE playbook_sessions TABLE
-- ============================================================================

-- Add missing columns to playbook_sessions
ALTER TABLE playbook_sessions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS playbook_id UUID,
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS current_step_id UUID;

-- Populate user_id from project's user_id for existing records
UPDATE playbook_sessions ps
SET user_id = p.user_id
FROM projects p
WHERE ps.project_id = p.id
AND ps.user_id IS NULL;

-- Now make user_id NOT NULL after populating
ALTER TABLE playbook_sessions
ALTER COLUMN user_id SET NOT NULL;

-- Update status constraint to match new enum values
-- First, update any existing values to new format
UPDATE playbook_sessions
SET status = CASE
  WHEN status = 'active' THEN 'running'
  WHEN status = 'paused' THEN 'paused'
  WHEN status = 'completed' THEN 'completed'
  WHEN status = 'failed' THEN 'failed'
  ELSE 'draft'
END;

-- Drop old constraint and add new one
ALTER TABLE playbook_sessions DROP CONSTRAINT IF EXISTS playbook_sessions_status_check;
ALTER TABLE playbook_sessions ADD CONSTRAINT playbook_sessions_status_check
  CHECK (status IN ('draft', 'running', 'paused', 'completed', 'failed'));

-- ============================================================================
-- 2. UPDATE playbook_session_steps TABLE
-- ============================================================================

-- Add step_order column
ALTER TABLE playbook_session_steps
ADD COLUMN IF NOT EXISTS step_order INTEGER;

-- Rename columns to match new schema (input -> input_data, output -> output_data)
-- Check if columns need renaming (only if old names exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'playbook_session_steps' AND column_name = 'input') THEN
    ALTER TABLE playbook_session_steps RENAME COLUMN input TO input_data;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'playbook_session_steps' AND column_name = 'output') THEN
    ALTER TABLE playbook_session_steps RENAME COLUMN output TO output_data;
  END IF;
END $$;

-- Update status values to match new enum
UPDATE playbook_session_steps
SET status = CASE
  WHEN status = 'in_progress' THEN 'running'
  WHEN status = 'error' THEN 'failed'
  ELSE status
END
WHERE status IN ('in_progress', 'error');

-- Drop old constraint and add new one
ALTER TABLE playbook_session_steps DROP CONSTRAINT IF EXISTS playbook_session_steps_status_check;
ALTER TABLE playbook_session_steps ADD CONSTRAINT playbook_session_steps_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped'));

-- Populate step_order based on created_at for existing records
WITH ordered_steps AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) as row_num
  FROM playbook_session_steps
)
UPDATE playbook_session_steps pss
SET step_order = os.row_num
FROM ordered_steps os
WHERE pss.id = os.id
AND pss.step_order IS NULL;

-- ============================================================================
-- 3. CREATE playbook_session_artifacts TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS playbook_session_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES playbook_sessions(id) ON DELETE CASCADE,
  step_id UUID REFERENCES playbook_session_steps(id) ON DELETE SET NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('serp_results', 'scraped_content', 'extracted_data', 'analysis_output')),
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. CREATE INDEXES
-- ============================================================================

-- Indexes for playbook_sessions (some may already exist)
CREATE INDEX IF NOT EXISTS idx_playbook_sessions_user_id ON playbook_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_playbook_sessions_project_id ON playbook_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_playbook_sessions_playbook_id ON playbook_sessions(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_sessions_status ON playbook_sessions(status);
CREATE INDEX IF NOT EXISTS idx_playbook_sessions_created_at ON playbook_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_playbook_sessions_tags ON playbook_sessions USING GIN(tags);

-- Indexes for playbook_session_steps
CREATE INDEX IF NOT EXISTS idx_playbook_session_steps_session_id ON playbook_session_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_playbook_session_steps_step_order ON playbook_session_steps(step_order);

-- Indexes for playbook_session_artifacts
CREATE INDEX IF NOT EXISTS idx_playbook_session_artifacts_session_id ON playbook_session_artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_playbook_session_artifacts_step_id ON playbook_session_artifacts(step_id);
CREATE INDEX IF NOT EXISTS idx_playbook_session_artifacts_type ON playbook_session_artifacts(artifact_type);

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on artifacts table
ALTER TABLE playbook_session_artifacts ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies (we'll replace with user-based access)
DROP POLICY IF EXISTS "Service role full access on playbook_sessions" ON playbook_sessions;
DROP POLICY IF EXISTS "Service role full access on playbook_session_steps" ON playbook_session_steps;

-- playbook_sessions: Users can only access their own sessions
CREATE POLICY "Users can view own sessions"
  ON playbook_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON playbook_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON playbook_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON playbook_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- playbook_session_steps: Users can access steps through session ownership
CREATE POLICY "Users can view steps for own sessions"
  ON playbook_session_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_session_steps.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert steps for own sessions"
  ON playbook_session_steps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_session_steps.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update steps for own sessions"
  ON playbook_session_steps FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_session_steps.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_session_steps.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete steps for own sessions"
  ON playbook_session_steps FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_session_steps.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

-- playbook_session_artifacts: Users can access artifacts through session ownership
CREATE POLICY "Users can view artifacts for own sessions"
  ON playbook_session_artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_session_artifacts.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert artifacts for own sessions"
  ON playbook_session_artifacts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_session_artifacts.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update artifacts for own sessions"
  ON playbook_session_artifacts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_session_artifacts.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_session_artifacts.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete artifacts for own sessions"
  ON playbook_session_artifacts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_session_artifacts.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON TABLE playbook_sessions IS 'Tracks playbook execution sessions with state management';
COMMENT ON TABLE playbook_session_steps IS 'Individual step executions within a playbook session';
COMMENT ON TABLE playbook_session_artifacts IS 'Artifacts generated during playbook execution (SERP results, scraped content, etc.)';

COMMENT ON COLUMN playbook_sessions.user_id IS 'Owner of the session';
COMMENT ON COLUMN playbook_sessions.project_id IS 'Associated project';
COMMENT ON COLUMN playbook_sessions.playbook_id IS 'Reference to the playbook being executed';
COMMENT ON COLUMN playbook_sessions.name IS 'User-friendly session name';
COMMENT ON COLUMN playbook_sessions.tags IS 'Array of tags for filtering and organization';
COMMENT ON COLUMN playbook_sessions.status IS 'Session status: draft, running, paused, completed, failed';
COMMENT ON COLUMN playbook_sessions.current_step_id IS 'Currently active step reference';

COMMENT ON COLUMN playbook_session_steps.step_order IS 'Execution order within the session';
COMMENT ON COLUMN playbook_session_steps.input_data IS 'JSON input data for the step';
COMMENT ON COLUMN playbook_session_steps.output_data IS 'JSON output data from the step';

COMMENT ON COLUMN playbook_session_artifacts.artifact_type IS 'Type: serp_results, scraped_content, extracted_data, analysis_output';
COMMENT ON COLUMN playbook_session_artifacts.data IS 'The artifact data in JSON format';
COMMENT ON COLUMN playbook_session_artifacts.metadata IS 'Additional metadata about the artifact';
