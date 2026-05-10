import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Game } from '../types'
import GameCard from '../components/GameCard'
import './Profile.css'

type Tab = 'hosting' | 'joined' | 'past'

interface FriendProfile {
  id: string
  username: string
}

interface PendingRequest {
  id: string
  requester_id: string
  username: string
}

export default function Profile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [tab, setTab] = useState<Tab>('hosting')
  const [loading, setLoading] = useState(true)
  const [playerRating, setPlayerRating] = useState<{ avg: number; count: number } | null>(null)
  const [hostRating, setHostRating] = useState<{ avg: number; count: number } | null>(null)
  const [attendance, setAttendance] = useState<{ showed: number; noShow: number }>({ showed: 0, noShow: 0 })
  const [gamesPlayed, setGamesPlayed] = useState<number | null>(null)
  const [gamesHosted, setGamesHosted] = useState<number | null>(null)
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [friendsOpen, setFriendsOpen] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)

  useEffect(() => {
    if (user) {
      fetchData()
      fetchFriends()
      fetchPendingRequests()
    }
  }, [user, tab])

  async function fetchData() {
    if (!user) return
    setLoading(true)

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    if (profile) setUsername(profile.username)

    const { data: ratingsData } = await supabase
      .from('ratings')
      .select('attitude_rating, host_rating, attendance')
      .eq('ratee_id', user.id)

    const attitudes = (ratingsData ?? []).map(r => r.attitude_rating).filter(Boolean) as number[]
    const hosts = (ratingsData ?? []).map(r => r.host_rating).filter(Boolean) as number[]
    const showed = (ratingsData ?? []).filter(r => r.attendance === 'showed_up').length
    const noShow = (ratingsData ?? []).filter(r => r.attendance === 'no_show').length

    if (attitudes.length > 0) setPlayerRating({ avg: attitudes.reduce((a, b) => a + b, 0) / attitudes.length, count: attitudes.length })
    if (hosts.length > 0) setHostRating({ avg: hosts.reduce((a, b) => a + b, 0) / hosts.length, count: hosts.length })
    setAttendance({ showed, noShow })

    const [{ count: played }, { count: hosted }] = await Promise.all([
      supabase.from('game_players').select('game_id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('games').select('id', { count: 'exact', head: true }).eq('created_by', user.id).neq('status', 'cancelled'),
    ])
    setGamesPlayed(played ?? 0)
    setGamesHosted(hosted ?? 0)

    if (tab === 'hosting') {
      const { data } = await supabase
        .from('games')
        .select('*, profiles (id, username), game_players (id)')
        .eq('created_by', user.id)
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true })

      setGames((data ?? []).map((g: Game & { game_players: { id: string }[] }) => ({
        ...g,
        player_count: g.game_players?.length ?? 0,
      })))
    } else if (tab === 'joined') {
      const { data: joined } = await supabase
        .from('game_players')
        .select('game_id')
        .eq('user_id', user.id)

      const ids = (joined ?? []).map((j: { game_id: string }) => j.game_id)

      if (ids.length === 0) {
        setGames([])
      } else {
        const { data } = await supabase
          .from('games')
          .select('*, profiles (id, username), game_players (id)')
          .in('id', ids)
          .neq('created_by', user.id)
          .gte('date_time', new Date().toISOString())
          .order('date_time', { ascending: true })

        setGames((data ?? []).map((g: Game & { game_players: { id: string }[] }) => ({
          ...g,
          player_count: g.game_players?.length ?? 0,
          is_joined: true,
        })))
      }
    } else {
      // Past: all games (hosted or joined) before now
      const { data: joined } = await supabase
        .from('game_players')
        .select('game_id')
        .eq('user_id', user.id)

      const ids = (joined ?? []).map((j: { game_id: string }) => j.game_id)

      if (ids.length === 0) {
        setGames([])
      } else {
        const { data } = await supabase
          .from('games')
          .select('*, profiles (id, username), game_players (id)')
          .in('id', ids)
          .lt('date_time', new Date().toISOString())
          .order('date_time', { ascending: false })

        setGames((data ?? []).map((g: Game & { game_players: { id: string }[] }) => ({
          ...g,
          player_count: g.game_players?.length ?? 0,
        })))
      }
    }

    setLoading(false)
  }

  async function fetchFriends() {
    if (!user) return
    const { data: fships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted')

    if (!fships || fships.length === 0) { setFriends([]); return }

    const friendIds = fships.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', friendIds)

    setFriends(profiles ?? [])
  }

  async function fetchPendingRequests() {
    if (!user) return
    const { data: pending } = await supabase
      .from('friendships')
      .select('id, requester_id')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')

    if (!pending || pending.length === 0) { setPendingRequests([]); return }

    const ids = pending.map(p => p.requester_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', ids)

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.username]))
    setPendingRequests(pending.map(p => ({
      id: p.id,
      requester_id: p.requester_id,
      username: profileMap[p.requester_id] ?? 'Unknown',
    })))
  }

  async function acceptRequest(friendshipId: string) {
    setRespondingTo(friendshipId)
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    await fetchPendingRequests()
    await fetchFriends()
    setRespondingTo(null)
  }

  async function declineRequest(friendshipId: string) {
    setRespondingTo(friendshipId)
    await supabase.from('friendships').delete().eq('id', friendshipId)
    setPendingRequests(prev => prev.filter(r => r.id !== friendshipId))
    setRespondingTo(null)
  }

  async function saveUsername() {
    if (!user) return
    const clean = usernameInput.trim()
    if (!clean || clean.length < 2) { setUsernameError('Username must be at least 2 characters.'); return }
    setUsernameSaving(true)
    setUsernameError('')
    const { error } = await supabase.from('profiles').update({ username: clean }).eq('id', user.id)
    if (error) {
      setUsernameError(error.message.includes('unique') ? 'That username is already taken.' : error.message)
    } else {
      setUsername(clean)
      setEditingUsername(false)
    }
    setUsernameSaving(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-header card">
          <div className="profile-avatar">
            {username ? username[0].toUpperCase() : '?'}
          </div>
          <div className="profile-info">
            {editingUsername ? (
              <div className="username-edit-row">
                <input
                  className="username-edit-input"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') setEditingUsername(false) }}
                  maxLength={30}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={saveUsername} disabled={usernameSaving}>
                  {usernameSaving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Save'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingUsername(false)}>Cancel</button>
              </div>
            ) : (
              <div className="username-display-row">
                <h1 className="profile-username">{username || user?.email}</h1>
                <button
                  className="username-edit-btn"
                  onClick={() => { setUsernameInput(username); setUsernameError(''); setEditingUsername(true) }}
                  title="Edit username"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>
            )}
            {usernameError && <p className="username-error">{usernameError}</p>}
            <p className="profile-email">{user?.email}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>

        {pendingRequests.length > 0 && (
          <div className="pending-requests card">
            <div className="pending-title">
              Friend Requests
              <span className="pending-badge">{pendingRequests.length}</span>
            </div>
            {pendingRequests.map(req => (
              <div key={req.id} className="pending-row">
                <Link to={`/users/${req.requester_id}`} className="pending-avatar">
                  {req.username[0].toUpperCase()}
                </Link>
                <Link to={`/users/${req.requester_id}`} className="pending-name">
                  {req.username}
                </Link>
                <div className="pending-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => acceptRequest(req.id)}
                    disabled={respondingTo === req.id}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => declineRequest(req.id)}
                    disabled={respondingTo === req.id}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(gamesPlayed !== null || gamesHosted !== null) && (
          <div className="stats-card card">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{gamesPlayed ?? 0}</div>
                <div className="stat-label">Games Played</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{gamesHosted ?? 0}</div>
                <div className="stat-label">Games Hosted</div>
              </div>
              <div className="stat-item">
                {attendance.showed + attendance.noShow > 0 ? (
                  <>
                    <div className={`stat-value ${Math.round(attendance.showed / (attendance.showed + attendance.noShow) * 100) >= 80 ? 'stat-value--good' : 'stat-value--bad'}`}>
                      {Math.round(attendance.showed / (attendance.showed + attendance.noShow) * 100)}%
                    </div>
                    <div className="stat-label">Show Rate</div>
                  </>
                ) : (
                  <>
                    <div className="stat-value stat-value--dim">—</div>
                    <div className="stat-label">Show Rate</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {(playerRating || hostRating || attendance.showed > 0 || attendance.noShow > 0) && (
          <div className="reputation-card card">
            <div className="reputation-title">Reputation</div>
            <div className="rep-rows">
              {playerRating && (
                <div className="rep-row">
                  <div className="rep-row-label">Player Rating</div>
                  <div className="rep-row-right">
                    <div className="rep-stars">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} className={`rep-star ${n <= Math.round(playerRating.avg) ? 'filled' : ''}`}>★</span>
                      ))}
                    </div>
                    <span className="rep-avg">{playerRating.avg.toFixed(1)}</span>
                    <span className="rep-count">({playerRating.count} {playerRating.count === 1 ? 'rating' : 'ratings'})</span>
                  </div>
                </div>
              )}
              {hostRating && (
                <div className="rep-row">
                  <div className="rep-row-label">Host Rating</div>
                  <div className="rep-row-right">
                    <div className="rep-stars">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} className={`rep-star ${n <= Math.round(hostRating.avg) ? 'filled' : ''}`}>★</span>
                      ))}
                    </div>
                    <span className="rep-avg">{hostRating.avg.toFixed(1)}</span>
                    <span className="rep-count">({hostRating.count} {hostRating.count === 1 ? 'rating' : 'ratings'})</span>
                  </div>
                </div>
              )}
              {(attendance.showed > 0 || attendance.noShow > 0) && (
                <div className="rep-row">
                  <div className="rep-row-label">Attendance</div>
                  <div className="rep-row-right">
                    {attendance.showed > 0 && <span className="att-badge att-showed">✅ Showed Up ×{attendance.showed}</span>}
                    {attendance.noShow > 0 && <span className="att-badge att-noshow">❌ No-Show ×{attendance.noShow}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          className="friends-toggle card"
          onClick={() => setFriendsOpen(o => !o)}
        >
          <span className="friends-toggle-label">
            Friends
            <span className="friends-count">{friends.length}</span>
          </span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            style={{ transform: friendsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {friendsOpen && (
          <div className="friends-list card">
            {friends.length === 0 ? (
              <p className="friends-empty">No friends yet. Add people from their profiles or game pages.</p>
            ) : (
              friends.map(f => (
                <Link key={f.id} to={`/users/${f.id}`} className="friend-row">
                  <div className="friend-avatar">{f.username[0].toUpperCase()}</div>
                  <span className="friend-name">{f.username}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-dim)' }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              ))
            )}
          </div>
        )}

        <div className="profile-tabs">
          <button
            className={`tab-btn ${tab === 'hosting' ? 'active' : ''}`}
            onClick={() => setTab('hosting')}
          >
            Hosting
          </button>
          <button
            className={`tab-btn ${tab === 'joined' ? 'active' : ''}`}
            onClick={() => setTab('joined')}
          >
            Joined
          </button>
          <button
            className={`tab-btn ${tab === 'past' ? 'active' : ''}`}
            onClick={() => setTab('past')}
          >
            Past
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <span className="spinner" style={{ borderTopColor: 'var(--orange)', width: 24, height: 24 }} />
          </div>
        ) : games.length === 0 ? (
          <div className="profile-empty">
            <p className="profile-empty-text">
              {tab === 'hosting' ? "No upcoming games you're hosting." : tab === 'joined' ? "No upcoming games you've joined." : "No past games yet."}
            </p>
            {tab !== 'past' && (
              <Link to={tab === 'hosting' ? '/games/new' : '/'} className="btn btn-primary">
                {tab === 'hosting' ? 'Host a Game' : 'Browse Games'}
              </Link>
            )}
          </div>
        ) : (
          <div className="game-grid">
            {games.map(game => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
