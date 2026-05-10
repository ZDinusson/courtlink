import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import AuthPage from './pages/AuthPage'
import CreateGame from './pages/CreateGame'
import GameDetail from './pages/GameDetail'
import Profile from './pages/Profile'

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
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={user ? <Navigate to="/" /> : <AuthPage />} />
          <Route path="/games/new" element={user ? <CreateGame /> : <Navigate to="/auth" />} />
          <Route path="/games/:id" element={<GameDetail />} />
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/auth" />} />
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
