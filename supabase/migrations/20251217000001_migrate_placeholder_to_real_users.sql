-- Migration: Assign placeholder projects to specific admin user (PRODUCTION)
-- Date: 2025-12-17
-- Description: Migrates projects with placeholder user_id to a specific authenticated user
-- This migration is idempotent and safe to run multiple times

-- ============================================================================
-- IMPORTANT: CONFIGURE TARGET USER BEFORE DEPLOYING
-- ============================================================================
-- Replace 'YOUR_ADMIN_USER_UUID_HERE' with the actual UUID of the target user
-- You can find user UUIDs in: Supabase Dashboard > Authentication > Users
-- ============================================================================

DO $$
DECLARE
  -- 🔧 CONFIGURE THIS: Replace with your admin user UUID
  target_user_id UUID;

  -- Internal variables
  placeholder_id UUID := '00000000-0000-0000-0000-000000000000';
  updated_count INTEGER;
  user_email TEXT;
BEGIN
  -- Skip if no user is configured (safe for local development)
  SELECT id INTO target_user_id FROM auth.users LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'No users found. Skipping placeholder migration.';
    RETURN;
  END IF;

  -- Check if there are any projects that need migration
  SELECT COUNT(*) INTO updated_count
  FROM projects
  WHERE user_id = placeholder_id;

  IF updated_count = 0 THEN
    RAISE NOTICE '✓ No projects with placeholder user_id found. Migration not needed.';
    RETURN;
  END IF;

  -- Verify that the target user exists and get their email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = target_user_id;

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'Target user % does not exist in auth.users. Please verify the UUID.', target_user_id;
  END IF;

  -- Log what we're about to do
  RAISE NOTICE 'Found % project(s) to migrate', updated_count;
  RAISE NOTICE 'Target user: % (%)', target_user_id, user_email;

  -- Perform the migration
  UPDATE projects
  SET user_id = target_user_id,
      updated_at = NOW()
  WHERE user_id = placeholder_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Success message
  RAISE NOTICE '✓ Migration complete: Updated % project(s) to user %',
    updated_count,
    target_user_id;

  -- Additional info for verification
  RAISE NOTICE 'To verify: SELECT COUNT(*) FROM projects WHERE user_id = ''%''', target_user_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Migration failed: %', SQLERRM;
END $$;

-- Post-migration verification query (commented out, uncomment to run manually)
-- SELECT
--   COUNT(*) FILTER (WHERE user_id = '00000000-0000-0000-0000-000000000000') as placeholder_projects,
--   COUNT(*) FILTER (WHERE user_id != '00000000-0000-0000-0000-000000000000') as assigned_projects,
--   COUNT(DISTINCT user_id) as unique_users
-- FROM projects;
