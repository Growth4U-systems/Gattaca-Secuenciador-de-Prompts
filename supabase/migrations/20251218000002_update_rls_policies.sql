-- ============================================================================
-- UPDATED RLS POLICIES FOR MULTI-USER COLLABORATION
-- Date: 2025-12-18
-- Description: Updates RLS policies to support multi-user project access
-- Version: 2.0 (Fixed recursion issues)
-- Dependencies: Requires 20251218000001 (collaboration schema with helper functions)
-- ============================================================================

-- ============================================================================
-- PROJECTS TABLE - Updated policies using helper functions (NO RECURSION)
-- ============================================================================

DROP POLICY IF EXISTS "Users manage own projects" ON projects;
DROP POLICY IF EXISTS "view_accessible_projects" ON projects;
DROP POLICY IF EXISTS "update_editable_projects" ON projects;
DROP POLICY IF EXISTS "delete_owned_projects" ON projects;
DROP POLICY IF EXISTS "create_own_projects" ON projects;

-- SELECT: View projects where user is owner OR member with any role
-- FIXED: Uses helper function to prevent recursion
CREATE POLICY "view_projects_v2"
  ON projects FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    is_project_member(id, auth.uid())
  );

-- UPDATE: Edit projects where user is owner OR editor
-- FIXED: Uses helper function to prevent recursion
CREATE POLICY "update_projects_v2"
  ON projects FOR UPDATE
  USING (
    auth.uid() = user_id
    OR
    is_project_owner_or_editor(id, auth.uid())
  );

-- DELETE: Only owners can delete projects
-- FIXED: Uses helper function to prevent recursion
CREATE POLICY "delete_projects_v2"
  ON projects FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    is_project_owner(id, auth.uid())
  );

-- INSERT: Users can create projects assigned to themselves
CREATE POLICY "create_projects_v2"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- KNOWLEDGE BASE DOCS - Inherit access from project membership
-- ============================================================================

DROP POLICY IF EXISTS "Users manage docs in own projects" ON knowledge_base_docs;
DROP POLICY IF EXISTS "view_accessible_docs" ON knowledge_base_docs;
DROP POLICY IF EXISTS "insert_docs_in_editable_projects" ON knowledge_base_docs;
DROP POLICY IF EXISTS "update_docs_in_editable_projects" ON knowledge_base_docs;
DROP POLICY IF EXISTS "delete_docs_in_editable_projects" ON knowledge_base_docs;

-- SELECT: View docs in accessible projects
-- FIXED: Simplified using direct project ownership + helper function
CREATE POLICY "view_docs_v2"
  ON knowledge_base_docs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = knowledge_base_docs.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_member(projects.id, auth.uid())
      )
    )
  );

-- INSERT: Upload docs to projects where user is owner/editor
CREATE POLICY "insert_docs_v2"
  ON knowledge_base_docs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = knowledge_base_docs.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner_or_editor(projects.id, auth.uid())
      )
    )
  );

-- UPDATE: Edit docs in projects where user is owner/editor
CREATE POLICY "update_docs_v2"
  ON knowledge_base_docs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = knowledge_base_docs.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner_or_editor(projects.id, auth.uid())
      )
    )
  );

-- DELETE: Delete docs in projects where user is owner/editor
CREATE POLICY "delete_docs_v2"
  ON knowledge_base_docs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = knowledge_base_docs.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner_or_editor(projects.id, auth.uid())
      )
    )
  );

-- ============================================================================
-- ECP CAMPAIGNS - Inherit access from project membership
-- ============================================================================

DROP POLICY IF EXISTS "Users manage campaigns in own projects" ON ecp_campaigns;
DROP POLICY IF EXISTS "view_accessible_campaigns" ON ecp_campaigns;
DROP POLICY IF EXISTS "create_campaigns_in_editable_projects" ON ecp_campaigns;
DROP POLICY IF EXISTS "update_campaigns_in_editable_projects" ON ecp_campaigns;
DROP POLICY IF EXISTS "delete_campaigns_in_editable_projects" ON ecp_campaigns;

-- SELECT: View campaigns in accessible projects
CREATE POLICY "view_campaigns_v2"
  ON ecp_campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ecp_campaigns.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_member(projects.id, auth.uid())
      )
    )
  );

-- INSERT: Create campaigns in projects where user is owner/editor
CREATE POLICY "create_campaigns_v2"
  ON ecp_campaigns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ecp_campaigns.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner_or_editor(projects.id, auth.uid())
      )
    )
  );

-- UPDATE: Edit campaigns in projects where user is owner/editor
CREATE POLICY "update_campaigns_v2"
  ON ecp_campaigns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ecp_campaigns.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner_or_editor(projects.id, auth.uid())
      )
    )
  );

-- DELETE: Delete campaigns in projects where user is owner/editor
CREATE POLICY "delete_campaigns_v2"
  ON ecp_campaigns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ecp_campaigns.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner_or_editor(projects.id, auth.uid())
      )
    )
  );

-- ============================================================================
-- EXECUTION LOGS - Inherit access through campaigns
-- ============================================================================

DROP POLICY IF EXISTS "Users view logs for own campaigns" ON execution_logs;
DROP POLICY IF EXISTS "view_logs_for_accessible_campaigns" ON execution_logs;

-- SELECT: View logs for campaigns in accessible projects
-- FIXED: Simplified join, uses helper function
CREATE POLICY "view_logs_v2"
  ON execution_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ecp_campaigns
      JOIN projects ON projects.id = ecp_campaigns.project_id
      WHERE ecp_campaigns.id = execution_logs.campaign_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_member(projects.id, auth.uid())
      )
    )
  );

