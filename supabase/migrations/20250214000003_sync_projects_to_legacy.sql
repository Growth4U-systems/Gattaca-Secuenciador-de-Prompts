-- ============================================================================
-- SYNC PROJECTS TO PROJECTS_LEGACY
-- Date: 2025-02-14
-- Description: Automatically sync projects table to projects_legacy for FK compatibility
-- ============================================================================

-- Function to sync a project to projects_legacy
CREATE OR REPLACE FUNCTION sync_project_to_legacy()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Insert into projects_legacy
    INSERT INTO projects_legacy (
      id,
      user_id,
      name,
      description,
      flow_config,
      variable_definitions,
      deep_research_prompts,
      campaign_docs_guide,
      custom_statuses,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.name,
      NEW.description,
      NEW.legacy_flow_config,
      NEW.variable_definitions,
      NEW.deep_research_prompts,
      NEW.campaign_docs_guide,
      NEW.custom_statuses,
      NEW.created_at,
      NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      flow_config = EXCLUDED.flow_config,
      variable_definitions = EXCLUDED.variable_definitions,
      deep_research_prompts = EXCLUDED.deep_research_prompts,
      campaign_docs_guide = EXCLUDED.campaign_docs_guide,
      custom_statuses = EXCLUDED.custom_statuses,
      updated_at = EXCLUDED.updated_at;

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update projects_legacy
    UPDATE projects_legacy SET
      name = NEW.name,
      description = NEW.description,
      flow_config = NEW.legacy_flow_config,
      variable_definitions = NEW.variable_definitions,
      deep_research_prompts = NEW.deep_research_prompts,
      campaign_docs_guide = NEW.campaign_docs_guide,
      custom_statuses = NEW.custom_statuses,
      updated_at = NEW.updated_at
    WHERE id = NEW.id;

    -- If not exists, insert it
    IF NOT FOUND THEN
      INSERT INTO projects_legacy (
        id,
        user_id,
        name,
        description,
        flow_config,
        variable_definitions,
        deep_research_prompts,
        campaign_docs_guide,
        custom_statuses,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.user_id,
        NEW.name,
        NEW.description,
        NEW.legacy_flow_config,
        NEW.variable_definitions,
        NEW.deep_research_prompts,
        NEW.campaign_docs_guide,
        NEW.custom_statuses,
        NEW.created_at,
        NEW.updated_at
      );
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Delete from projects_legacy
    DELETE FROM projects_legacy WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on projects table
DROP TRIGGER IF EXISTS sync_projects_to_legacy_trigger ON projects;
CREATE TRIGGER sync_projects_to_legacy_trigger
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_project_to_legacy();

-- Comment
COMMENT ON FUNCTION sync_project_to_legacy() IS 'Syncs projects table to projects_legacy for FK compatibility with ecp_campaigns';
