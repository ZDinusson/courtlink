import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SPORT_EMOJI, SPORT_LABEL, type Game, type GamePlayer } from '../types'
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

  const isCreator = user?.id === game?.created_by
  const isJoined = players.some(p => p.user_id === user?.id)
  const isFull = (game?.player_count ?? 0) >= (game?.player_limit ?? 0)

  useEffect(() => {
    fetchGame()
  }, [id])

  async function fetchGame() {
    if (!id) return
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

    if (gameData) {
      setGame({ ...gameData, player_count: playersData?.length ?? 0 })
    }
    setPlayers(playersData ?? [])
    setLoading(false)
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
      await supabase.from('games').update({ status: 'open' }).eq('id', game.id)
    }

    await fetchGame()
    setActionLoading(false)
  }

  async function handleCancel() {
    if (!game || !isCreator) return
    if (!confirm('Cancel this game? This cannot be undone.')) return
    setActionLoading(true)

    await supabase.from('games').update({ status: 'cancelled' }).eq('id', game.id)
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
          <div className="detail-top">
            <div>
              <span className={`badge badge-${game.status}`} style={{ marginBottom: 8 }}>{game.status}</span>
              <h1 className="detail-title">{game.title}</h1>
              <p className="detail-host">Hosted by <strong>{game.profiles?.username ?? 'Unknown'}</strong></p>
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
                <div className="detail-meta-value">{game.location}</div>
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
            {players.map((p, i) => (
              <div key={p.id} className="detail-player">
                <div className="detail-player-avatar">
                  {(p.profiles?.username ?? '?')[0].toUpperCase()}
                </div>
                <span className="detail-player-name">{p.profiles?.username ?? 'Unknown'}</span>
                {i === 0 && <span className="detail-player-host">Host</span>}
              </div>
            ))}
            {Array.from({ length: game.player_limit - players.length }).map((_, i) => (
              <div key={`empty-${i}`} className="detail-player detail-player-empty">
                <div className="detail-player-avatar empty" />
                <span className="detail-player-name empty">Open</span>
              </div>
            ))}
          </div>

          {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}

          {game.status !== 'cancelled' && (
            <div className="detail-actions">
              {!user ? (
                <Link to="/auth" className="btn btn-primary btn-lg">
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
                <button
                  className="btn btn-ghost"
                  onClick={handleLeave}
                  disabled={actionLoading}
                >
                  {actionLoading ? <span className="spinner" /> : 'Leave Game'}
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleJoin}
                  disabled={actionLoading || isFull || game.status === 'full'}
                >
                  {actionLoading
                    ? <span className="spinner" />
                    : isFull ? 'Game Full' : 'Join Game'}
                </button>
              )}
            </div>
          )}

          {game.status === 'cancelled' && (
            <div className="detail-cancelled">
              This game has been cancelled.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
