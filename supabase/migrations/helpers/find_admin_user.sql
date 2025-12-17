-- Helper Script: Find Admin User UUID for Migration
-- Run this query in your production database to identify the target user
-- Copy the UUID from the result and paste it into the migration file

SELECT
  id as user_uuid,
  email,
  created_at,
  CASE
    WHEN created_at = (SELECT MIN(created_at) FROM auth.users) THEN '← OLDEST USER (likely admin)'
    ELSE ''
  END as note
FROM auth.users
ORDER BY created_at ASC;

-- After running this query:
-- 1. Copy the UUID of the user you want to assign projects to
-- 2. Open: supabase/migrations/20251217000001_migrate_placeholder_to_real_users.sql
-- 3. Replace 'YOUR_ADMIN_USER_UUID_HERE' with the copied UUID
-- 4. Deploy the migration
