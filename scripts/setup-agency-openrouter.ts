/**
 * Script para configurar la API key de OpenRouter a nivel de agencia
 *
 * Uso:
 *   npx ts-node scripts/setup-agency-openrouter.ts
 *
 * O con variables de entorno:
 *   OPENROUTER_KEY="sk-or-v1-xxx" npx ts-node scripts/setup-agency-openrouter.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'
import * as readline from 'readline'

// Configuración de encriptación (debe coincidir con src/lib/encryption.ts)
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT = 'gattaca-api-keys'

function encrypt(text: string, key: string): string {
  const keyBuffer = crypto.scryptSync(key, SALT, 32)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv)

  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const tag = cipher.getAuthTag()

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`
}

function generateKeyHint(apiKey: string): string {
  if (apiKey.length < 4) return '****'
  return '...' + apiKey.slice(-4)
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function main() {
  console.log('🔧 Configuración de OpenRouter para Growth4U\n')

  // Verificar variables de entorno
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const encryptionKey = process.env.ENCRYPTION_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    console.log('\nEjecuta con: source .env.local && npx ts-node scripts/setup-agency-openrouter.ts')
    process.exit(1)
  }

  if (!encryptionKey) {
    console.error('❌ Falta variable de entorno ENCRYPTION_KEY')
    process.exit(1)
  }

  // Obtener API key
  let openrouterKey = process.env.OPENROUTER_KEY
  if (!openrouterKey) {
    openrouterKey = await prompt('Introduce la API key de OpenRouter (sk-or-...): ')
  }

  if (!openrouterKey.startsWith('sk-or-')) {
    console.error('❌ La API key debe empezar con sk-or-')
    process.exit(1)
  }

  // Conectar a Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // 1. Primero verificar/crear las columnas
  console.log('\n📋 Verificando schema de la tabla agencies...')

  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE agencies ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT;
      ALTER TABLE agencies ADD COLUMN IF NOT EXISTS openrouter_key_hint TEXT;
      ALTER TABLE agencies ADD COLUMN IF NOT EXISTS openrouter_key_last_used_at TIMESTAMPTZ;
    `
  }).single()

  if (alterError) {
    console.log('⚠️  No se pudo ejecutar ALTER TABLE via RPC (puede que las columnas ya existan)')
  }

  // 2. Obtener la agencia Growth4U
  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .select('id, name, slug')
    .eq('slug', 'growth4u')
    .single()

  if (agencyError || !agency) {
    console.error('❌ No se encontró la agencia Growth4U')
    console.error(agencyError)
    process.exit(1)
  }

  console.log(`✅ Agencia encontrada: ${agency.name} (${agency.id})`)

  // 3. Encriptar la API key
  const encryptedKey = encrypt(openrouterKey, encryptionKey)
  const keyHint = generateKeyHint(openrouterKey)

  console.log(`🔐 Key encriptada: ${keyHint}`)

  // 4. Guardar en la base de datos
  const { error: updateError } = await supabase
    .from('agencies')
    .update({
      openrouter_api_key: encryptedKey,
      openrouter_key_hint: keyHint,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agency.id)

  if (updateError) {
    console.error('❌ Error al guardar la API key:', updateError)
    process.exit(1)
  }

  // 5. Obtener miembros de la agencia
  const { data: members, error: membersError } = await supabase
    .from('agency_members')
    .select('user_id, role')
    .eq('agency_id', agency.id)

  console.log('\n✅ ¡Configuración completada!')
  console.log(`\n📊 La API key de OpenRouter está ahora disponible para ${members?.length || 0} miembros:`)

  if (members) {
    for (const member of members) {
      console.log(`   - ${member.user_id} (${member.role})`)
    }
  }

  console.log('\n🚀 Todos los miembros de Growth4U ahora usarán automáticamente esta API key.')
}

main().catch(console.error)
