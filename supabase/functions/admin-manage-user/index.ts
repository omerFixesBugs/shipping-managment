import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify calling user is an owner
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'owner') return jsonResponse({ error: 'Forbidden' }, 403)

    const body = await req.json()
    const { type } = body

    if (type === 'set_password') {
      const { userId, password } = body as { userId: string; password: string }
      if (!userId || !password || password.length < 6) {
        return jsonResponse({ error: 'userId and password (min 6 chars) required' }, 400)
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
      if (error) return jsonResponse({ error: error.message }, 400)
      return jsonResponse({ success: true })
    }

    if (type === 'update_profile') {
      const { userId, full_name, position, hub, role } = body as {
        userId: string
        full_name?: string
        position?: string
        hub?: string
        role?: string
      }
      if (!userId) return jsonResponse({ error: 'userId required' }, 400)

      const patch: Record<string, string | null> = {}
      if (full_name !== undefined) patch.full_name = full_name
      if (position !== undefined) patch.position = position
      if (hub !== undefined) patch.hub = hub || null
      if (role !== undefined) patch.role = role

      const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', userId)
      if (error) return jsonResponse({ error: error.message }, 400)
      return jsonResponse({ success: true })
    }

    if (type === 'create_employee') {
      const { email, password, full_name, role, hub, position } = body as {
        email: string; password: string; full_name: string
        role: string; hub?: string; position?: string
      }
      if (!email || !password || !full_name || !role) {
        return jsonResponse({ error: 'email, password, full_name, role required' }, 400)
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name, role },
      })
      if (createError || !newUser?.user) {
        return jsonResponse({ error: createError?.message ?? 'Failed to create user' }, 400)
      }

      const profilePatch: Record<string, string | null> = { full_name, role }
      if (hub) profilePatch.hub = hub
      if (position) profilePatch.position = position

      await supabaseAdmin.from('profiles').update(profilePatch).eq('id', newUser.user.id)
      return jsonResponse({ success: true, userId: newUser.user.id })
    }

    return jsonResponse({ error: 'Unknown type' }, 400)
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
