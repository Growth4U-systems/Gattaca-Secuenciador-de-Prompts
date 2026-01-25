-- Migration: Add Step Attempts Tracking
-- Story: US-010 - Implement Step Retry Functionality
-- Description: Creates playbook_step_attempts table for tracking retry attempts
--              and adds retry-related columns to playbook_session_steps

-- ============================================================================
-- 1. CREATE playbook_step_attempts TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS playbook_step_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES playbook_sessions(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL, -- Step definition ID (not session step record ID)
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  error_message TEXT,
  config_snapshot JSONB DEFAULT '{}', -- Configuration used for this attempt
  output_data JSONB, -- Output if successful
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure unique attempt numbers per session/step
  UNIQUE (session_id, step_id, attempt_number)
);

-- ============================================================================
-- 2. ADD retry columns to playbook_session_steps
-- ============================================================================

ALTER TABLE playbook_session_steps
ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS current_attempt_id UUID REFERENCES playbook_step_attempts(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_step_attempts_session_id ON playbook_step_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_step_attempts_step_id ON playbook_step_attempts(step_id);
CREATE INDEX IF NOT EXISTS idx_step_attempts_status ON playbook_step_attempts(status);
CREATE INDEX IF NOT EXISTS idx_step_attempts_session_step ON playbook_step_attempts(session_id, step_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE playbook_step_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view attempts for steps in their own sessions
CREATE POLICY "Users can view attempts for own sessions"
  ON playbook_step_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_step_attempts.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

-- Users can insert attempts for steps in their own sessions
CREATE POLICY "Users can insert attempts for own sessions"
  ON playbook_step_attempts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_step_attempts.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

-- Users can update attempts for steps in their own sessions
CREATE POLICY "Users can update attempts for own sessions"
  ON playbook_step_attempts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_step_attempts.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_step_attempts.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

-- Users can delete attempts for steps in their own sessions
CREATE POLICY "Users can delete attempts for own sessions"
  ON playbook_step_attempts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM playbook_sessions
      WHERE playbook_sessions.id = playbook_step_attempts.session_id
      AND playbook_sessions.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE playbook_step_attempts IS 'Tracks individual execution attempts for playbook steps (for retry functionality)';
COMMENT ON COLUMN playbook_step_attempts.attempt_number IS 'Attempt number for this step (1-based)';
COMMENT ON COLUMN playbook_step_attempts.status IS 'Attempt status: running, completed, failed';
COMMENT ON COLUMN playbook_step_attempts.config_snapshot IS 'Configuration snapshot used for this attempt (model, temperature, etc.)';
COMMENT ON COLUMN playbook_step_attempts.output_data IS 'Output data if attempt completed successfully';

COMMENT ON COLUMN playbook_session_steps.attempt_count IS 'Total number of attempts made for this step';
COMMENT ON COLUMN playbook_session_steps.max_attempts IS 'Maximum allowed attempts before suggesting skip/support';
COMMENT ON COLUMN playbook_session_steps.current_attempt_id IS 'Reference to the current/latest attempt record';
