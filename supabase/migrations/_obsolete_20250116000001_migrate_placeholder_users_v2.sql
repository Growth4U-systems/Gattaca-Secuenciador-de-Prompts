-- Migration: Assign placeholder projects to first admin user
-- This migration handles projects created before auth was implemented
-- Date: 2025-01-16

DO $$
DECLARE
  target_user_id UUID;
  placeholder_id UUID := '00000000-0000-0000-0000-000000000000';
  updated_count INTEGER;
BEGIN
  -- DEVELOPMENT: Use first user in auth.users table
  -- PRODUCTION: Replace with specific admin user ID
  SELECT id INTO target_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no users exist yet, create a placeholder comment
  IF target_user_id IS NULL THEN
    RAISE NOTICE 'No users found in auth.users. Please create an admin user first, then run this migration.';
    RAISE NOTICE 'To create a user, sign up via the application at /auth/login';
  ELSE
    -- Update all projects with placeholder user_id
    UPDATE projects
    SET user_id = target_user_id,
        updated_at = NOW()
    WHERE user_id = placeholder_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    RAISE NOTICE 'Migration complete: Updated % project(s) from placeholder to user %',
      updated_count,
      target_user_id;

    IF updated_count = 0 THEN
      RAISE NOTICE 'No projects with placeholder user_id found. Migration not needed.';
    END IF;
  END IF;
END $$;

-- For production, replace the SELECT query above with:
-- target_user_id := 'YOUR_SPECIFIC_ADMIN_USER_UUID_HERE';
