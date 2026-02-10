/**
 * Migration script: Re-encrypt API keys from old format to new format
 *
 * Old format (api-keys/route.ts inline):
 *   - Salt: 'salt'
 *   - Encoding: hex (iv:authTag:encrypted)
 *
 * New format (lib/encryption.ts shared module):
 *   - Salt: 'gattaca-api-keys'
 *   - Encoding: base64 (iv:tag:ciphertext)
 *
 * Usage: npx tsx scripts/migrate-api-keys-encryption.ts
 */

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!ENCRYPTION_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: ENCRYPTION_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const ALGORITHM = 'aes-256-gcm'

// Old decryption (salt: 'salt', encoding: hex)
function decryptOld(encryptedData: string): string {
  const key = crypto.scryptSync(ENCRYPTION_KEY!, 'salt', 32)
  const parts = encryptedData.split(':')
  if (parts.length !== 3) throw new Error('Invalid old format')

  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// New encryption (salt: 'gattaca-api-keys', encoding: base64)
function encryptNew(text: string): string {
  const key = crypto.scryptSync(ENCRYPTION_KEY!, 'gattaca-api-keys', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const tag = cipher.getAuthTag()

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`
}

// Test if a value is in old format (hex-encoded parts)
function isOldFormat(value: string): boolean {
  const parts = value.split(':')
  if (parts.length !== 3) return false
  // Old format uses hex encoding - hex strings are longer and only have [0-9a-f]
  // Base64 strings contain [A-Za-z0-9+/=]
  const isHex = /^[0-9a-f]+$/i.test(parts[0])
  const hasUpperCase = /[A-Z+/]/.test(parts[0])
  // If it's all hex chars and no uppercase/special base64 chars, likely old format
  // Also: hex IV of 16 bytes = 32 chars, base64 IV of 16 bytes = 24 chars
  return isHex && !hasUpperCase && parts[0].length === 32
}

async function migrate() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

  const { data: keys, error } = await supabase
    .from('user_api_keys')
    .select('id, service_name, api_key_encrypted, user_id')

  if (error) {
    console.error('Failed to fetch keys:', error)
    process.exit(1)
  }

  if (!keys || keys.length === 0) {
    console.log('No API keys found in database.')
    return
  }

  console.log(`Found ${keys.length} API key(s) to check.\n`)

  let migrated = 0
  let skipped = 0
  let failed = 0

  for (const key of keys) {
    const label = `[${key.service_name}] user=${key.user_id.slice(0, 8)}...`

    if (!isOldFormat(key.api_key_encrypted)) {
      console.log(`${label} - Already in new format, skipping`)
      skipped++
      continue
    }

    try {
      // Decrypt with old format
      const plainKey = decryptOld(key.api_key_encrypted)
      console.log(`${label} - Decrypted OK (${plainKey.slice(0, 8)}...${plainKey.slice(-4)})`)

      // Re-encrypt with new format
      const newEncrypted = encryptNew(plainKey)

      // Update in database
      const { error: updateError } = await supabase
        .from('user_api_keys')
        .update({ api_key_encrypted: newEncrypted })
        .eq('id', key.id)

      if (updateError) {
        console.error(`${label} - UPDATE FAILED:`, updateError)
        failed++
      } else {
        console.log(`${label} - Migrated successfully`)
        migrated++
      }
    } catch (err) {
      console.error(`${label} - DECRYPT FAILED:`, (err as Error).message)
      failed++
    }
  }

  console.log(`\nDone! Migrated: ${migrated}, Skipped: ${skipped}, Failed: ${failed}`)
}

migrate().catch(console.error)
