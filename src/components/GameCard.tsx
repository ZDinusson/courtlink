import { Link } from 'react-router-dom'
import { SPORT_EMOJI, SKILL_LABEL } from '../types'
import type { Game } from '../types'
import './GameCard.css'

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  if (d.toDateString() === today.toDateString()) return `Today · ${timeStr}`
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${timeStr}`
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${timeStr}`
}

interface Props {
  game: Game
}

export default function GameCard({ game }: Props) {
  const filled = game.player_count ?? 0
  const total = game.player_limit
  const spotsLeft = total - filled
  const pct = Math.min((filled / total) * 100, 100)

  return (
    <Link to={`/games/${game.id}`} className="game-card">
      {game.image_url && (
        <div className="game-card-image">
          <img src={game.image_url} alt={game.title} />
        </div>
      )}

      <div className="game-card-body">
        <div className="game-card-header">
          <div>
            <h3 className="game-card-title">{game.title}</h3>
            <p className="game-card-sub">{game.profiles?.username ?? 'Unknown'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="game-card-sport">{SPORT_EMOJI[game.sport]}</span>
            {game.skill_level && game.skill_level !== 'all' && (
              <span className="badge badge-skill">{SKILL_LABEL[game.skill_level]}</span>
            )}
            <span className={`badge badge-${game.status}`}>{game.status}</span>
          </div>
        </div>

        <div className="game-card-meta">
          <div className="game-card-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {game.location}
          </div>
          <div className="game-card-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            {formatDate(game.date_time)}
          </div>
        </div>

        <div className="game-card-players">
          <div className="game-card-bar">
            <div className="game-card-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="game-card-player-text">
            {filled}/{total} players
            {game.status === 'open' && spotsLeft > 0 && (
              <span className="spots-left"> · {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left</span>
            )}
          </span>
        </div>
      </div>
    </Link>
  )
}
