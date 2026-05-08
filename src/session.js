import { sha256hex } from './crypto.js'

// Set VITE_BASE_PATH=/globe (no trailing slash) when deploying behind a reverse proxy.
const BASE_PATH = import.meta.env.VITE_BASE_PATH ?? ''
console.log('[session] VITE_BASE_PATH:', JSON.stringify(import.meta.env.VITE_BASE_PATH), '→ BASE_PATH:', JSON.stringify(BASE_PATH))

/**
 * Reads the current URL to extract the session ID and optional edit key.
 *
 * URL format (standalone):   /<SESSION_ID>
 * URL format (behind proxy): /globe/<SESSION_ID>
 *   /<SESSION_ID>          → view mode
 *   /<SESSION_ID>?key=KEY  → edit mode
 *
 * Returns { sessionId: string|null, editKey: string|null }
 */
export function parseUrl() {
  const pathname = window.location.pathname
  const stripped = BASE_PATH ? pathname.slice(BASE_PATH.length) : pathname
  // Strip the leading '/', treat '' or '/' as "no session"
  const sessionId = stripped.slice(1) || null
  const params = new URLSearchParams(window.location.search)
  const editKey = params.get('key') || null
  return { sessionId, editKey }
}

/**
 * Returns true if SHA-256(rawKey) === storedHash.
 */
export async function verifyEditKey(rawKey, storedHash) {
  const hash = await sha256hex(rawKey)
  return hash === storedHash
}

/**
 * Derives { canCreate, canDelete } from the session mode and whether the
 * current visitor has a verified edit key.
 */
export function resolvePermissions(mode, keyVerified) {
  return {
    canCreate: mode !== 'owner' || keyVerified,
    canDelete: mode === 'open' || keyVerified,
  }
}

/**
 * Generates a random 8-character session ID (lowercase alphanumeric).
 * Uses crypto.getRandomValues — no external dependency.
 */
export function generateSessionId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const arr = new Uint8Array(8)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => chars[b % chars.length])
    .join('')
}

/**
 * Generates a random 32-character hex edit key (128 bits of entropy).
 */
export function generateEditKey() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
