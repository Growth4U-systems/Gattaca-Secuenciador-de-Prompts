-- ============================================================================
-- ASSIGN ALL EXISTING CLIENTS TO DEFAULT AGENCY
-- This ensures all clients are accessible to users in the default agency
-- ============================================================================

-- Update all clients that don't have an agency or have a different agency
UPDATE clients
SET agency_id = '00000000-0000-0000-0000-000000000001'
WHERE agency_id IS NULL
   OR agency_id NOT IN (SELECT id FROM agencies);

-- Also update any clients with invalid agency references
UPDATE clients
SET agency_id = '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM agencies WHERE agencies.id = clients.agency_id);
