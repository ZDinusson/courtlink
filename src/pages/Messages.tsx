import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './Messages.css'

interface DM {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  read: boolean
  created_at: string
}

interface Conversation {
  partnerId: string
  partnerUsername: string
  lastMessage: string
  lastAt: string
  unread: number
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

export default function Messages() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchConversations()
  }, [user])

  async function fetchConversations() {
    if (!user) return
    setLoading(true)

    const { data: messages } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (!messages || messages.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    // Group by partner, keep latest message per partner
    const seen = new Map<string, DM & { unread: number }>()
    for (const msg of messages as DM[]) {
      const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id
      if (!seen.has(partnerId)) {
        seen.set(partnerId, { ...msg, unread: 0 })
      }
      // Count unread (messages to me that are unread)
      if (msg.recipient_id === user.id && !msg.read) {
        seen.get(partnerId)!.unread++
      }
    }

    const partnerIds = Array.from(seen.keys())
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', partnerIds)

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.username]))

    const convos: Conversation[] = Array.from(seen.entries()).map(([partnerId, msg]) => ({
      partnerId,
      partnerUsername: profileMap[partnerId] ?? 'Unknown',
      lastMessage: msg.body,
      lastAt: msg.created_at,
      unread: msg.unread,
    }))

    convos.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    setConversations(convos)
    setLoading(false)
  }

  return (
    <div className="messages-page">
      <div className="container-sm">
        <div className="messages-header">
          <h1 className="messages-title">Messages</h1>
        </div>

        {loading ? (
          <div className="messages-loading">
            <span className="spinner" style={{ borderTopColor: 'var(--orange)', width: 24, height: 24 }} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="messages-empty">
            <div className="messages-empty-icon">💬</div>
            <p className="messages-empty-text">No messages yet.</p>
            <p className="messages-empty-sub">Add friends and start a conversation from their profile.</p>
          </div>
        ) : (
          <div className="conversations-list card">
            {conversations.map(c => (
              <Link key={c.partnerId} to={`/messages/${c.partnerId}`} className="conversation-row">
                <div className="conversation-avatar">
                  {c.partnerUsername[0].toUpperCase()}
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">{c.partnerUsername}</div>
                  <div className="conversation-preview">{c.lastMessage}</div>
                </div>
                <div className="conversation-meta">
                  <div className="conversation-time">{timeAgo(c.lastAt)}</div>
                  {c.unread > 0 && (
                    <div className="conversation-unread">{c.unread}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
