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
