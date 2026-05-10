import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SPORT_EMOJI, SPORT_LABEL, SPORTS, SKILL_LABEL, SKILL_LEVELS, type Sport, type SkillLevel, type Game, type GamePlayer, type Comment } from '../types'
import './GameDetail.css'

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }) + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function GameDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editSport, setEditSport] = useState<Sport>('basketball')
  const [editLocation, setEditLocation] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSkillLevel, setEditSkillLevel] = useState<SkillLevel>('all')
  const [editLoading, setEditLoading] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [waitlist, setWaitlist] = useState<{ id: string; user_id: string; position: number; profiles?: { username: string } }[]>([])
  const [hasRated, setHasRated] = useState<boolean | null>(null)
  const [friends, setFriends] = useState<{ id: string; username: string }[]>([])
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [showInvite, setShowInvite] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const isCreator = user?.id === game?.created_by
  const isJoined = players.some(p => p.user_id === user?.id)
  const isFull = (game?.player_count ?? 0) >= (game?.player_limit ?? 0)
  const isPast = game ? new Date(game.date_time) < new Date() : false
  const isWaitlisted = waitlist.some(w => w.user_id === user?.id)
  const myWaitlistPosition = waitlist.find(w => w.user_id === user?.id)?.position ?? null

  useEffect(() => {
    if (!id) return
    fetchGame(true)

    fetchComments()

    fetchWaitlist()
    if (user) { fetchFriends(); fetchInvited() }

    const channel = supabase
      .channel(`game-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${id}` }, () => {
        fetchGame()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist', filter: `game_id=eq.${id}` }, () => {
        fetchWaitlist()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, () => {
        fetchGame()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `game_id=eq.${id}` }, () => {
        fetchComments()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function fetchGame(showSpinner = false) {
    if (!id) return
    if (showSpinner) setLoading(true)

    const { data: gameData } = await supabase
      .from('games')
      .select('*, profiles (id, username), courts (id, name)')
      .eq('id', id)
      .single()

    const { data: playersData } = await supabase
      .from('game_players')
      .select('*, profiles (id, username)')
      .eq('game_id', id)
      .order('joined_at', { ascending: true })

    if (gameData) {
      setGame({ ...gameData, player_count: playersData?.length ?? 0 })
      if (user && new Date(gameData.date_time) < new Date()) {
        const { data: existing } = await supabase
          .from('ratings').select('id').eq('game_id', id).eq('rater_id', user.id).limit(1)
        setHasRated((existing ?? []).length > 0)
      }
    }
    setPlayers(playersData ?? [])
    if (showSpinner) setLoading(false)
  }

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  async function fetchComments() {
    if (!id) return
    const { data } = await supabase
      .from('comments')
      .select('*, profiles (id, username)')
      .eq('game_id', id)
      .order('created_at', { ascending: true })
    setComments(data ?? [])
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !game || !commentBody.trim()) return
    setCommentLoading(true)
    const body = commentBody.trim()
    setCommentBody('')
    await supabase.from('comments').insert({ game_id: game.id, user_id: user.id, body })
    setCommentLoading(false)
  }

  function handleChatKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (commentBody.trim()) handlePostComment(e as unknown as React.FormEvent)
    }
  }

  async function handleShare() {
    if (!game) return
    const url = `${window.location.origin}/games/${game.id}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: game.title,
          text: `Join me for ${SPORT_LABEL[game.sport]} at ${game.location}!`,
          url,
        })
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        // fall through to clipboard on any other error
      }
    }

    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function fetchWaitlist() {
    if (!id) return
    const { data } = await supabase
      .from('waitlist')
      .select('id, user_id, position, profiles (username)')
      .eq('game_id', id)
      .order('position', { ascending: true })
    setWaitlist((data ?? []) as unknown as typeof waitlist)
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
    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', friendIds)
    setFriends(profiles ?? [])
  }

  async function fetchInvited() {
    if (!id || !user) return
    const { data } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('game_id', id)
      .eq('from_user_id', user.id)
      .eq('type', 'game_invite')
    setInvitedIds(new Set((data ?? []).map(n => n.user_id)))
  }

  async function handleInvite(friendId: string) {
    if (!game || !user) return
    setInviting(friendId)
    await supabase.from('notifications').insert({
      user_id: friendId,
      type: 'game_invite',
      from_user_id: user.id,
      game_id: game.id,
    })
    setInvitedIds(prev => new Set([...prev, friendId]))
    setInviting(null)
  }

  async function promoteFromWaitlist() {
    if (!id) return
    const { data: first } = await supabase
      .from('waitlist')
      .select('id, user_id, position')
      .eq('game_id', id)
      .order('position', { ascending: true })
      .limit(1)
      .single()

    if (!first) return false

    await supabase.from('game_players').insert({ game_id: id, user_id: first.user_id })
    await supabase.from('waitlist').delete().eq('id', first.id)
    await supabase.from('notifications').insert({
      user_id: first.user_id,
      type: 'waitlist_promoted',
      from_user_id: null,
      game_id: id,
    })

    const { data: remaining } = await supabase
      .from('waitlist')
      .select('id')
      .eq('game_id', id)
      .order('position', { ascending: true })

    for (let i = 0; i < (remaining ?? []).length; i++) {
      await supabase.from('waitlist').update({ position: i + 1 }).eq('id', remaining![i].id)
    }

    return true
  }

  async function handleJoinWaitlist() {
    if (!user || !game) return
    setActionLoading(true)
    const nextPosition = waitlist.length + 1
    await supabase.from('waitlist').insert({ game_id: game.id, user_id: user.id, position: nextPosition })
    await fetchWaitlist()
    setActionLoading(false)
  }

  async function handleLeaveWaitlist() {
    if (!user || !game) return
    setActionLoading(true)
    await supabase.from('waitlist').delete().eq('game_id', game.id).eq('user_id', user.id)
    const { data: remaining } = await supabase
      .from('waitlist')
      .select('id')
      .eq('game_id', game.id)
      .order('position', { ascending: true })
    for (let i = 0; i < (remaining ?? []).length; i++) {
      await supabase.from('waitlist').update({ position: i + 1 }).eq('id', remaining![i].id)
    }
    await fetchWaitlist()
    setActionLoading(false)
  }

  async function handleJoin() {
    if (!user || !game) return
    setActionLoading(true)
    setError('')

    const { error: joinError } = await supabase.from('game_players').insert({
      game_id: game.id,
      user_id: user.id,
    })

    if (joinError) {
      setError(joinError.message)
    } else {
      await fetchGame()
      if (game.player_count !== undefined && game.player_count + 1 >= game.player_limit) {
        await supabase.from('games').update({ status: 'full' }).eq('id', game.id)
        await fetchGame()
      }
    }
    setActionLoading(false)
  }

  async function handleLeave() {
    if (!user || !game) return
    setActionLoading(true)
    setError('')

    await supabase.from('game_players').delete().eq('game_id', game.id).eq('user_id', user.id)

    if (game.status === 'full') {
      const promoted = await promoteFromWaitlist()
      if (!promoted) await supabase.from('games').update({ status: 'open' }).eq('id', game.id)
    }

    await fetchGame()
    await fetchWaitlist()
    setActionLoading(false)
  }

  function openEdit() {
    if (!game) return
    const d = new Date(game.date_time)
    setEditTitle(game.title)
    setEditSport(game.sport)
    setEditSkillLevel(game.skill_level)
    setEditLocation(game.location)
    setEditDate(d.toISOString().split('T')[0])
    setEditTime(d.toTimeString().slice(0, 5))
    setEditDescription(game.description ?? '')
    setEditing(true)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!game) return
    setEditLoading(true)
    const dateTime = new Date(`${editDate}T${editTime}`).toISOString()
    const { error: updateError } = await supabase
      .from('games')
      .update({
        title: editTitle.trim(),
        sport: editSport,
        skill_level: editSkillLevel,
        location: editLocation.trim(),
        date_time: dateTime,
        description: editDescription.trim() || null,
      })
      .eq('id', game.id)
    if (updateError) {
      setError(updateError.message)
    } else {
      setEditing(false)
      await fetchGame()
    }
    setEditLoading(false)
  }

  async function handleKick(playerId: string) {
    if (!game || !isCreator) return
    setActionLoading(true)
    await supabase.from('game_players').delete().eq('game_id', game.id).eq('user_id', playerId)
    if (game.status === 'full') {
      const promoted = await promoteFromWaitlist()
      if (!promoted) await supabase.from('games').update({ status: 'open' }).eq('id', game.id)
    }
    await fetchGame()
    await fetchWaitlist()
    setActionLoading(false)
  }

  async function handleCancel() {
    if (!game || !isCreator) return
    if (!confirm('Cancel this game? This cannot be undone.')) return
    setActionLoading(true)

    await supabase.from('games').update({ status: 'cancelled' }).eq('id', game.id)

    const notifRows = players
      .filter(p => p.user_id !== user!.id)
      .map(p => ({ user_id: p.user_id, type: 'game_cancelled', from_user_id: user!.id, game_id: game.id }))
    if (notifRows.length > 0) await supabase.from('notifications').insert(notifRows)

    await fetchGame()
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="detail-loading">
        <span className="spinner" style={{ borderTopColor: 'var(--orange)', width: 28, height: 28 }} />
      </div>
    )
  }

  if (!game) {
    return (
      <div className="container" style={{ paddingTop: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Game not found.</p>
        <Link to="/" className="btn btn-ghost" style={{ marginTop: 16 }}>Back to Games</Link>
      </div>
    )
  }

  return (
    <div className="detail-page">
      <div className="container">
        <button onClick={() => navigate(-1)} className="back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        <div className="detail-card card">
          {editing ? (
            <form onSubmit={handleSaveEdit} className="edit-form">
              <h2 className="edit-form-title">Edit Game</h2>
              <div className="field">
                <label htmlFor="edit-title">Game Name</label>
                <input id="edit-title" type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} required maxLength={80} />
              </div>
              <div className="field">
                <label htmlFor="edit-sport">Sport</label>
                <select id="edit-sport" value={editSport} onChange={e => setEditSport(e.target.value as Sport)}>
                  {SPORTS.map(s => (
                    <option key={s} value={s}>{SPORT_EMOJI[s]} {SPORT_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="edit-skill">Skill Level</label>
                <select id="edit-skill" value={editSkillLevel} onChange={e => setEditSkillLevel(e.target.value as SkillLevel)}>
                  {SKILL_LEVELS.map(s => (
                    <option key={s} value={s}>{SKILL_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="edit-location">Location / Court</label>
                <input id="edit-location" type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} required maxLength={120} />
              </div>
              <div className="create-row">
                <div className="field">
                  <label htmlFor="edit-date">Date</label>
                  <input id="edit-date" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="edit-time">Time</label>
                  <input id="edit-time" type="time" value={editTime} onChange={e => setEditTime(e.target.value)} required />
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-description">Details (optional)</label>
                <textarea id="edit-description" value={editDescription} onChange={e => setEditDescription(e.target.value)} maxLength={500} />
              </div>
              {error && <p className="error-msg">{error}</p>}
              <div className="edit-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? <span className="spinner" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
          <>
          {game.image_url && (
            <div className="detail-image">
              <img src={game.image_url} alt={game.title} />
            </div>
          )}

          <div className="detail-top">
            <div>
              <span className={`badge badge-${game.status}`} style={{ marginBottom: 8 }}>{game.status}</span>
              <h1 className="detail-title">{game.title}</h1>
              <p className="detail-host">Hosted by <strong>{game.profiles?.username ?? 'Unknown'}</strong></p>
            </div>
            <div className="detail-top-actions">
              <button className="btn btn-ghost btn-sm detail-share-btn" onClick={handleShare}>
                {copied ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>Copied!</span>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    Share
                  </>
                )}
              </button>
              {isCreator && game.status !== 'cancelled' && (
                <button className="btn btn-ghost btn-sm" onClick={openEdit}>Edit</button>
              )}
            </div>
          </div>

          <div className="divider" />

          <div className="detail-meta">
            <div className="detail-meta-item">
              <div className="detail-meta-icon" style={{ fontSize: 18 }}>
                {SPORT_EMOJI[game.sport]}
              </div>
              <div>
                <div className="detail-meta-label">Sport</div>
                <div className="detail-meta-value">{SPORT_LABEL[game.sport]}</div>
              </div>
            </div>
            <div className="detail-meta-item">
              <div className="detail-meta-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div>
                <div className="detail-meta-label">Location</div>
                <div className="detail-meta-value">
                  {game.court_id ? (
                    <Link to={`/courts/${game.court_id}`} className="detail-court-link">
                      {game.location}
                    </Link>
                  ) : game.location}
                </div>
              </div>
            </div>
            <div className="detail-meta-item">
              <div className="detail-meta-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <div className="detail-meta-label">Date & Time</div>
                <div className="detail-meta-value">{formatDateTime(game.date_time)}</div>
              </div>
            </div>
            {game.skill_level && game.skill_level !== 'all' && (
              <div className="detail-meta-item">
                <div className="detail-meta-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <div>
                  <div className="detail-meta-label">Skill Level</div>
                  <div className="detail-meta-value">{SKILL_LABEL[game.skill_level]}</div>
                </div>
              </div>
            )}
          </div>

          {game.description && (
            <>
              <div className="divider" />
              <p className="detail-description">{game.description}</p>
            </>
          )}

          <div className="divider" />

          <div className="detail-players-header">
            <span className="detail-players-title">
              Players ({game.player_count}/{game.player_limit})
              {waitlist.length > 0 && (
                <span className="waitlist-count">{waitlist.length} on waitlist</span>
              )}
            </span>
            <div className="detail-bar-wrap">
              <div className="game-card-bar" style={{ flex: 1 }}>
                <div
                  className="game-card-bar-fill"
                  style={{ width: `${Math.min(((game.player_count ?? 0) / game.player_limit) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="detail-player-list">
            {players.map((p, i) => {
              const profilePath = p.user_id === user?.id ? '/profile' : `/users/${p.user_id}`
              const canKick = isCreator && p.user_id !== user?.id && game.status !== 'cancelled'
              return (
                <div key={p.id} className="detail-player">
                  <Link to={profilePath} className="detail-player-link">
                    <div className="detail-player-avatar">
                      {(p.profiles?.username ?? '?')[0].toUpperCase()}
                    </div>
                    <span className="detail-player-name">{p.profiles?.username ?? 'Unknown'}</span>
                    {i === 0 && <span className="detail-player-host">Host</span>}
                  </Link>
                  {canKick && (
                    <button
                      className="detail-player-kick"
                      onClick={() => handleKick(p.user_id)}
                      disabled={actionLoading}
                      title="Remove player"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
            {Array.from({ length: game.player_limit - players.length }).map((_, i) => (
              <div key={`empty-${i}`} className="detail-player detail-player-empty">
                <div className="detail-player-avatar empty" />
                <span className="detail-player-name empty">Open</span>
              </div>
            ))}
          </div>

          {isCreator && friends.length > 0 && game.status !== 'cancelled' && !isPast && (
            <div className="invite-section">
              <button className="invite-toggle" onClick={() => setShowInvite(o => !o)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                Invite Friends
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: showInvite ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {showInvite && (
                <div className="invite-list">
                  {friends
                    .filter(f => !players.some(p => p.user_id === f.id))
                    .map(f => (
                      <div key={f.id} className="invite-row">
                        <div className="invite-avatar">{f.username[0].toUpperCase()}</div>
                        <span className="invite-name">{f.username}</span>
                        {invitedIds.has(f.id) ? (
                          <span className="invite-sent">Invited ✓</span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleInvite(f.id)}
                            disabled={inviting === f.id}
                          >
                            {inviting === f.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Invite'}
                          </button>
                        )}
                      </div>
                    ))}
                  {friends.filter(f => !players.some(p => p.user_id === f.id)).length === 0 && (
                    <div className="invite-empty">All your friends have already joined.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}

          {game.status !== 'cancelled' && (
            <div className="detail-actions">
              {!user ? (
                <Link to={`/auth?next=/games/${game.id}`} className="btn btn-primary btn-lg">
                  Sign in to Join
                </Link>
              ) : isCreator ? (
                <button
                  className="btn btn-danger"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  {actionLoading ? <span className="spinner" /> : 'Cancel Game'}
                </button>
              ) : isJoined ? (
                <button className="btn btn-ghost" onClick={handleLeave} disabled={actionLoading}>
                  {actionLoading ? <span className="spinner" /> : 'Leave Game'}
                </button>
              ) : isWaitlisted ? (
                <div className="waitlist-status">
                  <div className="waitlist-position">#{myWaitlistPosition} on waitlist</div>
                  <button className="btn btn-ghost btn-sm" onClick={handleLeaveWaitlist} disabled={actionLoading}>
                    {actionLoading ? <span className="spinner" /> : 'Leave Waitlist'}
                  </button>
                </div>
              ) : isFull ? (
                <button className="btn btn-primary btn-lg" onClick={handleJoinWaitlist} disabled={actionLoading}>
                  {actionLoading ? <span className="spinner" /> : 'Join Waitlist'}
                </button>
              ) : (
                <button className="btn btn-primary btn-lg" onClick={handleJoin} disabled={actionLoading}>
                  {actionLoading ? <span className="spinner" /> : 'Join Game'}
                </button>
              )}
            </div>
          )}

          {game.status === 'cancelled' && (
            <div className="detail-cancelled">
              This game has been cancelled.
            </div>
          )}

          {isPast && isJoined && game.status !== 'cancelled' && hasRated !== null && (
            <>
              <div className="divider" />
              <div className={`detail-rate-prompt ${hasRated ? 'detail-rate-prompt--done' : ''}`}>
                <div>
                  <div className="detail-rate-title">{hasRated ? '✅ Ratings submitted' : "Game's over — how'd it go?"}</div>
                  <div className="detail-rate-sub">{hasRated ? 'Thanks for rating.' : 'Rate the players you ran with.'}</div>
                </div>
                {!hasRated && (
                  <Link to={`/games/${game.id}/rate`} className="btn btn-primary btn-sm">
                    Rate Players
                  </Link>
                )}
              </div>
            </>
          )}

          <div className="divider" />

          <div className="chat-section">
            <div className="chat-header">
              <span className="chat-title">Game Chat</span>
              {comments.length > 0 && <span className="chat-count">{comments.length}</span>}
            </div>

            <div className="chat-messages">
              {comments.length === 0 && (
                <div className="chat-empty">
                  <p>No messages yet. Ask the group something.</p>
                </div>
              )}
              {comments.map(c => {
                const isOwn = c.user_id === user?.id
                const time = new Date(c.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                return (
                  <div key={c.id} className={`chat-msg ${isOwn ? 'chat-msg-own' : 'chat-msg-other'}`}>
                    {!isOwn && (
                      <div className="chat-avatar">{(c.profiles?.username ?? '?')[0].toUpperCase()}</div>
                    )}
                    <div className="chat-bubble-wrap">
                      {!isOwn && <div className="chat-name">{c.profiles?.username ?? 'Unknown'}</div>}
                      <div className="chat-bubble">{c.body}</div>
                      <div className="chat-time">{time}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={chatBottomRef} />
            </div>

            {user ? (
              <>
                <div className="chat-quick-replies">
                  {['Still happening?', 'Need one more?', 'Lights available?', 'Indoor or outdoor?'].map(q => (
                    <button key={q} type="button" className="quick-reply" onClick={() => setCommentBody(q)}>
                      {q}
                    </button>
                  ))}
                </div>
                <form onSubmit={handlePostComment} className="chat-form">
                  <input
                    className="chat-input"
                    placeholder="Message the group..."
                    value={commentBody}
                    onChange={e => setCommentBody(e.target.value)}
                    onKeyDown={handleChatKey}
                    maxLength={300}
                  />
                  <button type="submit" className="chat-send" disabled={commentLoading || !commentBody.trim()}>
                    {commentLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <p className="chat-signin"><Link to="/auth">Sign in</Link> to chat with the group.</p>
            )}
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
