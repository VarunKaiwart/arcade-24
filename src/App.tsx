import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LoadingState } from './components/common/StateViews.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { LeaderboardPage } from './pages/LeaderboardPage.tsx';
import { LobbyPage } from './pages/LobbyPage.tsx';
import { MatchPage } from './pages/MatchPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { AuthProvider, useAuth } from './providers/AuthProvider.tsx';
import { SocketProvider, useSocket } from './providers/SocketProvider.tsx';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <LoadingState label="Checking session..." />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <LoadingState label="Checking session..." />
      </div>
    );
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/**
 * Automatically navigates both players into /match/:matchId whenever the server emits match:ready
 * (from private room join, random matchmaking pair, or accepted rematch).
 */
function MatchAutoNavigator() {
  const { socket } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;
    const onMatchReady = (payload: { matchId?: string }) => {
      if (payload.matchId) {
        navigate(`/match/${payload.matchId}`);
      }
    };
    socket.on('match:ready', onMatchReady);
    return () => {
      socket.off('match:ready', onMatchReady);
    };
  }, [socket, navigate]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <MatchAutoNavigator />
          <AppLayout>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route
                path="/login"
                element={
                  <GuestOnly>
                    <LoginPage />
                  </GuestOnly>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestOnly>
                    <RegisterPage />
                  </GuestOnly>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <DashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/play"
                element={
                  <RequireAuth>
                    <LobbyPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/match/:matchId"
                element={
                  <RequireAuth>
                    <MatchPage />
                  </RequireAuth>
                }
              />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route
                path="/history"
                element={
                  <RequireAuth>
                    <HistoryPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <ProfilePage />
                  </RequireAuth>
                }
              />
              <Route path="/profile/:username" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
