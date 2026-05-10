import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_CONTACT = Deno.env.get('VAPID_CONTACT') ?? 'mailto:zacharydinusson@gmail.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

function buildPayload(notif: Record<string, unknown>, gameTitle?: string): { title: string; body: string; url: string } {
  const sender = (notif.sender as { username?: string } | null)?.username ?? 'Someone'
  const title = gameTitle ?? 'a game'

  switch (notif.type) {
    case 'game_join':
      return { title: 'CourtLink', body: `${sender} joined ${title}`, url: `/games/${notif.game_id}` }
    case 'friend_request':
      return { title: 'Friend Request', body: `${sender} sent you a friend request`, url: `/users/${notif.from_user_id}` }
    case 'friend_accepted':
      return { title: 'CourtLink', body: `${sender} accepted your friend request`, url: `/users/${notif.from_user_id}` }
    case 'game_cancelled':
      return { title: 'Game Cancelled', body: title, url: `/games/${notif.game_id}` }
    case 'waitlist_promoted':
      return { title: "You're in!", body: `Off the waitlist for ${title}`, url: `/games/${notif.game_id}` }
    case 'game_reminder':
      return { title: 'Starting in 2 hours', body: title, url: `/games/${notif.game_id}` }
    case 'game_invite':
      return { title: 'Game Invite', body: `${sender} invited you to ${title}`, url: `/games/${notif.game_id}` }
    default:
      return { title: 'CourtLink', body: 'You have a new notification', url: '/' }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { notification_id, user_id } = await req.json()

  const { data: notif } = await supabase
    .from('notifications')
    .select('*, sender:profiles!from_user_id(username), games(title)')
    .eq('id', notification_id)
    .single()

  if (!notif) return new Response('Not found', { status: 404 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user_id ?? notif.user_id)

  if (!subs || subs.length === 0) return new Response('No subscriptions', { status: 200 })

  const payload = buildPayload(notif, (notif.games as { title?: string } | null)?.title)

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      ).catch(async (err: { statusCode?: number }) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      })
    )
  )

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
