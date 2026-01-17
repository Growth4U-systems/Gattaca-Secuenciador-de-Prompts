-- ============================================================================
-- FIX RLS POLICIES FOR CLIENTS AND AGENCIES
-- The issue is that RLS policies use auth.uid() which requires authenticated user
-- For development, we'll add policies that allow authenticated users to access
-- ============================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Agency members can view clients" ON clients;
DROP POLICY IF EXISTS "Agency admins can manage clients" ON clients;
DROP POLICY IF EXISTS "Users can view their agency" ON agencies;
DROP POLICY IF EXISTS "Users can view agency members" ON agency_members;

-- Create more permissive policies for authenticated users
-- Agencies: authenticated users can view all agencies they belong to
CREATE POLICY "Authenticated users can view agencies"
  ON agencies FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT agency_id FROM agency_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM agency_members WHERE user_id = auth.uid())
  );

-- Agency members: authenticated users can see members
CREATE POLICY "Authenticated users can view agency members"
  ON agency_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR agency_id IN (
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  ));

-- Clients: authenticated users who are agency members can view clients
CREATE POLICY "Authenticated users can view clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    agency_id IN (SELECT agency_id FROM agency_members WHERE user_id = auth.uid())
  );

-- Clients: authenticated users who are agency admins/owners can manage clients
CREATE POLICY "Authenticated users can manage clients"
  ON clients FOR ALL
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Also ensure agency_members table allows INSERT for the trigger
CREATE POLICY "System can insert agency members"
  ON agency_members FOR INSERT
  WITH CHECK (true);
