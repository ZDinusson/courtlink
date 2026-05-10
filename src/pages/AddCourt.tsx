import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { COURT_SPORTS, COURT_SPORT_EMOJI, COURT_SPORT_LABEL, type CourtSport } from '../types'
import './AddCourt.css'

export default function AddCourt() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [sport, setSport] = useState<CourtSport>('basketball')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    setLoading(true)

    // Geocode the address using Nominatim
    let lat: number, lng: number
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
        { headers: { 'User-Agent': 'CourtLink App' } }
      )
      const results = await res.json()
      if (!results.length) {
        setError("Couldn't find that address. Try being more specific (include city and state).")
        setLoading(false)
        return
      }
      lat = parseFloat(results[0].lat)
      lng = parseFloat(results[0].lon)
    } catch {
      setError('Address lookup failed. Check your connection and try again.')
      setLoading(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('courts')
      .insert({
        name: name.trim(),
        sport,
        address: address.trim(),
        lat,
        lng,
        description: description.trim() || null,
        added_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    navigate(`/courts/${data.id}`)
  }

  return (
    <div className="addcourt-page">
      <div className="container">
        <div className="addcourt-header">
          <button onClick={() => navigate('/courts')} className="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <h1 className="addcourt-title">Add a Court</h1>
        </div>

        <form onSubmit={handleSubmit} className="addcourt-form card">
          <div className="field">
            <label htmlFor="court-name">Court / Facility Name</label>
            <input
              id="court-name"
              type="text"
              placeholder="e.g. Venice Beach Courts"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          <div className="field">
            <label htmlFor="court-sport">Sport</label>
            <select
              id="court-sport"
              value={sport}
              onChange={e => setSport(e.target.value as CourtSport)}
              className="sport-select"
            >
              {COURT_SPORTS.map(s => (
                <option key={s} value={s}>{COURT_SPORT_EMOJI[s]} {COURT_SPORT_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="court-address">Address</label>
            <input
              id="court-address"
              type="text"
              placeholder="e.g. 1800 Ocean Front Walk, Venice, CA 90291"
              value={address}
              onChange={e => setAddress(e.target.value)}
              required
              maxLength={200}
            />
            <span className="field-hint">Include city and state for best results.</span>
          </div>

          <div className="field">
            <label htmlFor="court-description">Notes (optional)</label>
            <textarea
              id="court-description"
              placeholder="e.g. Full court on the north end, open 6am–10pm"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={400}
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className="addcourt-actions">
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/courts')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Add Court'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
