import { createHash } from 'crypto';

/**
 * Computes a SHA-256 hash for secure token storage and lookup.
 * Raw token -> SHA-256 hex string -> Database lookup
 */
export function hashToken(token: string): string {
  if (!token) {
    return '';
  }
  return createHash('sha256').update(token.trim()).digest('hex');
}
