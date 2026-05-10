import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  COURT_SPORTS, COURT_SPORT_EMOJI, COURT_SPORT_LABEL, COURT_SPORT_COLOR,
  type Court, type CourtSport,
} from '../types'
import './Courts.css'

function courtIcon(sport: CourtSport) {
  const color = COURT_SPORT_COLOR[sport]
  const emoji = COURT_SPORT_EMOJI[sport]
  return L.divIcon({
    className: '',
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
      font-size:16px;
    ">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

export default function Courts() {
  const { user } = useAuth()
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)
  const [sportFilter, setSportFilter] = useState<CourtSport | 'all'>('all')

  useEffect(() => { fetchCourts() }, [sportFilter])

  async function fetchCourts() {
    setLoading(true)
    let query = supabase
      .from('courts')
      .select('*, profiles (id, username)')
      .order('created_at', { ascending: false })

    if (sportFilter !== 'all') query = query.eq('sport', sportFilter)

    const { data } = await query
    setCourts(data ?? [])
    setLoading(false)
  }

  return (
    <div className="courts-page">
      <div className="container">
        <div className="courts-hero">
          <div>
            <h1 className="courts-title">Courts & Facilities</h1>
            <p className="courts-subtitle">Find places to play near you</p>
          </div>
          {user && (
            <Link to="/courts/new" className="btn btn-primary">
              + Add a Court
            </Link>
          )}
        </div>

        <div className="courts-sport-filters">
          <button
            className={`filter-btn ${sportFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSportFilter('all')}
          >
            All
          </button>
          {COURT_SPORTS.map(s => (
            <button
              key={s}
              className={`filter-btn ${sportFilter === s ? 'active' : ''}`}
              onClick={() => setSportFilter(s)}
            >
              {COURT_SPORT_EMOJI[s]} {COURT_SPORT_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="courts-map-wrap">
          <MapContainer
            center={[39.5, -98.35]}
            zoom={4}
            className="courts-map"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />
            {courts.map(court => (
              <Marker key={court.id} position={[court.lat, court.lng]} icon={courtIcon(court.sport)}>
                <Popup>
                  <div className="map-popup">
                    <div className="map-popup-sport">{COURT_SPORT_EMOJI[court.sport]} {COURT_SPORT_LABEL[court.sport]}</div>
                    <div className="map-popup-name">{court.name}</div>
                    <div className="map-popup-addr">{court.address}</div>
                    <Link to={`/courts/${court.id}`} className="map-popup-link">View details →</Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {loading ? (
          <div className="courts-loading">
            <span className="spinner" style={{ borderTopColor: 'var(--orange)', width: 24, height: 24 }} />
          </div>
        ) : courts.length === 0 ? (
          <div className="courts-empty">
            <p>No courts added yet.</p>
            {user
              ? <Link to="/courts/new" className="btn btn-primary">Be the first to add one</Link>
              : <Link to="/auth" className="btn btn-primary">Sign in to add a court</Link>
            }
          </div>
        ) : (
          <div className="courts-list">
            {courts.map(court => (
              <Link key={court.id} to={`/courts/${court.id}`} className="court-card card">
                <div className="court-card-sport" style={{ background: COURT_SPORT_COLOR[court.sport] }}>
                  {COURT_SPORT_EMOJI[court.sport]}
                </div>
                <div className="court-card-info">
                  <div className="court-card-name">{court.name}</div>
                  <div className="court-card-addr">{court.address}</div>
                  <div className="court-card-meta">{COURT_SPORT_LABEL[court.sport]}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
