-- ============================================================================
-- FIX CLIENTS RLS - FINAL VERSION
-- The issue is that RLS policies are blocking access because of circular
-- references or missing agency memberships.
-- ============================================================================

-- First, let's check and drop all existing client policies to start fresh
DROP POLICY IF EXISTS "Agency members can view clients" ON clients;
DROP POLICY IF EXISTS "Agency admins can manage clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can manage clients" ON clients;

-- Create a simple, working policy for SELECT
-- This allows authenticated users to see clients from any agency they belong to
CREATE POLICY "Users can view clients in their agencies"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agency_members
      WHERE agency_members.user_id = auth.uid()
        AND agency_members.agency_id = clients.agency_id
    )
  );

-- Policy for INSERT - users can create clients in their agencies
CREATE POLICY "Users can create clients in their agencies"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_members
      WHERE agency_members.user_id = auth.uid()
        AND agency_members.agency_id = clients.agency_id
        AND agency_members.role IN ('owner', 'admin')
    )
  );

-- Policy for UPDATE - users can update clients in their agencies
CREATE POLICY "Users can update clients in their agencies"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agency_members
      WHERE agency_members.user_id = auth.uid()
        AND agency_members.agency_id = clients.agency_id
        AND agency_members.role IN ('owner', 'admin')
    )
  );

-- Policy for DELETE - users can delete clients in their agencies
CREATE POLICY "Users can delete clients in their agencies"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agency_members
      WHERE agency_members.user_id = auth.uid()
        AND agency_members.agency_id = clients.agency_id
        AND agency_members.role IN ('owner', 'admin')
    )
  );

-- Also ensure agency_members policies allow the subquery to work
DROP POLICY IF EXISTS "Users can view agency members" ON agency_members;
DROP POLICY IF EXISTS "Authenticated users can view agency members" ON agency_members;
DROP POLICY IF EXISTS "System can insert agency members" ON agency_members;

-- Simple policy: users can see their own memberships
CREATE POLICY "Users can view own memberships"
  ON agency_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow system/triggers to insert memberships
CREATE POLICY "Allow insert agency members"
  ON agency_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure agencies table allows viewing for members
DROP POLICY IF EXISTS "Users can view their agency" ON agencies;
DROP POLICY IF EXISTS "Authenticated users can view agencies" ON agencies;

CREATE POLICY "Users can view their agencies"
  ON agencies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agency_members
      WHERE agency_members.user_id = auth.uid()
        AND agency_members.agency_id = agencies.id
    )
  );
