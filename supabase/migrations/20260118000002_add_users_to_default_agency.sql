-- ============================================================================
-- ADD EXISTING USERS TO DEFAULT AGENCY
-- This migration ensures all existing users are added to the default agency
-- so they can access clients and other agency-scoped resources
-- ============================================================================

-- First ensure the default agency exists
INSERT INTO agencies (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Agency',
  'default'
)
ON CONFLICT (id) DO NOTHING;

-- Add all existing users to default agency as owners
INSERT INTO agency_members (agency_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, 'owner'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM agency_members
  WHERE agency_members.user_id = auth.users.id
    AND agency_members.agency_id = '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (agency_id, user_id) DO NOTHING;

-- ============================================================================
-- AUTO-ADD NEW USERS TO DEFAULT AGENCY
-- This trigger automatically adds new users to the default agency
-- ============================================================================
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
