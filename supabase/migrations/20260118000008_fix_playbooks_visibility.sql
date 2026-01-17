-- Migration: Fix playbooks visibility
-- Allow all authenticated users to view playbooks (they are templates, not sensitive data)

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Agency members can view playbooks" ON playbooks;

-- Create new policy allowing all authenticated users to view playbooks
CREATE POLICY "Authenticated users can view playbooks"
  ON playbooks FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Make existing playbooks public for backwards compatibility
UPDATE playbooks SET is_public = true WHERE is_public IS NULL OR is_public = false;

-- Add comment for documentation
COMMENT ON POLICY "Authenticated users can view playbooks" ON playbooks IS 'All authenticated users can view playbook templates';
