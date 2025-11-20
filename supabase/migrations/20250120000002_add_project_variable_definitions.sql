-- Migration: Add variable_definitions to projects
-- Allows projects to define global variables with default values
-- Campaigns inherit these variables and can override values

-- Add variable_definitions column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS variable_definitions JSONB DEFAULT '[]'::jsonb;

-- Comment explaining the system
COMMENT ON COLUMN projects.variable_definitions IS
'Global variable definitions for this project. Each campaign will inherit these variables.
Structure: [{"name": "var_name", "default_value": "default", "required": false, "description": "..."}]
Example: [
  {"name": "target_audience", "default_value": "CTOs", "required": true, "description": "Target audience segment"},
  {"name": "budget_range", "default_value": "", "required": false, "description": "Budget range for the campaign"}
]
Campaigns can override these values in their custom_variables field.';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_variable_definitions ON projects USING GIN (variable_definitions);
