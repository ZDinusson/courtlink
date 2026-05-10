import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './DMThread.css'

interface Message {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  read: boolean
  created_at: string
}

interface Profile {
  id: string
  username: string
}

export default function DMThread() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [messages, setMessages] = useState<Message[]>([])
  const [partner, setPartner] = useState<Profile | null>(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userId || !user) return
    if (userId === user.id) { navigate('/messages'); return }

    fetchPartner()
    fetchMessages()

    const channel = supabase
      .channel(`dm-${[user.id, userId].sort().join('-')}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `recipient_id=eq.${user.id}`,
      }, () => fetchMessages())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchPartner() {
    if (!userId) return
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', userId)
      .single()
    if (!data) { navigate('/messages'); return }
    setPartner(data)
  }

  async function fetchMessages() {
    if (!user || !userId) return
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })

    setMessages((data ?? []) as Message[])
    setLoading(false)

    // Mark unread messages as read
    const unreadIds = (data ?? [])
      .filter((m: Message) => m.recipient_id === user.id && !m.read)
      .map((m: Message) => m.id)

    if (unreadIds.length > 0) {
      await supabase
        .from('direct_messages')
        .update({ read: true })
        .in('id', unreadIds)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !userId || !body.trim()) return
    setSending(true)
    const text = body.trim()
    setBody('')
    await supabase.from('direct_messages').insert({
      sender_id: user.id,
      recipient_id: userId,
      body: text,
    })
    await fetchMessages()
    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (body.trim()) handleSend(e as unknown as React.FormEvent)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <span className="spinner" style={{ borderTopColor: 'var(--orange)', width: 24, height: 24 }} />
      </div>
    )
  }

  return (
    <div className="dm-page">
      <div className="dm-header">
        <button className="dm-back" onClick={() => navigate('/messages')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <Link to={`/users/${userId}`} className="dm-partner">
          <div className="dm-partner-avatar">
            {(partner?.username ?? '?')[0].toUpperCase()}
          </div>
          <span className="dm-partner-name">{partner?.username ?? '...'}</span>
        </Link>
      </div>

      <div className="dm-messages">
        {messages.length === 0 && (
          <div className="dm-empty">Start a conversation with {partner?.username}.</div>
        )}
        {messages.map(m => {
          const isOwn = m.sender_id === user?.id
          const time = new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          return (
            <div key={m.id} className={`chat-msg ${isOwn ? 'chat-msg-own' : 'chat-msg-other'}`}>
              {!isOwn && (
                <div className="chat-avatar">{(partner?.username ?? '?')[0].toUpperCase()}</div>
              )}
              <div className="chat-bubble-wrap">
                <div className="chat-bubble">{m.body}</div>
                <div className="chat-time">{time}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="dm-form">
        <input
          className="chat-input"
          placeholder={`Message ${partner?.username ?? ''}...`}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKey}
          maxLength={500}
          autoFocus
        />
        <button type="submit" className="chat-send" disabled={sending || !body.trim()}>
          {sending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}
