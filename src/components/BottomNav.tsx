import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './BottomNav.css'

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const p = location.pathname

  useEffect(() => {
    if (!user) return
    fetchUnread()
    const channel = supabase
      .channel(`bottom-nav-dm-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'direct_messages',
        filter: `recipient_id=eq.${user.id}`,
      }, () => fetchUnread())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function fetchUnread() {
    if (!user) return
    const { count } = await supabase
      .from('direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false)
    setUnread(count ?? 0)
  }

  const tabs = [
    {
      to: '/',
      label: 'Games',
      active: p === '/',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      to: '/courts',
      label: 'Courts',
      active: p.startsWith('/courts'),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      ),
    },
    {
      to: '/players',
      label: 'Players',
      active: p === '/players',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      to: user ? '/messages' : '/auth',
      label: 'Messages',
      active: p.startsWith('/messages'),
      badge: unread > 0 ? (unread > 9 ? '9+' : unread) : null,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      to: user ? '/profile' : '/auth',
      label: 'Profile',
      active: p === '/profile',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ]

  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <Link
          key={tab.to + tab.label}
          to={tab.to}
          className={`bottom-tab ${tab.active ? 'active' : ''}`}
        >
          <div className="bottom-tab-icon">
            {tab.icon}
            {'badge' in tab && tab.badge && (
              <span className="bottom-tab-badge">{tab.badge}</span>
            )}
          </div>
          <span className="bottom-tab-label">{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
