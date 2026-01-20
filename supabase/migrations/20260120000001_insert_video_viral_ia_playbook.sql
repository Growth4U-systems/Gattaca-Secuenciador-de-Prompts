-- Migration: Insert Video Viral IA playbook
-- Description: Adds the Video Viral IA playbook converted from n8n workflow
-- Source: https://n8n.io/workflows/5338

-- Ensure the enum value exists (may already exist)
DO $$
BEGIN
  -- Try to add the enum value if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'video_viral_ia'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'playbook_type')
  ) THEN
    ALTER TYPE playbook_type ADD VALUE 'video_viral_ia';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Value already exists, ignore
    NULL;
END $$;

-- Insert Video Viral IA playbook
DO $$
DECLARE
  sys_agency_id UUID;
BEGIN
  -- Get the existing System agency
  SELECT id INTO sys_agency_id FROM agencies WHERE id = '00000000-0000-0000-0000-000000000001';

  IF sys_agency_id IS NULL THEN
    -- Try to get any agency
    SELECT id INTO sys_agency_id FROM agencies LIMIT 1;
  END IF;

  IF sys_agency_id IS NULL THEN
    RAISE EXCEPTION 'No agency found in database';
  END IF;

  -- Delete any existing playbook with this slug to avoid conflicts
  DELETE FROM playbooks WHERE slug = 'video-viral-ia';

  -- Insert Video Viral IA playbook
  INSERT INTO playbooks (agency_id, name, slug, description, playbook_type, type, is_public, version, config)
  VALUES
    (
      sys_agency_id,
      'Video Viral IA',
      'video-viral-ia',
      'Genera videos virales ASMR usando IA. Crea ideas, escenas, clips, audio y video final listo para publicar en TikTok, YouTube e Instagram. Convertido desde workflow n8n.',
      'video_viral_ia',
      'video_viral_ia',
      true,
      '1.0.0',
      '{
        "steps": [
          "generate_idea",
          "review_idea",
          "generate_scenes",
          "generate_clips",
          "generate_audio",
          "compose_video",
          "preview",
          "export"
        ],
        "phases": [
          {
            "id": "ideation",
            "name": "Ideacion",
            "steps": ["generate_idea", "review_idea"]
          },
          {
            "id": "production",
            "name": "Produccion",
            "steps": ["generate_scenes", "generate_clips"]
          },
          {
            "id": "post_production",
            "name": "Post-Produccion",
            "steps": ["generate_audio", "compose_video"]
          },
          {
            "id": "publication",
            "name": "Publicacion",
            "steps": ["preview", "export"]
          }
        ],
        "source": "n8n",
        "n8n_workflow_url": "https://n8n.io/workflows/5338",
        "n8n_workflow_name": "Generate AI Videos with Seedance & Blotato"
      }'::jsonb
    );

  RAISE NOTICE 'Successfully inserted Video Viral IA playbook';
END $$;
