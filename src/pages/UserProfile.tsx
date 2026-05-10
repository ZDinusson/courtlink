import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './UserProfile.css'

interface Profile {
  id: string
  username: string
  created_at: string
}

interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
}

type FriendStatus = 'none' | 'i_sent' | 'they_sent' | 'friends'

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [friendship, setFriendship] = useState<Friendship | null>(null)
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none')
  const [friends, setFriends] = useState<Profile[]>([])
  const [friendsOpen, setFriendsOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [playerRating, setPlayerRating] = useState<{ avg: number; count: number } | null>(null)
  const [hostRating, setHostRating] = useState<{ avg: number; count: number } | null>(null)
  const [attendance, setAttendance] = useState<{ showed: number; noShow: number }>({ showed: 0, noShow: 0 })

  useEffect(() => {
    if (!id) return
    if (user && id === user.id) { navigate('/profile', { replace: true }); return }
    fetchAll()
  }, [id, user])

  async function fetchAll() {
    if (!id) return
    setLoading(true)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, created_at')
      .eq('id', id)
      .single()

    if (!profileData) { navigate('/'); return }
    setProfile(profileData)

    const { data: ratingsData } = await supabase
      .from('ratings')
      .select('attitude_rating, host_rating, attendance')
      .eq('ratee_id', id)

    const attitudes = (ratingsData ?? []).map(r => r.attitude_rating).filter(Boolean) as number[]
    const hosts = (ratingsData ?? []).map(r => r.host_rating).filter(Boolean) as number[]
    const showed = (ratingsData ?? []).filter(r => r.attendance === 'showed_up').length
    const noShow = (ratingsData ?? []).filter(r => r.attendance === 'no_show').length
    if (attitudes.length > 0) setPlayerRating({ avg: attitudes.reduce((a, b) => a + b, 0) / attitudes.length, count: attitudes.length })
    if (hosts.length > 0) setHostRating({ avg: hosts.reduce((a, b) => a + b, 0) / hosts.length, count: hosts.length })
    setAttendance({ showed, noShow })

    await fetchFriendship()
    await fetchFriends()
    setLoading(false)
  }

  async function fetchFriendship() {
    if (!user || !id) return
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`)
      .maybeSingle()

    setFriendship(data)
    if (!data) {
      setFriendStatus('none')
    } else if (data.status === 'accepted') {
      setFriendStatus('friends')
    } else if (data.requester_id === user.id) {
      setFriendStatus('i_sent')
    } else {
      setFriendStatus('they_sent')
    }
  }

  async function fetchFriends() {
    if (!id) return
    const { data: fships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${id},addressee_id.eq.${id}`)
      .eq('status', 'accepted')

    if (!fships || fships.length === 0) { setFriends([]); return }

    const friendIds = fships.map(f => f.requester_id === id ? f.addressee_id : f.requester_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, created_at')
      .in('id', friendIds)

    setFriends(profiles ?? [])
  }

  async function sendRequest() {
    if (!user || !id) return
    setActionLoading(true)
    const { data } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: id })
      .select()
      .single()
    setFriendship(data)
    setFriendStatus('i_sent')
    await supabase.from('notifications').insert({ user_id: id, type: 'friend_request', from_user_id: user.id })
    setActionLoading(false)
  }

  async function cancelRequest() {
    if (!friendship) return
    setActionLoading(true)
    await supabase.from('friendships').delete().eq('id', friendship.id)
    setFriendship(null)
    setFriendStatus('none')
    setActionLoading(false)
  }

  async function acceptRequest() {
    if (!friendship || !user) return
    setActionLoading(true)
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendship.id)
    setFriendship({ ...friendship, status: 'accepted' })
    setFriendStatus('friends')
    await fetchFriends()
    await supabase.from('notifications').insert({ user_id: friendship.requester_id, type: 'friend_accepted', from_user_id: user.id })
    setActionLoading(false)
  }

  async function declineRequest() {
    if (!friendship) return
    setActionLoading(true)
    await supabase.from('friendships').delete().eq('id', friendship.id)
    setFriendship(null)
    setFriendStatus('none')
    setActionLoading(false)
  }

  async function unfriend() {
    if (!friendship) return
    if (!confirm(`Remove ${profile?.username} as a friend?`)) return
    setActionLoading(true)
    await supabase.from('friendships').delete().eq('id', friendship.id)
    setFriendship(null)
    setFriendStatus('none')
    await fetchFriends()
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <span className="spinner" style={{ borderTopColor: 'var(--orange)', width: 28, height: 28 }} />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="userprofile-page">
      <div className="container">
        <button onClick={() => navigate(-1)} className="back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        <div className="userprofile-header card">
          <div className="userprofile-avatar">
            {profile.username[0].toUpperCase()}
          </div>
          <div className="userprofile-info">
            <h1 className="userprofile-username">{profile.username}</h1>
            <p className="userprofile-since">
              Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>

          {user && (
            <div className="userprofile-actions">
              {friendStatus === 'none' && (
                <button className="btn btn-primary btn-sm" onClick={sendRequest} disabled={actionLoading}>
                  Add Friend
                </button>
              )}
              {friendStatus === 'i_sent' && (
                <button className="btn btn-ghost btn-sm" onClick={cancelRequest} disabled={actionLoading}>
                  Request Sent
                </button>
              )}
              {friendStatus === 'they_sent' && (
                <div className="friend-respond">
                  <button className="btn btn-primary btn-sm" onClick={acceptRequest} disabled={actionLoading}>
                    Accept
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={declineRequest} disabled={actionLoading}>
                    Decline
                  </button>
                </div>
              )}
              {friendStatus === 'friends' && (
                <>
                  <Link to={`/messages/${id}`} className="btn btn-primary btn-sm">
                    Message
                  </Link>
                  <button className="btn btn-ghost btn-sm friend-btn-active" onClick={unfriend} disabled={actionLoading}>
                    ✓ Friends
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {(playerRating || hostRating || attendance.showed > 0 || attendance.noShow > 0) && (
          <div className="reputation-card card">
            <div className="reputation-title">Reputation</div>
            <div className="rep-rows">
              {playerRating && (
                <div className="rep-row">
                  <div className="rep-row-label">Player Rating</div>
                  <div className="rep-row-right">
                    <div className="rep-stars">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} className={`rep-star ${n <= Math.round(playerRating.avg) ? 'filled' : ''}`}>★</span>
                      ))}
                    </div>
                    <span className="rep-avg">{playerRating.avg.toFixed(1)}</span>
                    <span className="rep-count">({playerRating.count})</span>
                  </div>
                </div>
              )}
              {hostRating && (
                <div className="rep-row">
                  <div className="rep-row-label">Host Rating</div>
                  <div className="rep-row-right">
                    <div className="rep-stars">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} className={`rep-star ${n <= Math.round(hostRating.avg) ? 'filled' : ''}`}>★</span>
                      ))}
                    </div>
                    <span className="rep-avg">{hostRating.avg.toFixed(1)}</span>
                    <span className="rep-count">({hostRating.count})</span>
                  </div>
                </div>
              )}
              {(attendance.showed > 0 || attendance.noShow > 0) && (
                <div className="rep-row">
                  <div className="rep-row-label">Attendance</div>
                  <div className="rep-row-right">
                    {attendance.showed > 0 && <span className="att-badge att-showed">✅ Showed Up ×{attendance.showed}</span>}
                    {attendance.noShow > 0 && <span className="att-badge att-noshow">❌ No-Show ×{attendance.noShow}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          className="friends-toggle card"
          onClick={() => setFriendsOpen(o => !o)}
        >
          <span className="friends-toggle-label">
            Friends
            <span className="friends-count">{friends.length}</span>
          </span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            style={{ transform: friendsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {friendsOpen && (
          <div className="friends-list card">
            {friends.length === 0 ? (
              <p className="friends-empty">{profile.username} hasn't added any friends yet.</p>
            ) : (
              friends.map(f => (
                <Link key={f.id} to={`/users/${f.id}`} className="friend-row">
                  <div className="friend-avatar">{f.username[0].toUpperCase()}</div>
                  <span className="friend-name">{f.username}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-dim)' }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
