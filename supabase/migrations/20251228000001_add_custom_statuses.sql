-- ============================================================================
-- ADD CUSTOM STATUS CATEGORIES TO PROJECTS
-- Date: 2025-12-28
-- Description: Allows projects to define custom status categories for campaigns
-- ============================================================================

-- Add custom_statuses column to projects table
-- This stores an array of custom status definitions with name, color, and icon
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS custom_statuses JSONB DEFAULT '[
  {"id": "draft", "name": "Borrador", "color": "gray", "icon": "clock", "isDefault": true},
  {"id": "in_progress", "name": "En progreso", "color": "blue", "icon": "play"},
  {"id": "review", "name": "En revisión", "color": "yellow", "icon": "eye"},
  {"id": "completed", "name": "Completado", "color": "green", "icon": "check"},
  {"id": "error", "name": "Error", "color": "red", "icon": "alert"}
]'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN projects.custom_statuses IS 'Array of custom status definitions. Each status has: id (string), name (string), color (string: gray|blue|yellow|green|red|purple|orange|pink), icon (string: clock|play|eye|check|alert|pause|star), isDefault (boolean, optional)';
