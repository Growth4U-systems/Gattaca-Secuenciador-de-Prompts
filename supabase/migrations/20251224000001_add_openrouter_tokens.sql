-- Migration: Add OpenRouter OAuth tokens table
-- Description: Stores encrypted API keys obtained via OAuth PKCE flow

CREATE TABLE IF NOT EXISTS user_openrouter_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  encrypted_api_key TEXT NOT NULL,
  key_prefix TEXT,  -- "sk-or-v1-xxx..." (first 15 chars for display)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  -- Token metadata from OpenRouter
  expires_at TIMESTAMPTZ,
  credit_limit NUMERIC,
  limit_remaining NUMERIC,
  usage NUMERIC DEFAULT NULL,
  -- PKCE temporary storage (cleared after OAuth completes)
  pending_code_verifier TEXT,
  pending_state TEXT,
  pending_expires_at TIMESTAMPTZ
);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_openrouter_tokens_user_id ON user_openrouter_tokens(user_id);

-- Enable Row Level Security
ALTER TABLE user_openrouter_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own tokens
CREATE POLICY "Users can view own tokens" ON user_openrouter_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON user_openrouter_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON user_openrouter_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" ON user_openrouter_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_openrouter_token_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER trigger_update_openrouter_token_updated_at
  BEFORE UPDATE ON user_openrouter_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_openrouter_token_updated_at();

-- Comment on table
COMMENT ON TABLE user_openrouter_tokens IS 'Stores encrypted OpenRouter API keys obtained via OAuth PKCE flow';
COMMENT ON COLUMN user_openrouter_tokens.encrypted_api_key IS 'AES-256-GCM encrypted API key';
COMMENT ON COLUMN user_openrouter_tokens.key_prefix IS 'First 15 chars of key for display (sk-or-v1-xxx...)';
COMMENT ON COLUMN user_openrouter_tokens.expires_at IS 'Token expiration date from OpenRouter (ISO 8601 timestamp). NULL means no expiration.';
COMMENT ON COLUMN user_openrouter_tokens.credit_limit IS 'Credit limit in USD for this token if provided by OpenRouter. NULL means no limit set.';
COMMENT ON COLUMN user_openrouter_tokens.limit_remaining IS 'Remaining credit balance in USD. NULL means no limit tracking.';
COMMENT ON COLUMN user_openrouter_tokens.usage IS 'Total OpenRouter credit usage in USD.';
COMMENT ON COLUMN user_openrouter_tokens.pending_code_verifier IS 'Temporary PKCE code_verifier during OAuth flow';
COMMENT ON COLUMN user_openrouter_tokens.pending_state IS 'Temporary state parameter for CSRF protection';
COMMENT ON COLUMN user_openrouter_tokens.pending_expires_at IS 'Expiration time for pending OAuth flow (10 min)';
