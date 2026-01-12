/**
 * Script to encrypt and save OpenRouter API key for an agency
 * Usage: OPENROUTER_KEY=sk-or-xxx npx ts-node scripts/encrypt-agency-key.ts
 */

import { createCipheriv, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }
  return Buffer.from(key, 'hex')
}

function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()

  // Combine: iv (16) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted])
  return combined.toString('base64')
}

function getKeyHint(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return '***'
  return '...' + apiKey.slice(-4)
}

async function main() {
  const openrouterKey = process.env.OPENROUTER_KEY
  if (!openrouterKey) {
    console.error('Error: Set OPENROUTER_KEY environment variable')
    console.error('Usage: OPENROUTER_KEY=sk-or-xxx npx ts-node scripts/encrypt-agency-key.ts')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  console.log('Encrypting OpenRouter key...')
  const encryptedKey = encryptToken(openrouterKey)
  const keyHint = getKeyHint(openrouterKey)

  console.log('Encrypted key:', encryptedKey.substring(0, 50) + '...')
  console.log('Key hint:', keyHint)

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Update Growth4U agency
  const { data, error } = await supabase
    .from('agencies')
    .update({
      openrouter_api_key: encryptedKey,
      openrouter_key_hint: keyHint
    })
    .eq('name', 'Growth4U')
    .select()

  if (error) {
    console.error('Error updating agency:', error)
    process.exit(1)
  }

  console.log('Successfully updated Growth4U agency!')
  console.log('Updated record:', data)
}

main()
