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

const ST_LOUIS: [number, number] = [38.6270, -90.1994]
const NEAR_MILES = 10

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

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

function userDotIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:#3B82F6;border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(59,130,246,0.3),0 2px 8px rgba(0,0,0,0.2);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

interface CourtCardProps {
  court: Court
  distance: number | null
}

function CourtCard({ court, distance }: CourtCardProps) {
  const distLabel =
    distance !== null
      ? distance < 0.1
        ? '< 0.1 mi away'
        : `${distance.toFixed(1)} mi away`
      : null

  return (
    <Link to={`/courts/${court.id}`} className="court-card card">
      <div className="court-card-sport" style={{ background: COURT_SPORT_COLOR[court.sport] }}>
        {COURT_SPORT_EMOJI[court.sport]}
      </div>
      <div className="court-card-info">
        <div className="court-card-name">{court.name}</div>
        <div className="court-card-addr">{court.address}</div>
        <div className="court-card-meta">
          {COURT_SPORT_LABEL[court.sport]}
          {distLabel && <span className="court-card-dist">{distLabel}</span>}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </Link>
  )
}

export default function Courts() {
  const { user } = useAuth()
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)
  const [sportFilter, setSportFilter] = useState<CourtSport | 'all'>('all')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => { fetchCourts() }, [sportFilter])

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 8000 }
    )
  }, [])

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

  const courtsWithDistance = courts.map(court => ({
    court,
    distance: userLocation
      ? haversineDistance(userLocation.lat, userLocation.lng, court.lat, court.lng)
      : null,
  }))

  const nearCourts = userLocation
    ? courtsWithDistance
        .filter(c => c.distance !== null && c.distance <= NEAR_MILES)
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    : []

  const farCourts = userLocation
    ? courtsWithDistance.filter(c => c.distance === null || c.distance > NEAR_MILES)
    : courtsWithDistance

  return (
    <div className="courts-page">
      <div className="container">
        <div className="courts-hero">
          <div>
            <h1 className="courts-title">Courts & Facilities</h1>
            <p className="courts-subtitle">
              {userLocation ? 'Showing courts near your location' : 'Find places to play near you'}
            </p>
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
            center={ST_LOUIS}
            zoom={12}
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
            {userLocation && (
              <Marker position={[userLocation.lat, userLocation.lng]} icon={userDotIcon()}>
                <Popup>
                  <div className="map-popup">
                    <div className="map-popup-name">You are here</div>
                  </div>
                </Popup>
              </Marker>
            )}
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
          <>
            {nearCourts.length > 0 && (
              <>
                <div className="courts-section-header">
                  <span className="courts-section-title">📍 Near You</span>
                  <span className="courts-section-sub">Within 10 miles</span>
                </div>
                <div className="courts-list courts-list--near">
                  {nearCourts.map(({ court, distance }) => (
                    <CourtCard key={court.id} court={court} distance={distance} />
                  ))}
                </div>
                {farCourts.length > 0 && (
                  <div className="courts-section-header courts-section-header--all">
                    <span className="courts-section-title">All Courts</span>
                  </div>
                )}
              </>
            )}
            <div className="courts-list">
              {farCourts.map(({ court, distance }) => (
                <CourtCard key={court.id} court={court} distance={distance} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
