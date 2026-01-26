-- Migration: Add enum values for n8n converted playbooks
-- Description: Adds playbook_type enum values for the 3 n8n workflows
-- NOTE: Enum values must be added in a separate transaction before they can be used
-- Date: 2026-01-25

-- seo-seed-keywords
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'seo-seed-keywords'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'playbook_type')
  ) THEN
    ALTER TYPE playbook_type ADD VALUE 'seo-seed-keywords';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- linkedin-post-generator
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'linkedin-post-generator'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'playbook_type')
  ) THEN
    ALTER TYPE playbook_type ADD VALUE 'linkedin-post-generator';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- github-fork-to-crm
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'github-fork-to-crm'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'playbook_type')
  ) THEN
    ALTER TYPE playbook_type ADD VALUE 'github-fork-to-crm';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
