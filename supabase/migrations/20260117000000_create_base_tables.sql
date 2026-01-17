-- Migration: Create base tables for Agency > Client > Project hierarchy
-- Run BEFORE 20260117000001_add_context_lake.sql

-- ============================================
-- AGENCIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  settings JSONB DEFAULT '{}',
  openrouter_api_key TEXT,
  openrouter_key_last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENCY MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agency_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, user_id)
);

-- ============================================
-- CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  website_url TEXT,
  logo_url TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  settings JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, slug)
);

-- ============================================
-- PLAYBOOKS TABLE (Templates de flujo)
-- ============================================
CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  playbook_type TEXT NOT NULL CHECK (playbook_type IN ('ecp', 'competitor_analysis', 'niche_finder', 'custom')),
  version TEXT DEFAULT '1.0.0',
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, slug)
);

-- ============================================
-- ENSURE missing columns exist in playbooks (for existing DBs)
-- ============================================
DO $$
BEGIN
  -- playbook_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playbooks' AND column_name = 'playbook_type'
  ) THEN
    ALTER TABLE playbooks ADD COLUMN playbook_type TEXT NOT NULL DEFAULT 'ecp'
      CHECK (playbook_type IN ('ecp', 'competitor_analysis', 'niche_finder', 'custom'));
  END IF;

  -- is_public
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playbooks' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE playbooks ADD COLUMN is_public BOOLEAN DEFAULT false;
  END IF;

  -- version
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playbooks' AND column_name = 'version'
  ) THEN
    ALTER TABLE playbooks ADD COLUMN version TEXT DEFAULT '1.0.0';
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_agency_members_user ON agency_members(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_agency ON agency_members(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_agency ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_playbooks_agency ON playbooks(agency_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_type ON playbooks(playbook_type);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

-- Agencies: members can view their agency
CREATE POLICY "Users can view their agency"
  ON agencies FOR SELECT
  USING (id IN (
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  ));

-- Agency members: users can see members of their agencies
CREATE POLICY "Users can view agency members"
  ON agency_members FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  ));

-- Clients: agency members can view clients
CREATE POLICY "Agency members can view clients"
  ON clients FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Agency admins can manage clients"
  ON clients FOR ALL
  USING (agency_id IN (
    SELECT agency_id FROM agency_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Playbooks: agency members can view playbooks
CREATE POLICY "Agency members can view playbooks"
  ON playbooks FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
    OR is_public = true
  );

CREATE POLICY "Agency admins can manage playbooks"
  ON playbooks FOR ALL
  USING (agency_id IN (
    SELECT agency_id FROM agency_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ============================================
-- SEED DEFAULT AGENCY FOR DEV
-- ============================================
-- This creates a default agency for development purposes
-- In production, agencies would be created through proper onboarding

DO $$
BEGIN
  -- Only insert if no agencies exist
  IF NOT EXISTS (SELECT 1 FROM agencies LIMIT 1) THEN
    INSERT INTO agencies (id, name, slug, description)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      'Default Agency',
      'default',
      'Default agency for development'
    );
  END IF;
END $$;

-- ============================================
-- ADD ALL EXISTING USERS TO DEFAULT AGENCY
-- ============================================
-- This ensures existing users can access the system
INSERT INTO agency_members (agency_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, 'owner'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM agency_members
  WHERE agency_members.user_id = auth.users.id
)
ON CONFLICT (agency_id, user_id) DO NOTHING;

-- ============================================
-- AUTO-ADD NEW USERS TO DEFAULT AGENCY
-- ============================================
CREATE OR REPLACE FUNCTION add_user_to_default_agency()
RETURNS TRIGGER AS $$
BEGIN
  -- Add new user to default agency as member
  INSERT INTO agency_members (agency_id, user_id, role)
  VALUES ('00000000-0000-0000-0000-000000000001', NEW.id, 'member')
  ON CONFLICT (agency_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION add_user_to_default_agency();