-- ============================================================================
-- PROJECT MEMBERS TABLE - New policies for collaboration management
-- ============================================================================

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_members_of_accessible_projects" ON project_members;
DROP POLICY IF EXISTS "owners_add_members" ON project_members;
DROP POLICY IF EXISTS "owners_update_member_roles" ON project_members;
DROP POLICY IF EXISTS "owners_remove_members" ON project_members;

-- SELECT: View members of projects you have access to
-- FIXED: Uses helper function to avoid recursion
CREATE POLICY "view_members_v2"
  ON project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_member(projects.id, auth.uid())
      )
    )
  );

-- INSERT: Only owners can add members
-- FIXED: Uses helper function
CREATE POLICY "add_members_v2"
  ON project_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner(projects.id, auth.uid())
      )
    )
  );

-- UPDATE: Only owners can update member roles, and cannot change their own role
-- FIXED: Uses helper function + prevents self-promotion
CREATE POLICY "update_member_roles_v2"
  ON project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner(projects.id, auth.uid())
      )
    )
  )
  WITH CHECK (
    -- CRITICAL: Cannot change your own role (prevents self-promotion)
    project_members.user_id != auth.uid()
  );

-- DELETE: Owners can remove members, OR users can remove themselves
-- FIXED: Uses helper function
CREATE POLICY "remove_members_v2"
  ON project_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner(projects.id, auth.uid())
      )
    )
    OR project_members.user_id = auth.uid() -- Can remove self
  );

-- ============================================================================
-- INVITATIONS TABLE - New policies
-- ============================================================================

ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_own_invitations" ON project_invitations;
DROP POLICY IF EXISTS "owners_create_invitations" ON project_invitations;
DROP POLICY IF EXISTS "recipients_update_invitations" ON project_invitations;
DROP POLICY IF EXISTS "owners_delete_invitations" ON project_invitations;

-- SELECT: View invitations you sent, received, or for projects you own
-- FIXED: Uses helper function for project ownership check
CREATE POLICY "view_invitations_v2"
  ON project_invitations FOR SELECT
  USING (
    -- Inviter can see
    invited_by = auth.uid()
    OR
    -- Invitee can see (by email)
    LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    OR
    -- Project owners can see
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_invitations.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner(projects.id, auth.uid())
      )
    )
  );

-- INSERT: Only owners can create invitations
CREATE POLICY "create_invitations_v2"
  ON project_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_invitations.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner(projects.id, auth.uid())
      )
    )
    AND invited_by = auth.uid()
  );

-- UPDATE: Recipients can update (to accept/decline), inviters can update
CREATE POLICY "update_invitations_v2"
  ON project_invitations FOR UPDATE
  USING (
    LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    OR invited_by = auth.uid()
  );

-- DELETE: Inviters and owners can delete invitations
CREATE POLICY "delete_invitations_v2"
  ON project_invitations FOR DELETE
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_invitations.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner(projects.id, auth.uid())
      )
    )
  );

-- ============================================================================
-- SHARE LINKS TABLE - New policies
-- ============================================================================

ALTER TABLE project_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_active_share_links" ON project_share_links;
DROP POLICY IF EXISTS "owners_manage_share_links" ON project_share_links;

-- SELECT: Anyone can view active, non-expired links by token
-- Owners can view all links for their projects
CREATE POLICY "view_share_links_v2"
  ON project_share_links FOR SELECT
  USING (
    -- Public: active, non-expired links
    (
      is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR current_uses < max_uses)
    )
    OR
    -- Owners can see all their links
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_share_links.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner(projects.id, auth.uid())
      )
    )
  );

-- INSERT: Only owners can create share links
CREATE POLICY "create_share_links_v2"
  ON project_share_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_share_links.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner(projects.id, auth.uid())
      )
    )
  );

-- UPDATE: Only owners can update share links
CREATE POLICY "update_share_links_v2"
  ON project_share_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_share_links.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner(projects.id, auth.uid())
      )
    )
  );

-- DELETE: Only owners can delete share links
CREATE POLICY "delete_share_links_v2"
  ON project_share_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_share_links.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        is_project_owner(projects.id, auth.uid())
      )
    )
  );

-- ============================================================================
-- NOTIFICATIONS TABLE - New policies
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_own_notifications" ON notifications;
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
DROP POLICY IF EXISTS "system_create_notifications" ON notifications;

-- SELECT: Users can view their own notifications
CREATE POLICY "view_notifications_v2"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- UPDATE: Users can update their own notifications (mark as read)
CREATE POLICY "update_notifications_v2"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: Users can delete their own notifications
CREATE POLICY "delete_notifications_v2"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- INSERT: System can create notifications (via service role in API)
-- This policy allows any authenticated user to create notifications
-- In practice, this will be called from API routes using service role key
CREATE POLICY "create_notifications_v2"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Uncomment and run these after migration to verify policies work correctly

-- Test project access:
-- SELECT p.id, p.name, get_user_project_role(p.id, auth.uid()) as my_role
-- FROM projects p
-- WHERE user_can_view_project(p.id, auth.uid());

-- Test member count:
-- SELECT project_id, COUNT(*) as member_count
-- FROM project_members
-- GROUP BY project_id;

-- Test owner count for a specific project:
-- SELECT count_project_owners('YOUR_PROJECT_ID_HERE');

-- Test if recursion is fixed:
-- SELECT * FROM projects LIMIT 1;
-- SELECT * FROM project_members LIMIT 1;
