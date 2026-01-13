/**
 * Encryption utilities for storing sensitive data (API keys)
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const SALT = 'gattaca-api-keys' // Fixed salt for key derivation

/**
 * Encrypt a string using AES-256-GCM
 * @param text - Plain text to encrypt
 * @param key - Encryption key (from ENCRYPTION_KEY env var)
 * @returns Encrypted string in format: iv:tag:ciphertext (all base64)
 */
export function encrypt(text: string, key: string): string {
  // Derive a 32-byte key from the provided key
  const keyBuffer = crypto.scryptSync(key, SALT, 32)

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH)

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv)

  // Encrypt
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  // Get auth tag
  const tag = cipher.getAuthTag()

  // Return combined string: iv:tag:ciphertext
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`
}

/**
 * Decrypt a string encrypted with encrypt()
 * @param encryptedData - Encrypted string in format: iv:tag:ciphertext
 * @param key - Encryption key (from ENCRYPTION_KEY env var)
 * @returns Decrypted plain text
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export function decrypt(encryptedData: string, key: string): string {
  const parts = encryptedData.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }

  const [ivB64, tagB64, ciphertext] = parts

  // Derive the same key
  const keyBuffer = crypto.scryptSync(key, SALT, 32)

  // Parse components
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv)
  decipher.setAuthTag(tag)

  // Decrypt
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Generate a hint for displaying the API key (last 4 chars)
 * @param apiKey - The full API key
 * @returns Hint string like "...xyz1"
 */
export function generateKeyHint(apiKey: string): string {
  if (apiKey.length < 4) {
    return '****'
  }
  return '...' + apiKey.slice(-4)
}

/**
 * Validate that an encryption key is properly configured
 * @returns true if ENCRYPTION_KEY is set and valid
 */
export function isEncryptionConfigured(): boolean {
  const key = process.env.ENCRYPTION_KEY
  return !!key && key.length >= 16
}

/**
 * Get the encryption key from environment
 * @throws Error if ENCRYPTION_KEY is not configured
 */
export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  if (key.length < 16) {
    throw new Error('ENCRYPTION_KEY must be at least 16 characters')
  }
  return key
}

/**
 * Encrypt an API key for storage
 * @param apiKey - The plain API key
 * @returns Object with encrypted key and hint
 */
export function encryptAPIKey(apiKey: string): { encryptedKey: string; keyHint: string } {
  const encryptionKey = getEncryptionKey()
  return {
    encryptedKey: encrypt(apiKey, encryptionKey),
    keyHint: generateKeyHint(apiKey),
  }
}

/**
 * Decrypt a stored API key
 * @param encryptedKey - The encrypted API key
 * @returns The plain API key
 */
export function decryptAPIKey(encryptedKey: string): string {
  const encryptionKey = getEncryptionKey()
  return decrypt(encryptedKey, encryptionKey)
}

// ============================================================================
// PKCE (Proof Key for Code Exchange) Utilities for OAuth
// ============================================================================

/**
 * Generate a cryptographically secure code verifier for PKCE
 * @returns A base64url encoded random string (43-128 chars)
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Generate a code challenge from a code verifier using SHA-256
 * @param verifier - The code verifier
 * @returns A base64url encoded SHA-256 hash of the verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(verifier).digest()
  return hash.toString('base64url')
}

/**
 * Generate a random state parameter for OAuth
 * @returns A random 16-byte hex string
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Generate key prefix for display (first chars after sk-or-)
 * @param apiKey - The full API key
 * @returns Prefix string like "sk-or-v1-xxx..."
 */
export function generateKeyPrefix(apiKey: string): string {
  if (apiKey.length < 20) {
    return apiKey.slice(0, 8) + '...'
  }
  return apiKey.slice(0, 15) + '...'
}

// ============================================================================
// Aliases for backward compatibility with existing code
// ============================================================================

/**
 * Alias for encrypt() - used by OpenRouter token storage
 */
export function encryptToken(plaintext: string): string {
  const encryptionKey = getEncryptionKey()
  return encrypt(plaintext, encryptionKey)
}

/**
 * Alias for decrypt() - used by OpenRouter token storage
 */
export function decryptToken(encryptedData: string): string {
  const encryptionKey = getEncryptionKey()
  return decrypt(encryptedData, encryptionKey)
}

/**
 * Alias for generateKeyPrefix() - used by some components
 */
export function getKeyPrefix(apiKey: string): string {
  return generateKeyPrefix(apiKey)
}
