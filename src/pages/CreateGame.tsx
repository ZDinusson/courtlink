import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './CreateGame.css'

export default function CreateGame() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [playerLimit, setPlayerLimit] = useState(10)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const minDate = new Date().toISOString().split('T')[0]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    setLoading(true)

    const dateTime = new Date(`${date}T${time}`).toISOString()

    const { data, error: insertError } = await supabase
      .from('games')
      .insert({
        created_by: user.id,
        title: title.trim(),
        location: location.trim(),
        date_time: dateTime,
        player_limit: playerLimit,
        description: description.trim() || null,
        status: 'open',
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Auto-join the creator
    await supabase.from('game_players').insert({
      game_id: data.id,
      user_id: user.id,
    })

    navigate(`/games/${data.id}`)
  }

  return (
    <div className="create-page">
      <div className="container">
        <div className="create-header">
          <button onClick={() => navigate(-1)} className="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <h1 className="create-title">Host a Game</h1>
        </div>

        <form onSubmit={handleSubmit} className="create-form card">
          <div className="field">
            <label htmlFor="title">Game Name</label>
            <input
              id="title"
              type="text"
              placeholder="e.g. Saturday Run at Rucker"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              maxLength={80}
            />
          </div>

          <div className="field">
            <label htmlFor="location">Location / Court</label>
            <input
              id="location"
              type="text"
              placeholder="e.g. Venice Beach Courts, LA"
              value={location}
              onChange={e => setLocation(e.target.value)}
              required
              maxLength={120}
            />
          </div>

          <div className="create-row">
            <div className="field">
              <label htmlFor="date">Date</label>
              <input
                id="date"
                type="date"
                value={date}
                min={minDate}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="time">Time</label>
              <input
                id="time"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="limit">Player Limit</label>
            <div className="player-limit-control">
              <button
                type="button"
                className="limit-btn"
                onClick={() => setPlayerLimit(p => Math.max(2, p - 1))}
                disabled={playerLimit <= 2}
              >−</button>
              <span className="limit-value">{playerLimit}</span>
              <button
                type="button"
                className="limit-btn"
                onClick={() => setPlayerLimit(p => Math.min(30, p + 1))}
                disabled={playerLimit >= 30}
              >+</button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="description">Details (optional)</label>
            <textarea
              id="description"
              placeholder="Rules, bring your own ball, what level of play to expect..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className="create-actions">
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Post Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
