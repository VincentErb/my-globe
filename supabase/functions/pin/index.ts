import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifyKey(rawKey: string, storedHash: string): Promise<boolean> {
  const hash = await sha256hex(rawKey)
  return hash === storedHash
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // ── POST /pin — create a pin ───────────────────────────────────────────────
  if (req.method === 'POST') {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const { session_id, lat, lng, type, message, date, edit_key } = body

    if (
      typeof session_id !== 'string' ||
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !['trip', 'home'].includes(type as string)
    ) {
      return json({ error: 'Invalid request body' }, 400)
    }

    // Fetch session to check mode and edit_key_hash
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('mode, edit_key_hash')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      return json({ error: 'Session not found' }, 404)
    }

    // Owner mode requires a valid edit key
    if (session.mode === 'owner') {
      if (!edit_key || typeof edit_key !== 'string') {
        return json({ error: 'Unauthorized' }, 403)
      }
      const valid = await verifyKey(edit_key, session.edit_key_hash)
      if (!valid) return json({ error: 'Unauthorized' }, 403)
    }

    const { data: pin, error } = await supabaseAdmin
      .from('pins')
      .insert({
        session_id,
        lat,
        lng,
        type,
        message: typeof message === 'string' ? message.trim() : '',
        date: date || null,
      })
      .select()
      .single()

    if (error) return json({ error: error.message }, 500)

    return json(pin)
  }

  // ── DELETE /pin/:id — delete a pin ────────────────────────────────────────
  if (req.method === 'DELETE') {
    const url = new URL(req.url)
    // Path: /pin/<uuid>
    const parts = url.pathname.split('/').filter(Boolean)
    const pinId = parts[parts.length - 1]
    const sessionId = url.searchParams.get('session_id')
    const editKey = url.searchParams.get('key')

    if (!pinId || !sessionId) {
      return json({ error: 'Missing pin id or session_id' }, 400)
    }

    // Fetch session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('mode, edit_key_hash')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return json({ error: 'Session not found' }, 404)
    }

    // Owner and mixed modes require a valid edit key to delete
    if (session.mode === 'owner' || session.mode === 'mixed') {
      if (!editKey) return json({ error: 'Unauthorized' }, 403)
      const valid = await verifyKey(editKey, session.edit_key_hash)
      if (!valid) return json({ error: 'Unauthorized' }, 403)
    }

    const { error } = await supabaseAdmin
      .from('pins')
      .delete()
      .eq('id', pinId)

    if (error) return json({ error: error.message }, 500)

    return json({ deleted: true })
  }

  return json({ error: 'Method not allowed' }, 405)
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
