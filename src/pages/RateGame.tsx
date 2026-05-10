import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  PLAYER_TAGS, HOST_TAGS, TAG_LABEL, TAG_EMOJI,
  type RatingTag, type GamePlayer, type Game,
} from '../types'
import './RateGame.css'

export default function RateGame() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [alreadyRated, setAlreadyRated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [ratings, setRatings] = useState<Record<string, RatingTag[]>>({})

  useEffect(() => {
    if (id && user) load()
  }, [id, user])

  async function load() {
    if (!id || !user) return
    setLoading(true)

    const { data: gameData } = await supabase
      .from('games')
      .select('*, profiles (id, username)')
      .eq('id', id)
      .single()

    const { data: playersData } = await supabase
      .from('game_players')
      .select('*, profiles (id, username)')
      .eq('game_id', id)
      .order('joined_at', { ascending: true })

    const { data: existingRatings } = await supabase
      .from('ratings')
      .select('id')
      .eq('game_id', id)
      .eq('rater_id', user.id)

    if (gameData) setGame({ ...gameData, player_count: playersData?.length ?? 0 })
    setPlayers(playersData ?? [])
    setAlreadyRated((existingRatings ?? []).length > 0)

    const initial: Record<string, RatingTag[]> = {}
    for (const p of playersData ?? []) {
      if (p.user_id !== user.id) initial[p.user_id] = []
    }
    setRatings(initial)

    setLoading(false)
  }

  function toggleTag(userId: string, tag: RatingTag) {
    setRatings(prev => {
      const current = prev[userId] ?? []
      if (tag === 'showed_up' && !current.includes('showed_up')) {
        return { ...prev, [userId]: [...current.filter(t => t !== 'no_show'), 'showed_up'] }
      }
      if (tag === 'no_show' && !current.includes('no_show')) {
        return { ...prev, [userId]: [...current.filter(t => t !== 'showed_up'), 'no_show'] }
      }
      if (current.includes(tag)) {
        return { ...prev, [userId]: current.filter(t => t !== tag) }
      }
      return { ...prev, [userId]: [...current, tag] }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !game) return
    setSubmitting(true)

    const rows = Object.entries(ratings)
      .filter(([, tags]) => tags.length > 0)
      .map(([rateeId, tags]) => ({
        game_id: game.id,
        rater_id: user.id,
        ratee_id: rateeId,
        tags,
      }))

    if (rows.length > 0) {
      await supabase.from('ratings').insert(rows)
    }

    navigate(`/games/${game.id}`)
  }

  if (loading) {
    return (
      <div className="rate-loading">
        <span className="spinner" style={{ width: 28, height: 28 }} />
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

  const isParticipant = players.some(p => p.user_id === user?.id)
  const isPast = new Date(game.date_time) < new Date()

  if (!isParticipant || !isPast) {
    return (
      <div className="container" style={{ paddingTop: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Ratings aren't available for this game.</p>
        <Link to={`/games/${id}`} className="btn btn-ghost" style={{ marginTop: 16 }}>Back to Game</Link>
      </div>
    )
  }

  if (alreadyRated) {
    return (
      <div className="container" style={{ paddingTop: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>You've already rated this game.</p>
        <Link to={`/games/${id}`} className="btn btn-ghost" style={{ marginTop: 8 }}>Back to Game</Link>
      </div>
    )
  }

  const others = players.filter(p => p.user_id !== user?.id)

  return (
    <div className="rate-page">
      <div className="container">
        <button onClick={() => navigate(`/games/${id}`)} className="back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        <div className="rate-header">
          <h1 className="rate-title">Rate Players</h1>
          <p className="rate-subtitle">{game.title}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {others.map(player => {
            const isHost = player.user_id === game.created_by
            const selected = ratings[player.user_id] ?? []
            return (
              <div key={player.user_id} className="rate-card card">
                <div className="rate-player-header">
                  <div className="rate-player-avatar">
                    {(player.profiles?.username ?? '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="rate-player-name">{player.profiles?.username ?? 'Unknown'}</div>
                    {isHost && <div className="rate-player-role">Host</div>}
                  </div>
                </div>

                <div className="rate-group">
                  <div className="rate-group-label">Attendance</div>
                  <div className="rate-tags">
                    {(['showed_up', 'no_show'] as const).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className={`rate-tag ${selected.includes(tag) ? 'selected' : ''} ${tag === 'no_show' ? 'tag-negative' : 'tag-positive'}`}
                        onClick={() => toggleTag(player.user_id, tag)}
                      >
                        {TAG_EMOJI[tag]} {TAG_LABEL[tag]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rate-group">
                  <div className="rate-group-label">Player vibes</div>
                  <div className="rate-tags">
                    {(['good_teammate', 'too_aggressive', 'friendly_player'] as const).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className={`rate-tag ${selected.includes(tag) ? 'selected' : ''} ${tag === 'too_aggressive' ? 'tag-negative' : ''}`}
                        onClick={() => toggleTag(player.user_id, tag)}
                      >
                        {TAG_EMOJI[tag]} {TAG_LABEL[tag]}
                      </button>
                    ))}
                  </div>
                </div>

                {isHost && (
                  <div className="rate-group">
                    <div className="rate-group-label">Host quality</div>
                    <div className="rate-tags">
                      {HOST_TAGS.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          className={`rate-tag ${selected.includes(tag) ? 'selected' : ''}`}
                          onClick={() => toggleTag(player.user_id, tag)}
                        >
                          {TAG_EMOJI[tag]} {TAG_LABEL[tag]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div className="rate-actions">
            <button type="button" className="btn btn-ghost" onClick={() => navigate(`/games/${id}`)}>
              Skip
            </button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
              {submitting ? <span className="spinner" /> : 'Submit Ratings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
