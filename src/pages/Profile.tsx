import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Game } from '../types'
import GameCard from '../components/GameCard'
import './Profile.css'

type Tab = 'hosting' | 'joined'

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

  useEffect(() => {
    if (user) fetchData()
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

    if (attitudes.length > 0) {
      setPlayerRating({ avg: attitudes.reduce((a, b) => a + b, 0) / attitudes.length, count: attitudes.length })
    }
    if (hosts.length > 0) {
      setHostRating({ avg: hosts.reduce((a, b) => a + b, 0) / hosts.length, count: hosts.length })
    }
    setAttendance({ showed, noShow })

    if (tab === 'hosting') {
      const { data } = await supabase
        .from('games')
        .select('*, profiles (id, username), game_players (id)')
        .eq('created_by', user.id)
        .order('date_time', { ascending: false })

      setGames((data ?? []).map((g: Game & { game_players: { id: string }[] }) => ({
        ...g,
        player_count: g.game_players?.length ?? 0,
      })))
    } else {
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
          .order('date_time', { ascending: false })

        setGames((data ?? []).map((g: Game & { game_players: { id: string }[] }) => ({
          ...g,
          player_count: g.game_players?.length ?? 0,
          is_joined: true,
        })))
      }
    }

    setLoading(false)
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
            <h1 className="profile-username">{username || user?.email}</h1>
            <p className="profile-email">{user?.email}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>

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
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <span className="spinner" style={{ borderTopColor: 'var(--orange)', width: 24, height: 24 }} />
          </div>
        ) : games.length === 0 ? (
          <div className="profile-empty">
            <p className="profile-empty-text">
              {tab === 'hosting' ? "You haven't hosted any games yet." : "You haven't joined any games yet."}
            </p>
            <Link to={tab === 'hosting' ? '/games/new' : '/'} className="btn btn-primary">
              {tab === 'hosting' ? 'Host a Game' : 'Browse Games'}
            </Link>
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
