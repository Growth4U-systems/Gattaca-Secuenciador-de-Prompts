-- Fix: Seed playbooks with explicit agency creation
-- The previous migration failed because no agencies existed

-- First create the System agency if it doesn't exist
INSERT INTO agencies (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'System', 'system')
ON CONFLICT (id) DO NOTHING;

-- Now insert the playbooks using the known System agency ID
INSERT INTO playbooks (id, agency_id, name, slug, description, playbook_type, type, is_public, version, config)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'ECP Positioning',
    'ecp-positioning',
    'Estrategia de posicionamiento de marca basada en el framework ECP (Earned, Credibility, Proof). Genera assets de marketing con posicionamiento diferenciado.',
    'ecp',
    'ecp',
    true,
    '1.0.0',
    '{"steps": ["deep_research", "find_place", "select_assets", "proof_legit", "final_output"]}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
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
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Competitor Analysis',
    'competitor-analysis',
    'Analisis profundo de competidores incluyendo posicionamiento, mensajes clave, diferenciadores y oportunidades de mercado.',
    'competitor_analysis',
    'competitor_analysis',
    true,
    '1.0.0',
    '{"steps": ["identify_competitors", "analyze_positioning", "compare_features", "find_gaps", "recommendations"]}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_public = EXCLUDED.is_public,
  config = EXCLUDED.config,
  type = EXCLUDED.type,
  updated_at = NOW();
