import crypto from 'crypto'
import { env } from '@/env'

const ALGORITHM = 'aes-256-gcm'

// Read key once at module load time — env validation already confirmed it exists and is 64 hex chars
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex') // 32 bytes

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12) // 96-bit IV required for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag() // 128-bit authentication tag
  // Version-prefixed format enables future key rotation
  return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

export function decrypt(envelope: string): string {
  if (!envelope.startsWith('enc:v1:')) {
    throw new Error('Invalid encryption envelope format or unsupported version')
  }
  const [, , ivHex, authTagHex, ciphertextHex] = envelope.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
