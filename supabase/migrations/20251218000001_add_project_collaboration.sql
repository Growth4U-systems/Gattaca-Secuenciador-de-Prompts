-- ============================================================================
-- PROJECT COLLABORATION SCHEMA
-- Date: 2025-12-18
-- Description: Multi-user collaboration for projects with granular roles
-- Version: 2.0 (Fixed recursion issues)
-- Dependencies: Requires 20251217000001 (placeholder migration) to run first
-- ============================================================================

-- ENUM for project roles
DO $$ BEGIN
  CREATE TYPE project_role AS ENUM ('owner', 'editor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ENUM for invitation status
DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PROJECT MEMBERS TABLE
-- ============================================================================
-- Tracks who has access to each project and their role
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role project_role NOT NULL DEFAULT 'viewer',

  -- Metadata
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT unique_project_user UNIQUE(project_id, user_id),
  CONSTRAINT no_self_add CHECK (user_id != added_by OR added_by IS NULL)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);
CREATE INDEX IF NOT EXISTS idx_project_members_user_role ON project_members(user_id, role);

-- ============================================================================
-- PROJECT INVITATIONS TABLE
-- ============================================================================
-- Email invitations with expiration
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,

  -- Invitation details
  email TEXT NOT NULL,
  role project_role NOT NULL DEFAULT 'viewer',
  status invitation_status NOT NULL DEFAULT 'pending',

  -- Token for secure acceptance (used in invitation link)
  invitation_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,

  -- Expiration (7 days by default)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),

  -- Metadata
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT invitations_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT invitations_not_expired CHECK (expires_at > created_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invitations_project_id ON project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email_lower ON project_invitations(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_invitations_token ON project_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON project_invitations(status);

-- ============================================================================
-- SHAREABLE LINKS TABLE
-- ============================================================================
-- Generate shareable links with embedded role and optional expiration
CREATE TABLE IF NOT EXISTS project_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,

  -- Link details
  share_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  role project_role NOT NULL DEFAULT 'viewer',

  -- Optional expiration
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,

  -- Usage tracking
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT share_links_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT share_links_current_uses_valid CHECK (current_uses >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_share_links_project_id ON project_share_links(project_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON project_share_links(share_token);
CREATE INDEX IF NOT EXISTS idx_share_links_active ON project_share_links(is_active) WHERE is_active = true;

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
-- In-app notifications for collaboration events
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Notification details
  type TEXT NOT NULL CHECK (type IN (
    'project_shared',
    'invitation_received',
    'member_added',
    'member_removed',
    'role_changed',
    'project_deleted'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Related entities
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Optional metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON notifications(project_id);

-- ============================================================================
-- MIGRATE EXISTING OWNERS TO project_members
-- ============================================================================
-- FIXED: Properly filter placeholders
INSERT INTO project_members (project_id, user_id, role, added_at)
SELECT id, user_id, 'owner', created_at
FROM projects
WHERE user_id IS NOT NULL
  AND user_id != '00000000-0000-0000-0000-000000000000'
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER to avoid RLS recursion)
-- ============================================================================

-- Get user's role in a project (checks both projects.user_id and project_members)
-- FIXED: Uses COALESCE to check both sources
CREATE OR REPLACE FUNCTION get_user_project_role(p_project_id UUID, p_user_id UUID)
RETURNS project_role AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      -- Check if user is original owner
      (SELECT 'owner'::project_role FROM projects WHERE id = p_project_id AND user_id = p_user_id),
      -- Check project_members table
      (SELECT role FROM project_members WHERE project_id = p_project_id AND user_id = p_user_id)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user can edit project (owner or editor)
CREATE OR REPLACE FUNCTION user_can_edit_project(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_project_role(p_project_id, p_user_id) IN ('owner', 'editor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user can view project (any role)
CREATE OR REPLACE FUNCTION user_can_view_project(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_project_role(p_project_id, p_user_id) IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- NEW: Count project owners (prevents removing last owner)
-- FIXED: Correctly counts both original owner and members with owner role
CREATE OR REPLACE FUNCTION count_project_owners(p_project_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT user_id)::INTEGER
    FROM (
      -- Original owner
      SELECT user_id FROM projects
      WHERE id = p_project_id
        AND user_id IS NOT NULL
        AND user_id != '00000000-0000-0000-0000-000000000000'
      UNION
      -- Members with owner role
      SELECT user_id FROM project_members
      WHERE project_id = p_project_id
        AND role = 'owner'
    ) owners
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- NEW: Helper functions to avoid RLS recursion (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_project_owner_or_editor(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND role IN ('owner', 'editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_project_owner(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on project_members
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_members_updated_at ON project_members;
CREATE TRIGGER project_members_updated_at
  BEFORE UPDATE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-expire invitations (runs periodically via pg_cron or manual trigger)
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
  UPDATE project_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for clarity
COMMENT ON FUNCTION cleanup_expired_invitations() IS 'Marks pending invitations as expired when past their expiration date. Run periodically.';
