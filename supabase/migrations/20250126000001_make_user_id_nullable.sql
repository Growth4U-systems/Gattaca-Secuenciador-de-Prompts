-- Make user_id nullable in projects table for development without auth
-- This allows creating projects without a valid user_id

ALTER TABLE projects
    ALTER COLUMN user_id DROP NOT NULL;

-- Set default to null instead of requiring a user
ALTER TABLE projects
    ALTER COLUMN user_id SET DEFAULT NULL;

-- Update any existing rows with the placeholder user_id to null
UPDATE projects
SET user_id = NULL
WHERE user_id = '00000000-0000-0000-0000-000000000000';
