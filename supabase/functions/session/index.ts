import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: { id?: unknown; name?: unknown; mode?: unknown; edit_key_hash?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { id, name, mode, edit_key_hash } = body

  if (
    typeof id !== 'string' || !id.trim() ||
    typeof name !== 'string' || !name.trim() ||
    !['owner', 'mixed', 'open'].includes(mode as string) ||
    typeof edit_key_hash !== 'string' || edit_key_hash.length !== 64
  ) {
    return json({ error: 'Invalid request body' }, 400)
  }

  const { error } = await supabaseAdmin
    .from('sessions')
    .insert({ id: id.trim(), name: name.trim(), mode, edit_key_hash })

  if (error) {
    // Duplicate key → session ID already taken
    if (error.code === '23505') return json({ error: 'Session ID already exists' }, 409)
    return json({ error: error.message }, 500)
  }

  return json({ id, name, mode })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
