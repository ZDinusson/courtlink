import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://courtlinkk.vercel.app'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const payload = await req.json()

  // Only fire when status changes to 'cancelled'
  const record = payload.record
  const oldRecord = payload.old_record
  if (!record || record.status !== 'cancelled' || oldRecord?.status === 'cancelled') {
    return new Response('Not a cancellation', { status: 200 })
  }

  const gameId: string = record.id
  const gameTitle: string = record.title
  const gameLocation: string = record.location
  const gameDateTime: string = record.date_time
  const createdBy: string = record.created_by

  // Service role client — can read auth.users
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Get host username
  const { data: hostProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', createdBy)
    .single()
  const hostName = hostProfile?.username ?? 'The host'

  // Get all players who joined (excluding the host)
  const { data: players } = await supabase
    .from('game_players')
    .select('user_id')
    .eq('game_id', gameId)
    .neq('user_id', createdBy)

  if (!players || players.length === 0) {
    return new Response('No players to notify', { status: 200 })
  }

  // Get emails for each player via auth.users (service role only)
  const userIds = players.map((p: { user_id: string }) => p.user_id)
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const emails = users
    .filter((u) => userIds.includes(u.id) && u.email)
    .map((u) => u.email as string)

  if (emails.length === 0) {
    return new Response('No emails found', { status: 200 })
  }

  // Format date nicely
  const date = new Date(gameDateTime)
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })

  const gameUrl = `${APP_URL}/games/${gameId}`

  // Send one email per player via Resend
  await Promise.all(emails.map((email) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CourtLink <noreply@courtlinkk.vercel.app>',
        to: email,
        subject: `❌ "${gameTitle}" has been cancelled`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
            <h2 style="font-size:22px;font-weight:800;letter-spacing:-0.03em;margin:0 0 8px;">
              Game Cancelled
            </h2>
            <p style="color:#6B7280;margin:0 0 24px;font-size:15px;">
              ${hostName} cancelled a game you joined.
            </p>

            <div style="background:#F4F5F7;border-radius:12px;padding:20px;margin-bottom:24px;">
              <div style="font-size:18px;font-weight:700;margin-bottom:6px;">${gameTitle}</div>
              <div style="color:#6B7280;font-size:14px;margin-bottom:4px;">📍 ${gameLocation}</div>
              <div style="color:#6B7280;font-size:14px;">🕐 ${formattedDate} · ${formattedTime}</div>
            </div>

            <a href="${gameUrl}"
               style="display:inline-block;background:#F97316;color:#fff;padding:12px 24px;border-radius:100px;text-decoration:none;font-weight:700;font-size:14px;">
              View Game
            </a>

            <p style="color:#9CA3AF;font-size:12px;margin-top:32px;">
              You received this because you joined this game on CourtLink.
            </p>
          </div>
        `,
      }),
    })
  ))

  return new Response(JSON.stringify({ sent: emails.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
