import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'
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
import Messages from './pages/Messages'
import DMThread from './pages/DMThread'
import Players from './pages/Players'

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
      <main className="main-content">
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
          <Route path="/messages" element={user ? <Messages /> : <Navigate to="/auth" />} />
          <Route path="/messages/:userId" element={user ? <DMThread /> : <Navigate to="/auth" />} />
          <Route path="/players" element={<Players />} />
        </Routes>
      </main>
      <BottomNav />
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
