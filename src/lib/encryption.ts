import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

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

/**
 * Encrypts a string using AES-256-GCM
 * Returns: base64(iv + authTag + ciphertext)
 */
export function encryptToken(plaintext: string): string {
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

/**
 * Decrypts a string encrypted with encryptToken
 */
export function decryptToken(encryptedData: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedData, 'base64')

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data: too short')
  }

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}

/**
 * Generates a cryptographically secure random string for PKCE code_verifier
 * Returns 43-128 character URL-safe base64 string (RFC 7636)
 */
export function generateCodeVerifier(): string {
  // 32 bytes = 43 base64url characters
  return randomBytes(32)
    .toString('base64url')
}

/**
 * Generates SHA256 hash of code_verifier for PKCE code_challenge
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(hash).toString('base64url')
}

/**
 * Generates a random state parameter for CSRF protection
 */
export function generateState(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Extracts prefix from OpenRouter API key for display
 * e.g., "sk-or-v1-abc123..." -> "sk-or-v1-abc..."
 */
export function getKeyPrefix(apiKey: string): string {
  if (!apiKey || apiKey.length < 15) {
    return apiKey
  }
  return apiKey.substring(0, 15) + '...'
}
