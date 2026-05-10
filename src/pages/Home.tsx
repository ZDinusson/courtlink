import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import GameCard from '../components/GameCard'
import type { Game } from '../types'
import './Home.css'

type Filter = 'open' | 'all'

export default function Home() {
  const { user } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('open')

  useEffect(() => {
    fetchGames()
  }, [filter])

  async function fetchGames() {
    setLoading(true)
    let query = supabase
      .from('games')
      .select(`
        *,
        profiles (id, username),
        game_players (id)
      `)
      .gte('date_time', new Date().toISOString())
      .order('date_time', { ascending: true })

    if (filter === 'open') {
      query = query.eq('status', 'open')
    } else {
      query = query.neq('status', 'cancelled')
    }

    const { data, error } = await query

    if (!error && data) {
      const gamesWithCount = data.map((g: Game & { game_players: { id: string }[] }) => ({
        ...g,
        player_count: g.game_players?.length ?? 0,
      }))

      if (user) {
        const ids = gamesWithCount.map((g: Game) => g.id)
        const { data: joined } = await supabase
          .from('game_players')
          .select('game_id')
          .eq('user_id', user.id)
          .in('game_id', ids)

        const joinedSet = new Set((joined ?? []).map((j: { game_id: string }) => j.game_id))
        setGames(gamesWithCount.map((g: Game) => ({ ...g, is_joined: joinedSet.has(g.id) })))
      } else {
        setGames(gamesWithCount)
      }
    }
    setLoading(false)
  }

  return (
    <div className="home">
      <div className="container">
        <div className="home-hero">
          <div>
            <h1 className="home-title">Find a Run</h1>
            <p className="home-subtitle">Pickup games happening near you</p>
          </div>
          {user && (
            <Link to="/games/new" className="btn btn-primary btn-lg">
              + Host a Game
            </Link>
          )}
        </div>

        <div className="home-filters">
          <button
            className={`filter-btn ${filter === 'open' ? 'active' : ''}`}
            onClick={() => setFilter('open')}
          >
            Open Games
          </button>
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Upcoming
          </button>
        </div>

        {loading ? (
          <div className="home-loading">
            <span className="spinner" style={{ borderTopColor: 'var(--orange)', width: 28, height: 28 }} />
          </div>
        ) : games.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon">🏀</div>
            <p className="home-empty-text">No games scheduled yet.</p>
            {user ? (
              <Link to="/games/new" className="btn btn-primary">
                Be the first to host one
              </Link>
            ) : (
              <Link to="/auth" className="btn btn-primary">
                Sign in to host a game
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
