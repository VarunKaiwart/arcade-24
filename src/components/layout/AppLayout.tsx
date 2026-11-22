import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider.tsx';
import { useSocket } from '../../providers/SocketProvider.tsx';
import { Avatar } from '../common/Avatar.tsx';

const AUTH_NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/play', label: 'Play' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/history', label: 'History' },
  { to: '/profile', label: 'Profile' },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, stats, logout } = useAuth();
  const { activeMatchId, waitingRoom, queuedGame, status, notice, clearNotice } = useSocket();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const onMatchRoute = location.pathname.startsWith('/match/');

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080B14] text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080B14]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          {/* Zone 1: Single-line brand wordmark */}
          <Link
            to={user ? '/dashboard' : '/'}
            className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            DuelZone
          </Link>

          {/* Zone 2: 4-5 single-line navigation links */}
          {user ? (
            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-6 text-sm font-medium"
            >
              {AUTH_NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `py-1 transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'text-white border-b-2 border-indigo-500'
                        : 'text-slate-400 hover:text-slate-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          ) : (
            <nav
              aria-label="Public navigation"
              className="hidden md:flex items-center gap-6 text-sm font-medium"
            >
              <a
                href="/#games"
                className="text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Games
              </a>
              <Link
                to="/leaderboard"
                className="text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Leaderboard
              </Link>
              <Link
                to="/login"
                className="text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </Link>
            </nav>
          )}

          {/* Zone 3: Single primary action / compact signed-in player control */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="hidden sm:flex items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-white/5"
                >
                  <Avatar avatarId={user.avatar} username={user.username} size="xs" />
                  <div className="leading-tight">
                    <div className="max-w-[120px] truncate text-sm font-medium text-slate-100">
                      {user.username}
                    </div>
                    <div className="font-mono text-xs text-slate-400 tabular-nums">
                      Lv.{stats?.level ?? 1} · {(stats?.totalXp ?? 0).toLocaleString()} XP
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Sign out"
                  title="Sign out"
                  className="hidden md:inline-flex items-center justify-center rounded-lg border border-white/10 p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  aria-label="Toggle navigation menu"
                  aria-expanded={mobileMenuOpen}
                  className="inline-flex md:hidden items-center justify-center rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </>
            ) : (
              <Link
                to="/register"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 whitespace-nowrap shrink-0"
              >
                Create Account
              </Link>
            )}
          </div>
        </div>

        {/* Mobile navigation drawer */}
        {user && mobileMenuOpen && (
          <div className="border-t border-white/10 bg-[#101524] px-4 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {AUTH_NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-indigo-600/20 text-white' : 'text-slate-300 hover:bg-white/5'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-rose-300 hover:bg-rose-500/10"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Active match / queue / reconnection recovery banner */}
      {user && (notice || (activeMatchId && !onMatchRoute) || status === 'reconnecting') && (
        <div className="border-b border-white/10 bg-[#101524]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6">
            {status === 'reconnecting' ? (
              <span className="text-amber-300">
                Connection interrupted — attempting to reconnect to DuelZone servers...
              </span>
            ) : activeMatchId && !onMatchRoute ? (
              <div className="flex w-full items-center justify-between gap-4">
                <span className="text-slate-200">You have a live match in progress.</span>
                <Link
                  to={`/match/${activeMatchId}`}
                  className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 whitespace-nowrap shrink-0"
                >
                  Rejoin Match
                </Link>
              </div>
            ) : notice ? (
              <div className="flex w-full items-center justify-between gap-4">
                <span className="text-slate-200">{notice}</span>
                <button
                  type="button"
                  onClick={clearNotice}
                  className="text-xs font-medium text-slate-400 hover:text-slate-100 whitespace-nowrap shrink-0"
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Waiting room or active queue quick return banner if away from /play */}
      {user && !activeMatchId && (waitingRoom || queuedGame) && !location.pathname.startsWith('/play') && (
        <div className="border-b border-indigo-500/20 bg-indigo-950/30">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 text-sm sm:px-6">
            <span className="text-indigo-200">
              {waitingRoom
                ? `Private room ${waitingRoom.code} is waiting for an opponent.`
                : `Searching for a ${queuedGame} opponent in matchmaking...`}
            </span>
            <Link
              to="/play"
              className="text-xs font-semibold text-indigo-300 hover:text-white whitespace-nowrap shrink-0"
            >
              Return to Lobby
            </Link>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10 bg-[#080B14] py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <span>DuelZone · Real-Time 1v1 Multiplayer Arena</span>
          <div className="flex items-center gap-4">
            <Link to="/leaderboard" className="hover:text-slate-300 transition-colors">
              Leaderboard
            </Link>
            {user ? (
              <Link to="/play" className="hover:text-slate-300 transition-colors">
                Play Lobby
              </Link>
            ) : (
              <Link to="/login" className="hover:text-slate-300 transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
