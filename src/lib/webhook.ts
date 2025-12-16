import crypto from 'crypto'

/**
 * Verify Calendly webhook signature
 * Based on Calendly's official documentation
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  webhookSigningKey: string
): boolean {
  if (!signatureHeader) {
    return false
  }

  // Parse the signature header
  const parts = signatureHeader.split(',').reduce(
    (acc, part) => {
      const [key, value] = part.split('=')
      if (key === 't') {
        acc.timestamp = value
      } else if (key === 'v1') {
        acc.signature = value
      }
      return acc
    },
    { timestamp: '', signature: '' }
  )

  if (!parts.timestamp || !parts.signature) {
    return false
  }

  // Create the signed payload
  const signedPayload = `${parts.timestamp}.${payload}`

  // Compute expected signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSigningKey)
    .update(signedPayload, 'utf8')
    .digest('hex')

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(parts.signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * Check if webhook timestamp is within tolerance (prevent replay attacks)
 */
export function isTimestampValid(
  signatureHeader: string | null,
  toleranceMs: number = 180000 // 3 minutes
): boolean {
  if (!signatureHeader) {
    return false
  }

  const parts = signatureHeader.split(',')
  const timestampPart = parts.find((p) => p.startsWith('t='))
  
  if (!timestampPart) {
    return false
  }

  const timestamp = parseInt(timestampPart.split('=')[1], 10)
  const timestampMs = timestamp * 1000

  return timestampMs >= Date.now() - toleranceMs
}

