import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import AuthPage from './pages/AuthPage'
import CreateGame from './pages/CreateGame'
import GameDetail from './pages/GameDetail'
import RateGame from './pages/RateGame'
import Profile from './pages/Profile'
import Courts from './pages/Courts'
import AddCourt from './pages/AddCourt'
import CourtDetail from './pages/CourtDetail'
import UserProfile from './pages/UserProfile'
import Landing from './pages/Landing'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderTopColor: 'var(--orange)' }} />
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <main style={{ flex: 1, paddingBottom: 32 }}>
        <Routes>
          <Route path="/" element={user ? <Home /> : <Landing />} />
          <Route path="/auth" element={user ? <Navigate to="/" /> : <AuthPage />} />
          <Route path="/games/new" element={user ? <CreateGame /> : <Navigate to="/auth" />} />
          <Route path="/games/:id" element={<GameDetail />} />
          <Route path="/games/:id/rate" element={user ? <RateGame /> : <Navigate to="/auth" />} />
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/auth" />} />
          <Route path="/courts" element={<Courts />} />
          <Route path="/courts/new" element={user ? <AddCourt /> : <Navigate to="/auth" />} />
          <Route path="/courts/:id" element={<CourtDetail />} />
          <Route path="/users/:id" element={<UserProfile />} />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
