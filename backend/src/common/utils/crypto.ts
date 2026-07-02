import { createHash, randomBytes } from 'crypto';

// High-entropy opaque token (URL-safe). Used for refresh tokens and email links.
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

// Opaque tokens carry enough entropy that a fast one-way hash is sufficient and lets us
// index/look them up. Only the hash is ever persisted.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
