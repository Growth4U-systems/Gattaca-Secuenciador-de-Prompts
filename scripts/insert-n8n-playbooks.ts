import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load .env.local manually
const envFile = readFileSync('.env.local', 'utf-8')
envFile.split('\n').forEach(line => {
  const idx = line.indexOf('=')
  if (idx > 0) {
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function insertPlaybooks() {
  const { data: agencies } = await supabase.from('agencies').select('id').limit(1)
  if (!agencies || agencies.length === 0) {
    console.error('No agency found')
    process.exit(1)
  }

  const agencyId = agencies[0].id
  console.log('Using agency:', agencyId)

  // Delete existing
  const { error: deleteError } = await supabase
    .from('playbooks')
    .delete()
    .in('slug', ['seo-seed-keywords', 'linkedin-post-generator', 'github-fork-to-crm'])

  if (deleteError) {
    console.log('Delete result:', deleteError.message)
  }

  // Insert new playbooks
  const { data, error } = await supabase.from('playbooks').insert([
    {
      agency_id: agencyId,
      name: 'SEO Seed Keywords Generator',
      slug: 'seo-seed-keywords',
      description: 'Genera 15-20 seed keywords SEO basadas en tu Ideal Customer Profile usando análisis de IA.',
      playbook_type: 'seo-seed-keywords',
      type: 'seo-seed-keywords',
      is_public: true,
      version: '1.0.0',
      config: {
        steps: ['define_icp', 'generate_keywords', 'review_keywords'],
        phases: [
          { id: 'input', name: 'Define tu ICP', steps: ['define_icp'] },
          { id: 'generate', name: 'Generar Keywords', steps: ['generate_keywords'] },
          { id: 'review', name: 'Revisar y Exportar', steps: ['review_keywords'] }
        ],
        source: 'n8n',
        n8n_workflow_name: 'Generate SEO Seed Keywords Using AI'
      }
    },
    {
      agency_id: agencyId,
      name: 'LinkedIn Post Generator',
      slug: 'linkedin-post-generator',
      description: 'Genera posts virales de LinkedIn basados en tu perfil de creador y contenido de referencia.',
      playbook_type: 'linkedin-post-generator',
      type: 'linkedin-post-generator',
      is_public: true,
      version: '1.0.0',
      config: {
        steps: ['input_profile', 'add_reference', 'generate_post', 'review_post'],
        phases: [
          { id: 'setup', name: 'Configuración', steps: ['input_profile', 'add_reference'] },
          { id: 'generate', name: 'Generación', steps: ['generate_post'] },
          { id: 'review', name: 'Revisión', steps: ['review_post'] }
        ],
        source: 'n8n',
        n8n_workflow_name: 'LinkedIn Post Generator'
      }
    },
    {
      agency_id: agencyId,
      name: 'GitHub Fork to CRM',
      slug: 'github-fork-to-crm',
      description: 'Convierte forks de GitHub en leads de CRM automáticamente.',
      playbook_type: 'github-fork-to-crm',
      type: 'github-fork-to-crm',
      is_public: true,
      version: '1.0.0',
      config: {
        steps: ['input_fork', 'fetch_github_user', 'check_contact', 'decide_create_lead', 'create_lead'],
        phases: [
          { id: 'input', name: 'Datos del Fork', steps: ['input_fork'] },
          { id: 'enrich', name: 'Enriquecer Datos', steps: ['fetch_github_user', 'check_contact'] },
          { id: 'action', name: 'Crear Lead', steps: ['decide_create_lead', 'create_lead'] }
        ],
        source: 'n8n',
        n8n_workflow_name: 'GitHub Fork to Pipedrive CRM'
      }
    }
  ]).select()

  if (error) {
    console.error('Insert error:', error)
    process.exit(1)
  }

  console.log('Inserted', data.length, 'playbooks:')
  data.forEach(p => console.log(' -', p.name, '(' + p.playbook_type + ')'))
}

insertPlaybooks()
