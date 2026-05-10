import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import GameCard from '../components/GameCard'
import { SPORTS, SPORT_EMOJI, SPORT_LABEL, SKILL_LEVELS, SKILL_LABEL, type Sport, type SkillLevel, type Game } from '../types'
import { haversineDistance } from '../utils/distance'
import './Home.css'

type StatusFilter = 'open' | 'all'
type SportFilter = Sport | 'all'

function getTimeRange(dateStr: string): { start: string; end: string } | null {
  if (!dateStr) return null
  const start = new Date(`${dateStr}T00:00:00`)
  const end = new Date(`${dateStr}T23:59:59.999`)
  return { start: start.toISOString(), end: end.toISOString() }
}

function buildDateOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  for (let i = 0; i < 30; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const value = d.toISOString().split('T')[0]
    const label = i === 0
      ? 'Today'
      : i === 1
      ? 'Tomorrow'
      : `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`
    options.push({ value, label })
  }
  return options
}

const DATE_OPTIONS = buildDateOptions()

export default function Home() {
  const { user } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [sportFilter, setSportFilter] = useState<SportFilter>('all')
  const [whenFilter, setWhenFilter] = useState('')
  const [skillFilter, setSkillFilter] = useState<SkillLevel | 'any'>('any')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusFilter, setRadiusFilter] = useState<number | 'any'>('any')

  useEffect(() => {
    fetchGames()
  }, [statusFilter, sportFilter, whenFilter, skillFilter])

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 8000 }
    )
  }, [])

  async function fetchGames() {
    setLoading(true)
    let query = supabase
      .from('games')
      .select('*, profiles (id, username), game_players (id)')
      .order('date_time', { ascending: true })

    if (statusFilter === 'open') {
      query = query.eq('status', 'open')
    } else {
      query = query.neq('status', 'cancelled')
    }

    const timeRange = getTimeRange(whenFilter)
    if (timeRange) {
      query = query.gte('date_time', timeRange.start).lte('date_time', timeRange.end)
    } else {
      query = query.gte('date_time', new Date().toISOString())
    }


    if (sportFilter !== 'all') query = query.eq('sport', sportFilter)
    if (skillFilter !== 'any') query = query.eq('skill_level', skillFilter)

    const { data, error } = await query

    if (!error && data) {
      const gamesWithCount = data.map((g: Game & { game_players: { id: string }[] }) => ({
        ...g,
        player_count: g.game_players?.length ?? 0,
      }))

      const hostIds = [...new Set(gamesWithCount.map((g: Game) => g.created_by))]
      const { data: ratingsData } = await supabase
        .from('ratings')
        .select('ratee_id, host_rating')
        .in('ratee_id', hostIds)
        .not('host_rating', 'is', null)

      const hostRatingMap: Record<string, { total: number; count: number }> = {}
      for (const r of ratingsData ?? []) {
        if (!hostRatingMap[r.ratee_id]) hostRatingMap[r.ratee_id] = { total: 0, count: 0 }
        hostRatingMap[r.ratee_id].total += r.host_rating
        hostRatingMap[r.ratee_id].count += 1
      }

      const gamesWithRating = gamesWithCount.map((g: Game) => ({
        ...g,
        hostRating: hostRatingMap[g.created_by]
          ? { avg: hostRatingMap[g.created_by].total / hostRatingMap[g.created_by].count, count: hostRatingMap[g.created_by].count }
          : null,
      }))

      if (user && gamesWithRating.length > 0) {
        const ids = gamesWithRating.map((g: Game) => g.id)
        const { data: joined } = await supabase
          .from('game_players')
          .select('game_id')
          .eq('user_id', user.id)
          .in('game_id', ids)
        const joinedSet = new Set((joined ?? []).map((j: { game_id: string }) => j.game_id))
        setGames(gamesWithRating.map((g: Game) => ({ ...g, is_joined: joinedSet.has(g.id) })))
      } else {
        setGames(gamesWithRating)
      }
    }
    setLoading(false)
  }

  const filteredGames = useMemo(() => {
    let result = games
    if (userLocation && radiusFilter !== 'any') {
      result = result.filter(g =>
        g.lat != null && haversineDistance(userLocation.lat, userLocation.lng, g.lat!, g.lng!) <= radiusFilter
      )
    }
    if (userLocation) {
      result = [...result].sort((a, b) => {
        const da = a.lat != null ? haversineDistance(userLocation.lat, userLocation.lng, a.lat!, a.lng!) : Infinity
        const db = b.lat != null ? haversineDistance(userLocation.lat, userLocation.lng, b.lat!, b.lng!) : Infinity
        return da - db
      })
    }
    return result
  }, [games, userLocation, radiusFilter])

  const hasActiveFilters = sportFilter !== 'all' || whenFilter !== '' || skillFilter !== 'any' || radiusFilter !== 'any'

  function clearFilters() {
    setSportFilter('all')
    setWhenFilter('')
    setSkillFilter('any')
    setRadiusFilter('any')
  }

  const emptyIcon = sportFilter !== 'all' ? SPORT_EMOJI[sportFilter] : '🔍'

  return (
    <div className="home">
      <section className="home-banner">
        <div className="container">
          <div className="home-banner-inner">
            <div>
              <h1 className="home-banner-title">Find a Game</h1>
              <p className="home-banner-sub">Pickup games happening near you</p>
            </div>
            <Link to={user ? '/games/new' : '/auth'} className="btn btn-primary btn-lg home-banner-cta">
              {user ? '+ Host a Game' : 'Get Started'}
            </Link>
          </div>
        </div>
      </section>

      <div className="container home-body">

        <div className="find-panel card">
          <div className="find-panel-label">Find me a game</div>
          <div className="find-filters">
            <div className="find-filter">
              <label>Sport</label>
              <select value={sportFilter} onChange={e => setSportFilter(e.target.value as SportFilter)}>
                <option value="all">Any sport</option>
                {SPORTS.map(s => (
                  <option key={s} value={s}>{SPORT_EMOJI[s]} {SPORT_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div className="find-filter">
              <label>When</label>
              <select value={whenFilter} onChange={e => setWhenFilter(e.target.value)}>
                <option value="">Any time</option>
                {DATE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="find-filter">
              <label>Skill</label>
              <select value={skillFilter} onChange={e => setSkillFilter(e.target.value as SkillLevel | 'any')}>
                <option value="any">Any level</option>
                {SKILL_LEVELS.filter(s => s !== 'all').map(s => (
                  <option key={s} value={s}>{SKILL_LABEL[s]}</option>
                ))}
              </select>
            </div>
            {userLocation && (
              <div className="find-filter">
                <label>Distance</label>
                <select value={radiusFilter} onChange={e => setRadiusFilter(e.target.value === 'any' ? 'any' : Number(e.target.value))}>
                  <option value="any">Any distance</option>
                  <option value={2}>Within 2 mi</option>
                  <option value={5}>Within 5 mi</option>
                  <option value={10}>Within 10 mi</option>
                  <option value={25}>Within 25 mi</option>
                </select>
              </div>
            )}
          </div>
          {hasActiveFilters && (
            <button className="find-clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <div className="home-filters">
          <button
            className={`filter-btn ${statusFilter === 'open' ? 'active' : ''}`}
            onClick={() => setStatusFilter('open')}
          >
            Open Games
          </button>
          <button
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Upcoming
          </button>
        </div>

        {loading ? (
          <div className="home-loading">
            <span className="spinner" style={{ borderTopColor: 'var(--orange)', width: 28, height: 28 }} />
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon">{emptyIcon}</div>
            <p className="home-empty-text">
              {radiusFilter !== 'any'
                ? `No games within ${radiusFilter} miles.`
                : hasActiveFilters
                ? 'No games match your filters.'
                : 'No games scheduled yet.'}
            </p>
            {radiusFilter !== 'any' ? (
              <button className="btn btn-ghost" onClick={() => setRadiusFilter('any')}>Expand search</button>
            ) : hasActiveFilters ? (
              <button className="btn btn-ghost" onClick={clearFilters}>Clear filters</button>
            ) : user ? (
              <Link to="/games/new" className="btn btn-primary">Be the first to host one</Link>
            ) : (
              <Link to="/auth" className="btn btn-primary">Sign in to host a game</Link>
            )}
          </div>
        ) : (
          <div className="game-grid">
            {filteredGames.map(game => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
