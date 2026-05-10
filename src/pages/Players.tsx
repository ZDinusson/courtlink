import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './Players.css'

interface Profile {
  id: string
  username: string
}

interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
}

type FriendStatus = 'none' | 'i_sent' | 'they_sent' | 'friends'

interface Result extends Profile {
  friendStatus: FriendStatus
  friendship: Friendship | null
}

export default function Players() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(() => search(query.trim()), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  async function search(q: string) {
    setLoading(true)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${q}%`)
      .neq('id', user?.id ?? '')
      .limit(20)

    if (!profiles || profiles.length === 0) {
      setResults([])
      setLoading(false)
      return
    }

    let friendships: Friendship[] = []
    if (user) {
      const ids = profiles.map(p => p.id)
      const { data } = await supabase
        .from('friendships')
        .select('*')
        .or(
          ids.map(id =>
            `and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`
          ).join(',')
        )
      friendships = (data ?? []) as Friendship[]
    }

    const fMap = new Map<string, Friendship>()
    for (const f of friendships) {
      const otherId = f.requester_id === user?.id ? f.addressee_id : f.requester_id
      fMap.set(otherId, f)
    }

    const mapped: Result[] = profiles.map(p => {
      const f = fMap.get(p.id) ?? null
      let friendStatus: FriendStatus = 'none'
      if (f) {
        if (f.status === 'accepted') friendStatus = 'friends'
        else if (f.requester_id === user?.id) friendStatus = 'i_sent'
        else friendStatus = 'they_sent'
      }
      return { ...p, friendStatus, friendship: f }
    })

    setResults(mapped)
    setLoading(false)
  }

  async function sendRequest(profileId: string) {
    if (!user) return
    setActionLoading(profileId)
    const { data } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: profileId })
      .select()
      .single()
    setResults(prev => prev.map(r =>
      r.id === profileId ? { ...r, friendStatus: 'i_sent', friendship: data } : r
    ))
    setActionLoading(null)
  }

  async function cancelRequest(profileId: string, friendship: Friendship | null) {
    if (!friendship) return
    setActionLoading(profileId)
    await supabase.from('friendships').delete().eq('id', friendship.id)
    setResults(prev => prev.map(r =>
      r.id === profileId ? { ...r, friendStatus: 'none', friendship: null } : r
    ))
    setActionLoading(null)
  }

  async function acceptRequest(profileId: string, friendship: Friendship | null) {
    if (!friendship) return
    setActionLoading(profileId)
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendship.id)
    setResults(prev => prev.map(r =>
      r.id === profileId ? { ...r, friendStatus: 'friends', friendship: { ...friendship, status: 'accepted' } } : r
    ))
    setActionLoading(null)
  }

  return (
    <div className="players-page">
      <div className="container-sm">
        <div className="players-header">
          <h1 className="players-title">Find Players</h1>
          <p className="players-sub">Search for players by username to add them as friends.</p>
        </div>

        <div className="players-search-wrap">
          <svg className="players-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="players-search-input"
            placeholder="Search username..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button className="players-search-clear" onClick={() => setQuery('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {loading && (
          <div className="players-loading">
            <span className="spinner" style={{ borderTopColor: 'var(--orange)', width: 22, height: 22 }} />
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="players-empty">No players found for "{query}"</div>
        )}

        {results.length > 0 && (
          <div className="players-list card">
            {results.map(r => (
              <div key={r.id} className="player-row">
                <Link to={`/users/${r.id}`} className="player-row-left">
                  <div className="player-avatar">{r.username[0].toUpperCase()}</div>
                  <span className="player-username">{r.username}</span>
                </Link>
                {user && (
                  <div className="player-actions">
                    {r.friendStatus === 'none' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => sendRequest(r.id)}
                        disabled={actionLoading === r.id}
                      >
                        Add Friend
                      </button>
                    )}
                    {r.friendStatus === 'i_sent' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => cancelRequest(r.id, r.friendship)}
                        disabled={actionLoading === r.id}
                      >
                        Requested
                      </button>
                    )}
                    {r.friendStatus === 'they_sent' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => acceptRequest(r.id, r.friendship)}
                        disabled={actionLoading === r.id}
                      >
                        Accept
                      </button>
                    )}
                    {r.friendStatus === 'friends' && (
                      <Link to={`/messages/${r.id}`} className="btn btn-ghost btn-sm player-friends-btn">
                        ✓ Friends
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
