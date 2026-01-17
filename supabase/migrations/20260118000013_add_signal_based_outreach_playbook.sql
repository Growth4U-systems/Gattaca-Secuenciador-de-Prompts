-- Add Signal-Based Outreach playbook

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

  -- Delete if exists to avoid conflicts
  DELETE FROM playbooks WHERE slug = 'signal-based-outreach';

  -- Insert Signal-Based Outreach playbook
  INSERT INTO playbooks (agency_id, name, slug, description, playbook_type, type, is_public, version, config)
  VALUES
    (
      sys_agency_id,
      'Signal-Based Outreach',
      'signal-based-outreach',
      'LinkedIn outreach usando señales de intención + lead magnet para 3x mejores tasas de respuesta. Genera 500+ leads ICP cualificados.',
      'signal_based_outreach',
      'signal_based_outreach',
      true,
      '1.0.0',
      '{"steps": ["map_topics", "find_creators", "evaluate_creators", "select_creators", "scrape_posts", "evaluate_posts", "select_posts", "scrape_engagers", "filter_icp", "lead_magnet_messages", "export_launch"]}'::jsonb
    );

  RAISE NOTICE 'Successfully inserted Signal-Based Outreach playbook';
END $$;
