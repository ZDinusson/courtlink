import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'
import './Navbar.css'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo">
          <span className="navbar-logo-text">CourtLink</span>
        </Link>

        <nav className="navbar-nav">
          <Link
            to="/"
            className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Games
          </Link>
          <Link
            to="/courts"
            className={`navbar-link ${location.pathname.startsWith('/courts') ? 'active' : ''}`}
          >
            Courts
          </Link>
          {user && (
            <Link
              to="/profile"
              className={`navbar-link ${location.pathname === '/profile' ? 'active' : ''}`}
            >
              Profile
            </Link>
          )}
        </nav>

        <div className="navbar-actions">
          {user ? (
            <>
              <NotificationBell />
              <Link to="/games/new" className="btn btn-primary btn-sm">
                + New Game
              </Link>
              <button onClick={handleSignOut} className="btn btn-ghost btn-sm">
                Sign Out
              </button>
            </>
          ) : (
            <Link to="/auth" className="btn btn-primary btn-sm">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
