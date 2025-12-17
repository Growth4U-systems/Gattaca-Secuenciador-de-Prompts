-- ============================================================================
-- AUTO-ADD PROJECT OWNER TO project_members
-- Date: 2025-12-18
-- Description: Automatically adds project creator as owner in project_members table
-- ============================================================================

-- Function to automatically add project creator as owner
CREATE OR REPLACE FUNCTION auto_add_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the creator as owner in project_members
  -- Only if user_id is not null and not a placeholder UUID
  IF NEW.user_id IS NOT NULL AND NEW.user_id != '00000000-0000-0000-0000-000000000000' THEN
    INSERT INTO project_members (project_id, user_id, role, added_at)
    VALUES (NEW.id, NEW.user_id, 'owner', NEW.created_at)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after project insert
DROP TRIGGER IF EXISTS trigger_auto_add_project_owner ON projects;
CREATE TRIGGER trigger_auto_add_project_owner
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_project_owner();

-- Comment for clarity
COMMENT ON FUNCTION auto_add_project_owner() IS 'Automatically adds project creator as owner in project_members table when a new project is created';
