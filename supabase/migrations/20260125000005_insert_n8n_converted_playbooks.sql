-- Migration: Insert n8n converted playbooks
-- Description: Adds 3 playbooks converted from n8n workflows:
--   - SEO Seed Keywords Generator
--   - LinkedIn Post Generator
--   - GitHub Fork to CRM
-- NOTE: Depends on 20260125000004_add_n8n_playbook_enum_values.sql
-- Date: 2026-01-25

-- First, update the check constraint to allow new playbook types
ALTER TABLE playbooks DROP CONSTRAINT IF EXISTS playbooks_playbook_type_check;
ALTER TABLE playbooks ADD CONSTRAINT playbooks_playbook_type_check
  CHECK (playbook_type IN (
    'ecp',
    'niche_finder',
    'competitor_analysis',
    'signal_based_outreach',
    'video_viral_ia',
    'custom',
    'seo-seed-keywords',
    'linkedin-post-generator',
    'github-fork-to-crm'
  ));

-- Insert the 3 new playbooks
DO $$
DECLARE
  sys_agency_id UUID;
BEGIN
  -- Get the existing System agency
  SELECT id INTO sys_agency_id FROM agencies WHERE id = '00000000-0000-0000-0000-000000000001';

  IF sys_agency_id IS NULL THEN
    SELECT id INTO sys_agency_id FROM agencies LIMIT 1;
  END IF;

  IF sys_agency_id IS NULL THEN
    RAISE EXCEPTION 'No agency found in database';
  END IF;

  -- Delete existing playbooks with these slugs to avoid conflicts
  DELETE FROM playbooks WHERE slug IN ('seo-seed-keywords', 'linkedin-post-generator', 'github-fork-to-crm');

  -- 1. SEO Seed Keywords Generator
  INSERT INTO playbooks (agency_id, name, slug, description, playbook_type, type, is_public, version, config)
  VALUES
    (
      sys_agency_id,
      'SEO Seed Keywords Generator',
      'seo-seed-keywords',
      'Genera 15-20 seed keywords SEO basadas en tu Ideal Customer Profile usando análisis de IA. Analiza pain points, goals y comportamiento de búsqueda.',
      'seo-seed-keywords',
      'seo-seed-keywords',
      true,
      '1.0.0',
      '{
        "steps": [
          "define_icp",
          "generate_keywords",
          "review_keywords"
        ],
        "phases": [
          {
            "id": "input",
            "name": "Define tu ICP",
            "steps": ["define_icp"]
          },
          {
            "id": "generate",
            "name": "Generar Keywords",
            "steps": ["generate_keywords"]
          },
          {
            "id": "review",
            "name": "Revisar y Exportar",
            "steps": ["review_keywords"]
          }
        ],
        "source": "n8n",
        "n8n_workflow_name": "Generate SEO Seed Keywords Using AI"
      }'::jsonb
    );

  -- 2. LinkedIn Post Generator
  INSERT INTO playbooks (agency_id, name, slug, description, playbook_type, type, is_public, version, config)
  VALUES
    (
      sys_agency_id,
      'LinkedIn Post Generator',
      'linkedin-post-generator',
      'Genera posts virales de LinkedIn basados en tu perfil de creador y contenido de referencia. Mantén tu presencia activa sin bloqueo de escritor.',
      'linkedin-post-generator',
      'linkedin-post-generator',
      true,
      '1.0.0',
      '{
        "steps": [
          "input_profile",
          "add_reference",
          "generate_post",
          "review_post"
        ],
        "phases": [
          {
            "id": "setup",
            "name": "Configuración",
            "steps": ["input_profile", "add_reference"]
          },
          {
            "id": "generate",
            "name": "Generación",
            "steps": ["generate_post"]
          },
          {
            "id": "review",
            "name": "Revisión",
            "steps": ["review_post"]
          }
        ],
        "source": "n8n",
        "n8n_workflow_name": "LinkedIn Post Generator"
      }'::jsonb
    );

  -- 3. GitHub Fork to CRM
  INSERT INTO playbooks (agency_id, name, slug, description, playbook_type, type, is_public, version, config)
  VALUES
    (
      sys_agency_id,
      'GitHub Fork to CRM',
      'github-fork-to-crm',
      'Convierte forks de GitHub en leads de CRM automáticamente. Extrae datos del usuario, verifica duplicados y crea leads en Pipedrive con contexto enriquecido.',
      'github-fork-to-crm',
      'github-fork-to-crm',
      true,
      '1.0.0',
      '{
        "steps": [
          "input_fork",
          "fetch_github_user",
          "check_contact",
          "decide_create_lead",
          "create_lead"
        ],
        "phases": [
          {
            "id": "input",
            "name": "Datos del Fork",
            "steps": ["input_fork"]
          },
          {
            "id": "enrich",
            "name": "Enriquecer Datos",
            "steps": ["fetch_github_user", "check_contact"]
          },
          {
            "id": "action",
            "name": "Crear Lead",
            "steps": ["decide_create_lead", "create_lead"]
          }
        ],
        "source": "n8n",
        "n8n_workflow_name": "GitHub Fork to Pipedrive CRM"
      }'::jsonb
    );

  RAISE NOTICE 'Successfully inserted 3 n8n converted playbooks';
END $$;
