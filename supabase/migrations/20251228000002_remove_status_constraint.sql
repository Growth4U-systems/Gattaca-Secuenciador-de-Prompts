-- ============================================================================
-- REMOVE STATUS CONSTRAINT FOR CUSTOM STATUSES
-- Date: 2025-12-28
-- Description: Removes the CHECK constraint on status to allow custom statuses
-- ============================================================================

-- Remove the status constraint to allow custom/user-defined statuses
ALTER TABLE ecp_campaigns DROP CONSTRAINT IF EXISTS ecp_campaigns_status_check;

-- Add a comment explaining why there's no constraint
COMMENT ON COLUMN ecp_campaigns.status IS 'Campaign status. Supports custom values defined in projects.custom_statuses. Common values: draft, in_progress, review, completed, error';
