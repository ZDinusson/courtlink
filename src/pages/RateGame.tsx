import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Attendance, GamePlayer, Game } from '../types'
import './RateGame.css'

interface PlayerRating {
  attendance: Attendance | null
  attitudeRating: number | null
  hostRating: number | null
}

function StarPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? value ?? 0
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`star ${n <= display ? 'active' : ''}`}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onChange(n)}
          aria-label={`${n} star`}
        >
          ★
        </button>
      ))}
      {value && <span className="star-label">{value}/5</span>}
    </div>
  )
}

export default function RateGame() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [alreadyRated, setAlreadyRated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [ratings, setRatings] = useState<Record<string, PlayerRating>>({})

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

    const { data: existing } = await supabase
      .from('ratings')
      .select('id')
      .eq('game_id', id)
      .eq('rater_id', user.id)

    if (gameData) setGame({ ...gameData, player_count: playersData?.length ?? 0 })
    setPlayers(playersData ?? [])
    setAlreadyRated((existing ?? []).length > 0)

    const initial: Record<string, PlayerRating> = {}
    for (const p of playersData ?? []) {
      if (p.user_id !== user.id) {
        initial[p.user_id] = { attendance: null, attitudeRating: null, hostRating: null }
      }
    }
    setRatings(initial)
    setLoading(false)
  }

  function update(userId: string, patch: Partial<PlayerRating>) {
    setRatings(prev => ({ ...prev, [userId]: { ...prev[userId], ...patch } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !game) return
    setSubmitting(true)

    const rows = Object.entries(ratings)
      .filter(([, r]) => r.attendance || r.attitudeRating || r.hostRating)
      .map(([rateeId, r]) => ({
        game_id: game.id,
        rater_id: user.id,
        ratee_id: rateeId,
        attendance: r.attendance ?? null,
        attitude_rating: r.attitudeRating ?? null,
        host_rating: r.hostRating ?? null,
      }))

    if (rows.length > 0) await supabase.from('ratings').insert(rows)
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
        <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Already rated this game.</p>
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
            const r = ratings[player.user_id]
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
                  <div className="rate-attendance">
                    <button
                      type="button"
                      className={`attendance-btn positive ${r?.attendance === 'showed_up' ? 'selected' : ''}`}
                      onClick={() => update(player.user_id, { attendance: r?.attendance === 'showed_up' ? null : 'showed_up' })}
                    >
                      ✅ Showed Up
                    </button>
                    <button
                      type="button"
                      className={`attendance-btn negative ${r?.attendance === 'no_show' ? 'selected' : ''}`}
                      onClick={() => update(player.user_id, { attendance: r?.attendance === 'no_show' ? null : 'no_show' })}
                    >
                      ❌ No-Show
                    </button>
                  </div>
                </div>

                <div className="rate-group">
                  <div className="rate-group-label">Attitude</div>
                  <StarPicker
                    value={r?.attitudeRating ?? null}
                    onChange={v => update(player.user_id, { attitudeRating: v })}
                  />
                </div>

                {isHost && (
                  <div className="rate-group">
                    <div className="rate-group-label">Host Quality</div>
                    <StarPicker
                      value={r?.hostRating ?? null}
                      onChange={v => update(player.user_id, { hostRating: v })}
                    />
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
