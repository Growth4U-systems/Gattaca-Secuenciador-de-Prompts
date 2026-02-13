-- Migration: Update all competitor analysis playbook steps to use Gemini 3 Flash Preview
-- This updates existing project_playbooks and client_playbooks to use google/gemini-3-flash-preview
-- for all steps in the competitor analysis flow.

-- =============================================
-- 1. Update project_playbooks
-- =============================================
UPDATE project_playbooks
SET config = jsonb_set(
  config,
  '{flow_config,steps}',
  (
    SELECT jsonb_agg(
      jsonb_set(step, '{model}', '"google/gemini-3-flash-preview"'::jsonb)
    )
    FROM jsonb_array_elements(config->'flow_config'->'steps') AS step
  )
)
WHERE playbook_type = 'competitor_analysis'
  AND config->'flow_config'->'steps' IS NOT NULL;

-- =============================================
-- 2. Update client_playbooks
-- =============================================
UPDATE client_playbooks
SET config = jsonb_set(
  config,
  '{flow_config,steps}',
  (
    SELECT jsonb_agg(
      jsonb_set(step, '{model}', '"google/gemini-3-flash-preview"'::jsonb)
    )
    FROM jsonb_array_elements(config->'flow_config'->'steps') AS step
  )
)
WHERE playbook_type = 'competitor_analysis'
  AND config->'flow_config'->'steps' IS NOT NULL;
