-- Migration: Add user API keys table
-- Allows users to configure their own API keys for external services

-- Create table for storing encrypted API keys
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL, -- 'apify', 'firecrawl', 'openai', etc.
  api_key_encrypted TEXT NOT NULL, -- Encrypted key value
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Each user can only have one key per service
  UNIQUE(user_id, service_name)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_service
  ON user_api_keys(user_id, service_name)
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own API keys
CREATE POLICY "Users can view their own API keys"
  ON user_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys"
  ON user_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON user_api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON user_api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_user_api_keys_updated_at ON user_api_keys;
CREATE TRIGGER trigger_user_api_keys_updated_at
  BEFORE UPDATE ON user_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_user_api_keys_updated_at();

-- Comment on table
COMMENT ON TABLE user_api_keys IS 'Stores encrypted API keys for external services (Apify, Firecrawl, etc.)';
COMMENT ON COLUMN user_api_keys.api_key_encrypted IS 'API key encrypted with AES-256-GCM using ENCRYPTION_KEY env var';
