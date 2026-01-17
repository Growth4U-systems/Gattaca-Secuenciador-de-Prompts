-- Final fix: Seed playbooks
-- The System agency already exists from previous migration

-- Get the System agency ID and insert playbooks
DO $$
DECLARE
  sys_agency_id UUID;
BEGIN
  -- Get the existing System agency (created in previous migration)
  SELECT id INTO sys_agency_id FROM agencies WHERE id = '00000000-0000-0000-0000-000000000001';

  IF sys_agency_id IS NULL THEN
    -- Try to get any agency
    SELECT id INTO sys_agency_id FROM agencies LIMIT 1;
  END IF;

  IF sys_agency_id IS NULL THEN
    RAISE EXCEPTION 'No agency found in database';
  END IF;

  RAISE NOTICE 'Using agency ID: %', sys_agency_id;

  -- Delete any existing playbooks with these slugs to avoid conflicts
  DELETE FROM playbooks WHERE slug IN ('ecp-positioning', 'niche-finder', 'competitor-analysis');

  -- Insert playbooks
  INSERT INTO playbooks (agency_id, name, slug, description, playbook_type, type, is_public, version, config)
  VALUES
    (
      sys_agency_id,
      'ECP Positioning',
      'ecp-positioning',
      'Define el Early Customer Profile (ECP) ideal para tu producto. Identifica los primeros adoptantes y genera estrategia de posicionamiento diferenciado.',
      'ecp',
      'ecp',
      true,
      '1.0.0',
      '{"steps": ["deep_research", "find_place", "select_assets", "proof_legit", "final_output"]}'::jsonb
    ),
    (
      sys_agency_id,
      'Niche Finder',
      'niche-finder',
      'Descubre nichos de mercado rentables usando analisis de competencia, busqueda de foros y validacion de demanda. Ideal para encontrar oportunidades B2B o B2C.',
      'niche_finder',
      'niche_finder',
      true,
      '1.0.0',
      '{"steps": ["suggest_niches", "serp_analysis", "scrape_sources", "extract_insights", "analyze_results"]}'::jsonb
    ),
    (
      sys_agency_id,
      'Competitor Analysis',
      'competitor-analysis',
      'Analisis profundo de competidores incluyendo posicionamiento, mensajes clave, diferenciadores y oportunidades de mercado.',
      'competitor_analysis',
      'competitor_analysis',
      true,
      '1.0.0',
      '{"steps": ["identify_competitors", "analyze_positioning", "compare_features", "find_gaps", "recommendations"]}'::jsonb
    );

  RAISE NOTICE 'Successfully inserted 3 playbooks';
END $$;
