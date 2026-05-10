import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './NotificationBell.css'

interface Notif {
  id: string
  type: string
  game_id: string | null
  read: boolean
  created_at: string
  sender: { username: string } | null
  games: { title: string } | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.read).length

  useEffect(() => {
    if (!user) return
    fetchNotifs()

    const channel = supabase
      .channel(`notif-bell-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchNotifs() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  async function fetchNotifs() {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*, sender:profiles!from_user_id (username), games (title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15)
    setNotifs((data ?? []) as Notif[])
  }

  async function handleToggle() {
    const opening = !open
    setOpen(opening)
    if (opening && unread > 0) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user!.id)
        .eq('read', false)
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  if (!user) return null

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="notif-bell" onClick={handleToggle} aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">Notifications</span>
          </div>

          {notifs.length === 0 ? (
            <div className="notif-empty">No notifications yet</div>
          ) : (
            <div className="notif-list">
              {notifs.map(n => (
                <button
                  key={n.id}
                  className={`notif-item ${n.read ? '' : 'unread'}`}
                  onClick={() => { setOpen(false); if (n.game_id) navigate(`/games/${n.game_id}`) }}
                >
                  <div className="notif-avatar">
                    {(n.sender?.username ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="notif-content">
                    <div className="notif-text">
                      <strong>{n.sender?.username ?? 'Someone'}</strong> joined your game
                      {n.games?.title ? <> · <span className="notif-game">{n.games.title}</span></> : ''}
                    </div>
                    <div className="notif-time">{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.read && <div className="notif-dot" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
