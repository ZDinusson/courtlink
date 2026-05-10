import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import GameCard from '../components/GameCard'
import {
  COURT_SPORT_EMOJI, COURT_SPORT_LABEL, COURT_SPORT_COLOR,
  COURT_TAGS, COURT_TAG_LABEL, COURT_TAG_EMOJI,
  type Court, type CourtTag, type Game,
} from '../types'
import './CourtDetail.css'

function courtIcon(sport: string, color: string) {
  const emoji = COURT_SPORT_EMOJI[sport as keyof typeof COURT_SPORT_EMOJI] ?? '📍'
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

export default function CourtDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [court, setCourt] = useState<Court | null>(null)
  const [loading, setLoading] = useState(true)
  const [myTags, setMyTags] = useState<Set<CourtTag>>(new Set())
  const [tagCounts, setTagCounts] = useState<Partial<Record<CourtTag, number>>>({})
  const [toggling, setToggling] = useState<CourtTag | null>(null)
  const [courtGames, setCourtGames] = useState<Game[]>([])
  const [reviews, setReviews] = useState<{ id: string; user_id: string; rating: number; review: string | null; created_at: string; profiles?: { username: string } }[]>([])
  const [myRating, setMyRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [myReviewText, setMyReviewText] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null
  const myExistingReview = reviews.find(r => r.user_id === user?.id)

  useEffect(() => { fetchCourt(); fetchCourtGames(); fetchReviews() }, [id])

  async function fetchCourt() {
    if (!id) return
    const { data } = await supabase
      .from('courts')
      .select('*, profiles (id, username)')
      .eq('id', id)
      .single()

    if (!data) { navigate('/courts'); return }
    setCourt(data)

    // Fetch tag counts
    const { data: tags } = await supabase
      .from('court_tags')
      .select('tag')
      .eq('court_id', id)

    if (tags) {
      const counts: Partial<Record<CourtTag, number>> = {}
      tags.forEach(({ tag }) => {
        counts[tag as CourtTag] = (counts[tag as CourtTag] ?? 0) + 1
      })
      setTagCounts(counts)
    }

    // Fetch user's own tags
    if (user) {
      const { data: mine } = await supabase
        .from('court_tags')
        .select('tag')
        .eq('court_id', id)
        .eq('user_id', user.id)

      if (mine) setMyTags(new Set(mine.map(r => r.tag as CourtTag)))
    }

    setLoading(false)
  }

  async function fetchCourtGames() {
    if (!id) return
    const { data } = await supabase
      .from('games')
      .select('*, profiles (id, username), game_players (id)')
      .eq('court_id', id)
      .neq('status', 'cancelled')
      .gte('date_time', new Date().toISOString())
      .order('date_time', { ascending: true })
      .limit(6)

    if (data) {
      setCourtGames(data.map((g: Game & { game_players: { id: string }[] }) => ({
        ...g,
        player_count: g.game_players?.length ?? 0,
      })))
    }
  }

  async function fetchReviews() {
    if (!id) return
    const { data } = await supabase
      .from('court_reviews')
      .select('id, user_id, rating, review, created_at, profiles (username)')
      .eq('court_id', id)
      .order('created_at', { ascending: false })
    const list = (data ?? []) as unknown as typeof reviews
    setReviews(list)
    if (user) {
      const mine = list.find(r => r.user_id === user.id)
      if (mine) { setMyRating(mine.rating); setMyReviewText(mine.review ?? '') }
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !id || !myRating) return
    setReviewLoading(true)
    setReviewError('')
    const { error } = await supabase.from('court_reviews').upsert(
      { court_id: id, user_id: user.id, rating: myRating, review: myReviewText.trim() || null },
      { onConflict: 'court_id,user_id' }
    )
    if (error) setReviewError(error.message)
    else await fetchReviews()
    setReviewLoading(false)
  }

  async function deleteReview() {
    if (!user || !id) return
    setReviewLoading(true)
    await supabase.from('court_reviews').delete().eq('court_id', id).eq('user_id', user.id)
    setMyRating(0)
    setMyReviewText('')
    await fetchReviews()
    setReviewLoading(false)
  }

  async function toggleTag(tag: CourtTag) {
    if (!user || !id || toggling) return
    setToggling(tag)

    const isActive = myTags.has(tag)

    if (isActive) {
      await supabase.from('court_tags').delete()
        .eq('court_id', id).eq('user_id', user.id).eq('tag', tag)

      setMyTags(prev => { const s = new Set(prev); s.delete(tag); return s })
      setTagCounts(prev => ({ ...prev, [tag]: Math.max(0, (prev[tag] ?? 0) - 1) }))
    } else {
      await supabase.from('court_tags').insert({ court_id: id, user_id: user.id, tag })

      setMyTags(prev => new Set(prev).add(tag))
      setTagCounts(prev => ({ ...prev, [tag]: (prev[tag] ?? 0) + 1 }))
    }

    setToggling(null)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <span className="spinner" style={{ borderTopColor: 'var(--orange)', width: 24, height: 24 }} />
      </div>
    )
  }

  if (!court) return null

  const color = COURT_SPORT_COLOR[court.sport]

  return (
    <div className="courtdetail-page">
      <div className="container">
        <div className="courtdetail-header">
          <button onClick={() => navigate('/courts')} className="courtdetail-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            All Courts
          </button>
        </div>

        <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <div className="courtdetail-sport-badge" style={{ background: color }}>
            {COURT_SPORT_EMOJI[court.sport]} {COURT_SPORT_LABEL[court.sport]}
          </div>
          <h1 className="courtdetail-name">{court.name}</h1>
          {avgRating !== null && (
            <div className="courtdetail-avg-rating">
              {'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}
              <span className="courtdetail-avg-num">{avgRating.toFixed(1)}</span>
              <span className="courtdetail-avg-count">({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
            </div>
          )}
          <div className="courtdetail-addr">{court.address}</div>
          {court.profiles && (
            <div className="courtdetail-addedby">Added by @{court.profiles.username}</div>
          )}
        </div>

        <div className="courtdetail-map-wrap">
          <MapContainer
            center={[court.lat, court.lng]}
            zoom={15}
            className="courtdetail-map"
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <Marker position={[court.lat, court.lng]} icon={courtIcon(court.sport, color)} />
          </MapContainer>
        </div>

        {court.description && (
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <p className="courtdetail-desc">{court.description}</p>
          </div>
        )}

        <div className="card" style={{ padding: '24px' }}>
          <div className="courtdetail-tags-title">What's it like here?</div>
          {user
            ? <p className="courtdetail-tags-hint">Tap tags to share what you know about this spot.</p>
            : <p className="courtdetail-tags-hint">Sign in to add tags.</p>
          }

          <div className="courtdetail-tags-grid">
            {COURT_TAGS.map(tag => {
              const count = tagCounts[tag] ?? 0
              const active = myTags.has(tag)
              return (
                <button
                  key={tag}
                  className={`tag-chip ${active ? 'active' : ''} ${!user ? 'readonly' : ''}`}
                  onClick={() => user && toggleTag(tag)}
                  disabled={toggling === tag}
                >
                  {COURT_TAG_EMOJI[tag]} {COURT_TAG_LABEL[tag]}
                  {count > 0 && <span className="tag-chip-count">{count}</span>}
                </button>
              )
            })}
          </div>

          {!user && (
            <p className="courtdetail-signin-note">
              <Link to="/auth">Sign in</Link> to tag this location.
            </p>
          )}
        </div>

        <div className="card courtdetail-reviews-card">
          <div className="courtdetail-reviews-header">
            <div className="courtdetail-tags-title">Ratings & Reviews</div>
            {avgRating !== null && (
              <div className="courtdetail-reviews-avg">
                <span className="courtdetail-reviews-avg-num">{avgRating.toFixed(1)}</span>
                <span className="courtdetail-reviews-stars">
                  {'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}
                </span>
              </div>
            )}
          </div>

          {user ? (
            <form onSubmit={submitReview} className="courtdetail-review-form">
              <div className="review-stars-pick">
                {[1,2,3,4,5].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`review-star ${n <= (hoverRating || myRating) ? 'filled' : ''}`}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setMyRating(n)}
                  >★</button>
                ))}
                {myRating > 0 && <span className="review-star-label">{['','Poor','Fair','Good','Great','Excellent'][myRating]}</span>}
              </div>
              <textarea
                className="review-textarea"
                placeholder="Share your experience (optional)"
                value={myReviewText}
                onChange={e => setMyReviewText(e.target.value)}
                maxLength={300}
                rows={3}
              />
              {reviewError && <p className="error-msg">{reviewError}</p>}
              <div className="review-form-actions">
                {myExistingReview && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={deleteReview} disabled={reviewLoading}>
                    Delete
                  </button>
                )}
                <button type="submit" className="btn btn-primary btn-sm" disabled={reviewLoading || !myRating}>
                  {reviewLoading ? <span className="spinner" /> : myExistingReview ? 'Update Review' : 'Post Review'}
                </button>
              </div>
            </form>
          ) : (
            <p className="courtdetail-signin-note">
              <Link to="/auth">Sign in</Link> to leave a review.
            </p>
          )}

          {reviews.length > 0 && (
            <div className="courtdetail-reviews-list">
              {reviews.map(r => (
                <div key={r.id} className="review-item">
                  <div className="review-item-top">
                    <Link to={`/users/${r.user_id}`} className="review-item-user">@{r.profiles?.username ?? 'user'}</Link>
                    <span className="review-item-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    <span className="review-item-date">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  {r.review && <p className="review-item-text">{r.review}</p>}
                </div>
              ))}
            </div>
          )}

          {reviews.length === 0 && !user && (
            <p className="courtdetail-tags-hint" style={{ marginTop: 8 }}>No reviews yet. Be the first!</p>
          )}
        </div>

        {courtGames.length > 0 && (
          <div className="courtdetail-games-section">
            <div className="courtdetail-games-header">
              <div className="courtdetail-games-title">Upcoming Games Here</div>
              <Link to={`/?court=${id}`} className="courtdetail-games-link" onClick={e => { e.preventDefault(); navigate('/') }}>
                See all
              </Link>
            </div>
            <div className="game-grid">
              {courtGames.map(g => <GameCard key={g.id} game={g} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
