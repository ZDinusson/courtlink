import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SPORTS, SPORT_EMOJI, SPORT_LABEL, SKILL_LEVELS, SKILL_LABEL, type Sport, type SkillLevel } from '../types'
import './CreateGame.css'

interface CourtResult {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

export default function CreateGame() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [sport, setSport] = useState<Sport>('basketball')
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('all')
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [playerLimit, setPlayerLimit] = useState(10)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [courtQuery, setCourtQuery] = useState('')
  const [courtResults, setCourtResults] = useState<CourtResult[]>([])
  const [selectedCourt, setSelectedCourt] = useState<CourtResult | null>(null)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const minDate = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!courtQuery.trim() || selectedCourt) {
      setCourtResults([])
      return
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('courts')
        .select('id, name, address, lat, lng')
        .ilike('name', `%${courtQuery}%`)
        .limit(6)
      setCourtResults(data ?? [])
    }, 250)
    return () => clearTimeout(timer)
  }, [courtQuery, selectedCourt])

  function selectCourt(c: CourtResult) {
    setSelectedCourt(c)
    setLocation(c.name)
    setCourtQuery('')
    setCourtResults([])
  }

  function clearCourt() {
    setSelectedCourt(null)
    setLocation('')
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { 'User-Agent': 'CourtLink App' } }
      )
      const results = await res.json()
      if (!results.length) return null
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
    } catch {
      return null
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    setLoading(true)

    const dateTime = new Date(`${date}T${time}`).toISOString()

    let lat: number | null = selectedCourt?.lat ?? null
    let lng: number | null = selectedCourt?.lng ?? null

    if (!selectedCourt && location.trim()) {
      const coords = await geocode(location.trim())
      lat = coords?.lat ?? null
      lng = coords?.lng ?? null
    }

    const { data, error: insertError } = await supabase
      .from('games')
      .insert({
        created_by: user.id,
        title: title.trim(),
        sport,
        skill_level: skillLevel,
        location: location.trim(),
        date_time: dateTime,
        player_limit: playerLimit,
        description: description.trim() || null,
        status: 'open',
        court_id: selectedCourt?.id ?? null,
        lat,
        lng,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Upload image if selected
    if (imageFile) {
      const ext = imageFile.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${data.id}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('game-images')
        .upload(path, imageFile, { upsert: true })

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('game-images').getPublicUrl(path)
        await supabase.from('games').update({ image_url: urlData.publicUrl }).eq('id', data.id)
      }
    }

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
            <label>Photo (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
            {imagePreview ? (
              <div className="image-preview-wrap">
                <img src={imagePreview} className="image-preview" alt="Game photo" />
                <button type="button" className="image-clear" onClick={clearImage}>×</button>
              </div>
            ) : (
              <button
                type="button"
                className="image-pick-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Add a photo
              </button>
            )}
          </div>

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
            <label htmlFor="sport">Sport</label>
            <select
              id="sport"
              value={sport}
              onChange={e => setSport(e.target.value as Sport)}
              className="sport-select"
            >
              {SPORTS.map(s => (
                <option key={s} value={s}>
                  {SPORT_EMOJI[s]} {SPORT_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="skill">Skill Level</label>
            <select
              id="skill"
              value={skillLevel}
              onChange={e => setSkillLevel(e.target.value as SkillLevel)}
              className="sport-select"
            >
              {SKILL_LEVELS.map(s => (
                <option key={s} value={s}>{SKILL_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Court (optional)</label>
            {selectedCourt ? (
              <div className="court-selected">
                <div className="court-selected-info">
                  <div className="court-selected-name">{selectedCourt.name}</div>
                  <div className="court-selected-addr">{selectedCourt.address}</div>
                </div>
                <button type="button" className="court-selected-clear" onClick={clearCourt}>×</button>
              </div>
            ) : (
              <div className="court-search-wrap">
                <input
                  type="text"
                  placeholder="Search courts..."
                  value={courtQuery}
                  onChange={e => setCourtQuery(e.target.value)}
                  autoComplete="off"
                />
                {courtResults.length > 0 && (
                  <div className="court-dropdown">
                    {courtResults.map(c => (
                      <button
                        type="button"
                        key={c.id}
                        className="court-option"
                        onClick={() => selectCourt(c)}
                      >
                        <span className="court-option-name">{c.name}</span>
                        <span className="court-option-addr">{c.address}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="location">Location</label>
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
