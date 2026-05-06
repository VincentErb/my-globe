import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const EDGE_BASE_URL        = import.meta.env.VITE_EDGE_BASE_URL

// Publishable client — used for public SELECT queries only.
// All writes go through Edge Functions (secret key never touches the browser).
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE)

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Fetches the session row and all its pins.
 * Throws if the session doesn't exist.
 */
export async function loadSessionData(sessionId) {
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    throw new Error(`Session "${sessionId}" not found`)
  }

  const { data: pins, error: pinsError } = await supabase
    .from('pins')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (pinsError) throw new Error('Failed to load pins')

  return { session, pins: pins ?? [] }
}

// ─── Writes (via Edge Functions) ──────────────────────────────────────────────

/** Headers for Edge Function calls. */
const edgeHeaders = {
  'Content-Type': 'application/json',
}

/**
 * Creates a new session.
 * @param {{ id: string, name: string, mode: string, editKeyHash: string }} params
 */
export async function createSession({ id, name, mode, editKeyHash }) {
  const res = await fetch(`${EDGE_BASE_URL}/session`, {
    method: 'POST',
    headers: edgeHeaders,
    body: JSON.stringify({ id, name, mode, edit_key_hash: editKeyHash }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Creates a pin in the given session.
 * @param {{ sessionId, lat, lng, type, message, date, editKey }} params
 */
export async function createPin({ sessionId, lat, lng, type, message, date, editKey }) {
  const res = await fetch(`${EDGE_BASE_URL}/pin`, {
    method: 'POST',
    headers: edgeHeaders,
    body: JSON.stringify({
      session_id: sessionId,
      lat,
      lng,
      type,
      message,
      date: date || null,
      edit_key: editKey || null,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Deletes a pin by ID.
 * @param {{ pinId: string, sessionId: string, editKey: string|null }} params
 */
export async function deletePin({ pinId, sessionId, editKey }) {
  const params = new URLSearchParams({ session_id: sessionId })
  if (editKey) params.set('key', editKey)

  const res = await fetch(`${EDGE_BASE_URL}/pin/${pinId}?${params}`, {
    method: 'DELETE',
    headers: edgeHeaders,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}
