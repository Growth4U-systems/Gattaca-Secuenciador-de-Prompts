import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envFile = readFileSync('.env.local', 'utf-8')
envFile.split('\n').forEach(line => {
  const idx = line.indexOf('=')
  if (idx > 0) {
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  const { data, error } = await supabase.from('playbooks').select('name, playbook_type, slug').order('name')
  if (error) {
    console.error('Error:', error)
    return
  }
  console.log('Total playbooks:', data?.length)
  data?.forEach(p => console.log(' -', p.name, '|', p.playbook_type, '|', p.slug))
}

check()
