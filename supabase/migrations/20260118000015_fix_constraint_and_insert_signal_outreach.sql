-- Fix check constraint and insert Signal-Based Outreach playbook

-- Update the check constraint on playbooks table to allow signal_based_outreach
ALTER TABLE playbooks DROP CONSTRAINT IF EXISTS playbooks_playbook_type_check;
ALTER TABLE playbooks ADD CONSTRAINT playbooks_playbook_type_check
  CHECK (playbook_type IN ('ecp', 'niche_finder', 'competitor_analysis', 'signal_based_outreach', 'video_viral_ia', 'custom'));

-- Insert Signal-Based Outreach playbook
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
  DELETE FROM playbooks WHERE slug = 'signal-based-outreach';

  -- Insert Signal-Based Outreach playbook
  INSERT INTO playbooks (agency_id, name, slug, description, playbook_type, type, is_public, version, config)
  VALUES
    (
      sys_agency_id,
      'Signal-Based Outreach',
      'signal-based-outreach',
      'LinkedIn outreach usando senales de intencion + lead magnet. Encuentra creadores de contenido cuya audiencia coincide con tu ICP, scrapea engagers y genera mensajes personalizados.',
      'signal_based_outreach',
      'signal_based_outreach',
      true,
      '2.0.0',
      '{"steps": ["map_topics", "find_creators", "evaluate_creators", "select_creators", "scrape_posts", "evaluate_posts", "select_posts", "scrape_engagers", "filter_icp", "lead_magnet_messages", "export_launch"]}'::jsonb
    );

  RAISE NOTICE 'Successfully inserted Signal-Based Outreach playbook';
END $$;
