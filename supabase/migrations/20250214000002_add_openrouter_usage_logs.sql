-- ============================================================================
-- OPENROUTER USAGE LOGS
-- Date: 2025-02-14
-- Description: Track all OpenRouter API usage for cost monitoring
-- ============================================================================

-- Create usage logs table
CREATE TABLE IF NOT EXISTS openrouter_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who made the request
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,

  -- What was executed
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES ecp_campaigns(id) ON DELETE SET NULL,
  step_id TEXT,
  step_name TEXT,

  -- Model and tokens
  model_used TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,

  -- Costs
  cost_usd DECIMAL(12, 8) NOT NULL DEFAULT 0,
  cache_discount DECIMAL(12, 8) DEFAULT 0,  -- Savings from caching

  -- Mode used
  retrieval_mode TEXT DEFAULT 'full' CHECK (retrieval_mode IN ('full', 'rag')),

  -- Metadata
  duration_ms INTEGER,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON openrouter_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON openrouter_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_project_id ON openrouter_usage_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_model ON openrouter_usage_logs(model_used);

-- View for daily totals
CREATE OR REPLACE VIEW openrouter_usage_daily AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  user_id,
  SUM(cost_usd) as total_cost,
  SUM(cache_discount) as total_cache_savings,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN retrieval_mode = 'rag' THEN 1 END) as rag_requests,
  COUNT(CASE WHEN retrieval_mode = 'full' THEN 1 END) as full_requests
FROM openrouter_usage_logs
WHERE status = 'completed'
GROUP BY DATE_TRUNC('day', created_at), user_id;

-- View for model breakdown
CREATE OR REPLACE VIEW openrouter_usage_by_model AS
SELECT
  model_used,
  SUM(cost_usd) as total_cost,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  COUNT(*) as total_requests,
  AVG(input_tokens) as avg_input_tokens,
  AVG(cost_usd) as avg_cost_per_request
FROM openrouter_usage_logs
WHERE status = 'completed'
GROUP BY model_used
ORDER BY total_cost DESC;

-- View for global totals (all users combined)
CREATE OR REPLACE VIEW openrouter_usage_global AS
SELECT
  SUM(cost_usd) as total_cost,
  SUM(cache_discount) as total_cache_savings,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  COUNT(*) as total_requests,
  MIN(created_at) as first_request,
  MAX(created_at) as last_request
FROM openrouter_usage_logs
WHERE status = 'completed';

-- RLS policies
ALTER TABLE openrouter_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own logs
CREATE POLICY "Users can read their own usage logs" ON openrouter_usage_logs
FOR SELECT USING (auth.uid() = user_id);

-- Service role can do anything
CREATE POLICY "Service role full access to usage logs" ON openrouter_usage_logs
FOR ALL USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE openrouter_usage_logs IS 'Tracks all OpenRouter API calls for cost monitoring and optimization';
COMMENT ON COLUMN openrouter_usage_logs.cache_discount IS 'USD saved from OpenRouter context caching';
COMMENT ON COLUMN openrouter_usage_logs.retrieval_mode IS 'Whether full documents or RAG chunks were used';
