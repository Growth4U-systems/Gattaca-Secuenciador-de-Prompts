-- Migration: Make problem_core optional in ecp_campaigns
-- This allows creating campaigns without requiring problem_core field
-- (supports the variables-only system)

-- Remove the check constraint that requires at least 1 character
ALTER TABLE ecp_campaigns DROP CONSTRAINT IF EXISTS campaigns_problem_check;

-- Allow NULL values for problem_core
ALTER TABLE ecp_campaigns ALTER COLUMN problem_core DROP NOT NULL;

-- Also make country and industry optional for consistency
ALTER TABLE ecp_campaigns ALTER COLUMN country DROP NOT NULL;
ALTER TABLE ecp_campaigns ALTER COLUMN industry DROP NOT NULL;
