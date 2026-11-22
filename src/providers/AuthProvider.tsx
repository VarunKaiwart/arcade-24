import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AuthenticatedUser, GameType, PlayerStats, RoomInfo } from '../../shared/types.ts';
import { api, setAuthToken } from '../lib/api.ts';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  stats: PlayerStats | null;
  token: string | null;
  loading: boolean;
  initialActiveMatchId: string | null;
  initialWaitingRoom: RoomInfo | null;
  initialQueuedGame: GameType | null;
  login: (identifier: string, password: string) => Promise<{ activeMatchId: string | null }>;
  register: (params: { username: string; email: string; password: string; avatar?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshStats: () => Promise<void>;
  setUserAndStats: (user: AuthenticatedUser, stats: PlayerStats | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialActiveMatchId, setInitialActiveMatchId] = useState<string | null>(null);
  const [initialWaitingRoom, setInitialWaitingRoom] = useState<RoomInfo | null>(null);
  const [initialQueuedGame, setInitialQueuedGame] = useState<GameType | null>(null);

  const restoreSession = useCallback(async () => {
    try {
      const data = await api.me();
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      setStats(data.stats);
      setInitialActiveMatchId(data.activeMatchId);
      setInitialWaitingRoom(data.waitingRoom);
      setInitialQueuedGame(data.queuedGame);
    } catch {
      setAuthToken(null);
      setToken(null);
      setUser(null);
      setStats(null);
      setInitialActiveMatchId(null);
      setInitialWaitingRoom(null);
      setInitialQueuedGame(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await api.login({ identifier, password });
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    setStats(data.stats);
    setInitialActiveMatchId(data.activeMatchId);
    setInitialWaitingRoom(data.waitingRoom);
    return { activeMatchId: data.activeMatchId };
  }, []);

  const register = useCallback(
    async (params: { username: string; email: string; password: string; avatar?: string }) => {
      const data = await api.register(params);
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      setStats(data.stats);
      setInitialActiveMatchId(null);
      setInitialWaitingRoom(null);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Clear local session state even if network fails
    }
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setStats(null);
    setInitialActiveMatchId(null);
    setInitialWaitingRoom(null);
    setInitialQueuedGame(null);
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const data = await api.getMyStats();
      setStats(data.stats);
    } catch {
      // Ignore transient stats refresh errors
    }
  }, []);

  const setUserAndStats = useCallback((nextUser: AuthenticatedUser, nextStats: PlayerStats | null) => {
    setUser(nextUser);
    if (nextStats) setStats(nextStats);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        stats,
        token,
        loading,
        initialActiveMatchId,
        initialWaitingRoom,
        initialQueuedGame,
        login,
        register,
        logout,
        refreshStats,
        setUserAndStats,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
