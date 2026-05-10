import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import GameCard from '../components/GameCard'
import type { Game } from '../types'
import './Landing.css'

const FEATURES = [
  {
    icon: '📍',
    title: 'Find a game',
    desc: 'See open games by sport, skill level, and time. No group chats, no coordinating.',
  },
  {
    icon: '✅',
    title: 'Join in one tap',
    desc: 'Claim your spot instantly. The host sees you\'re in and the group fills up fast.',
  },
  {
    icon: '⭐',
    title: 'Build your reputation',
    desc: 'Get rated on attitude and attendance after every game. Show up, play hard, earn it.',
  },
]

export default function Landing() {
  const [games, setGames] = useState<Game[]>([])
  const gamesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchGames() {
      const { data } = await supabase
        .from('games')
        .select('*, profiles (id, username), game_players (id)')
        .eq('status', 'open')
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true })
        .limit(4)

      if (data) {
        setGames(data.map((g: Game & { game_players: { id: string }[] }) => ({
          ...g,
          player_count: g.game_players?.length ?? 0,
        })))
      }
    }
    fetchGames()
  }, [])

  function scrollToGames() {
    gamesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing">

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-sports-bg">
          <span>🏀</span><span>🏓</span><span>🎾</span><span>🏸</span>
        </div>
        <div className="container landing-hero-inner">
          <div className="landing-hero-content">
            <h1 className="landing-headline">
              Your next pickup game<br />is waiting.
            </h1>
            <p className="landing-sub">
              CourtLink connects you with local basketball, pickleball, tennis, and badminton games in your city.
            </p>
            <div className="landing-ctas">
              <Link to="/auth" className="btn btn-primary btn-lg">
                Get Started
              </Link>
              <button className="btn btn-ghost btn-lg landing-browse-btn" onClick={scrollToGames}>
                Browse Games
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-how">
        <div className="container">
          <h2 className="landing-section-title">How it works</h2>
          <div className="landing-features">
            {FEATURES.map(f => (
              <div key={f.title} className="landing-feature-card card">
                <div className="landing-feature-icon">{f.icon}</div>
                <div className="landing-feature-title">{f.title}</div>
                <div className="landing-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live games */}
      <section className="landing-games" ref={gamesRef}>
        <div className="container">
          <div className="landing-games-header">
            <h2 className="landing-section-title" style={{ marginBottom: 0 }}>Games happening now</h2>
            <Link to="/auth" className="landing-see-all">Sign up to join →</Link>
          </div>

          {games.length === 0 ? (
            <div className="landing-games-empty">
              <p>No open games right now — be the first to host one.</p>
              <Link to="/auth" className="btn btn-primary">Host a Game</Link>
            </div>
          ) : (
            <div className="game-grid landing-games-grid">
              {games.map(g => <GameCard key={g.id} game={g} />)}
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="landing-cta-banner">
        <div className="container landing-cta-inner">
          <h2 className="landing-cta-title">Ready to run?</h2>
          <p className="landing-cta-sub">Create a free account and find your next game in minutes.</p>
          <Link to="/auth" className="btn btn-lg landing-cta-btn">
            Create a free account
          </Link>
        </div>
      </section>

    </div>
  )
}
