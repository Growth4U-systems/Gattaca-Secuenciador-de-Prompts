-- Create client_playbooks table for client-specific playbook customizations
-- This allows each client to have their own catalog of playbooks with custom prompts and configurations

CREATE TABLE client_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  playbook_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}',
  base_template_type TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each client can have multiple playbooks of the same type with different names
  UNIQUE(client_id, playbook_type, name)
);

-- Index for efficient queries by client
CREATE INDEX idx_client_playbooks_client ON client_playbooks(client_id);

-- Index for queries by playbook type within a client
CREATE INDEX idx_client_playbooks_type ON client_playbooks(client_id, playbook_type);

-- Enable RLS
ALTER TABLE client_playbooks ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can manage playbooks for clients in their agencies
-- This follows the same pattern as the clients table RLS

CREATE POLICY "Users can view client playbooks"
  ON client_playbooks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN agency_members am ON am.agency_id = c.agency_id
      WHERE c.id = client_playbooks.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert client playbooks"
  ON client_playbooks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN agency_members am ON am.agency_id = c.agency_id
      WHERE c.id = client_playbooks.client_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can update client playbooks"
  ON client_playbooks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN agency_members am ON am.agency_id = c.agency_id
      WHERE c.id = client_playbooks.client_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can delete client playbooks"
  ON client_playbooks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN agency_members am ON am.agency_id = c.agency_id
      WHERE c.id = client_playbooks.client_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_client_playbooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_client_playbooks_updated_at
  BEFORE UPDATE ON client_playbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_client_playbooks_updated_at();
