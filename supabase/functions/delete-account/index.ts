import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const respond = (body: string, status: number) => new Response(body, { status, headers: cors })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respond('', 200)
  if (req.method !== 'POST') return respond('Method not allowed', 405)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return respond('Unauthorized', 401)
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user) return respond('Unauthorized', 401)
  const admin = createClient(url, service)
  while (true) {
    const { data: images, error: listError } = await admin.storage
      .from('ticket-images')
      .list(user.id, { limit: 100 })
    if (listError) return respond('Unable to list account images', 500)
    if (!images?.length) break
    const { error: removeError } = await admin.storage
      .from('ticket-images')
      .remove(images.map((image) => `${user.id}/${image.name}`))
    if (removeError) return respond('Unable to remove account images', 500)
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) return respond('Unable to delete account', 500)
  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
