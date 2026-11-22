import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { GameType, MatchSnapshot, RoomInfo } from '../../shared/types.ts';
import { soundFx } from '../lib/sound.ts';
import { useAuth } from './AuthProvider.tsx';

export type SocketConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface AckResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface SocketContextValue {
  socket: Socket | null;
  status: SocketConnectionStatus;
  queuedGame: GameType | null;
  waitingRoom: RoomInfo | null;
  activeMatchId: string | null;
  latestReadyMatch: MatchSnapshot | null;
  notice: string | null;
  clearNotice: () => void;
  setActiveMatchId: (id: string | null) => void;
  setWaitingRoom: (room: RoomInfo | null) => void;
  emitWithAck: <T = unknown>(event: string, payload?: unknown) => Promise<T>;
  joinMatchmaking: (gameType: GameType) => Promise<{ status: 'QUEUED' | 'MATCHED'; matchId?: string }>;
  cancelMatchmaking: () => Promise<void>;
  createPrivateRoom: (gameType: GameType) => Promise<RoomInfo>;
  joinPrivateRoom: (code: string) => Promise<{ matchId: string }>;
  cancelPrivateRoom: (roomId?: string, code?: string) => Promise<void>;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const {
    user,
    token,
    initialActiveMatchId,
    initialWaitingRoom,
    initialQueuedGame,
    refreshStats,
  } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<SocketConnectionStatus>('disconnected');
  const [queuedGame, setQueuedGame] = useState<GameType | null>(null);
  const [waitingRoom, setWaitingRoom] = useState<RoomInfo | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [latestReadyMatch, setLatestReadyMatch] = useState<MatchSnapshot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setActiveMatchId(initialActiveMatchId);
    setWaitingRoom(initialWaitingRoom);
    setQueuedGame(initialQueuedGame);
  }, [initialActiveMatchId, initialWaitingRoom, initialQueuedGame]);

  useEffect(() => {
    if (!user || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setStatus('disconnected');
      setQueuedGame(null);
      setWaitingRoom(null);
      setActiveMatchId(null);
      setLatestReadyMatch(null);
      return;
    }

    setStatus('connecting');
    const client = io(window.location.origin, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = client;
    setSocket(client);

    client.on('connect', () => {
      setStatus('connected');
    });

    client.on('disconnect', () => {
      setStatus('reconnecting');
    });

    client.io.on('reconnect_attempt', () => {
      setStatus('reconnecting');
    });

    client.io.on('reconnect', () => {
      setStatus('connected');
    });

    client.on('connect_error', () => {
      setStatus('reconnecting');
    });

    client.on('matchmaking:queued', (payload: { gameType: GameType }) => {
      setQueuedGame(payload.gameType);
    });

    client.on('matchmaking:cancelled', () => {
      setQueuedGame(null);
    });

    client.on('matchmaking:timeout', (payload: { message?: string }) => {
      setQueuedGame(null);
      setNotice(payload.message || 'Matchmaking timed out. Please try again.');
    });

    client.on('room:created', (payload: { room: RoomInfo }) => {
      if (payload.room) setWaitingRoom(payload.room);
    });

    client.on('room:cancelled', () => {
      setWaitingRoom(null);
    });

    client.on('match:ready', (payload: { matchId: string; snapshot?: MatchSnapshot }) => {
      setQueuedGame(null);
      setWaitingRoom(null);
      setActiveMatchId(payload.matchId);
      if (payload.snapshot) {
        setLatestReadyMatch(payload.snapshot);
      }
      soundFx.playMatchFound();
    });

    client.on('match:completed', () => {
      setActiveMatchId(null);
      void refreshStats();
    });

    return () => {
      client.disconnect();
      socketRef.current = null;
      setSocket(null);
      setStatus('disconnected');
    };
  }, [user, token, refreshStats]);

  const emitWithAck = useCallback(<T = unknown>(event: string, payload?: unknown): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const current = socketRef.current;
      if (!current || !current.connected) {
        reject(new Error('Real-time connection is currently offline. Please wait to reconnect.'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Server request timed out. Please try again.'));
      }, 10_000);

      current.emit(event, payload ?? {}, (response: AckResponse<T>) => {
        clearTimeout(timeout);
        if (!response || !response.success) {
          reject(new Error(response?.error?.message || 'Action failed.'));
          return;
        }
        resolve(response.data as T);
      });
    });
  }, []);

  const joinMatchmaking = useCallback(
    async (gameType: GameType) => {
      const data = await emitWithAck<{ status: 'QUEUED' | 'MATCHED'; matchId?: string }>(
        'matchmaking:join',
        { gameType }
      );
      if (data.status === 'QUEUED') {
        setQueuedGame(gameType);
      } else if (data.matchId) {
        setQueuedGame(null);
        setActiveMatchId(data.matchId);
      }
      return data;
    },
    [emitWithAck]
  );

  const cancelMatchmaking = useCallback(async () => {
    await emitWithAck('matchmaking:cancel', { gameType: queuedGame ?? undefined });
    setQueuedGame(null);
  }, [emitWithAck, queuedGame]);

  const createPrivateRoom = useCallback(
    async (gameType: GameType) => {
      const room = await emitWithAck<RoomInfo>('room:create', { gameType });
      setWaitingRoom(room);
      setQueuedGame(null);
      return room;
    },
    [emitWithAck]
  );

  const joinPrivateRoom = useCallback(
    async (code: string) => {
      const data = await emitWithAck<{ matchId: string }>('room:join', {
        code: code.trim().toUpperCase(),
      });
      setWaitingRoom(null);
      setQueuedGame(null);
      setActiveMatchId(data.matchId);
      return data;
    },
    [emitWithAck]
  );

  const cancelPrivateRoom = useCallback(
    async (roomId?: string, code?: string) => {
      await emitWithAck('room:cancel', { roomId, code });
      setWaitingRoom(null);
    },
    [emitWithAck]
  );

  const clearNotice = useCallback(() => setNotice(null), []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        status,
        queuedGame,
        waitingRoom,
        activeMatchId,
        latestReadyMatch,
        notice,
        clearNotice,
        setActiveMatchId,
        setWaitingRoom,
        emitWithAck,
        joinMatchmaking,
        cancelMatchmaking,
        createPrivateRoom,
        joinPrivateRoom,
        cancelPrivateRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return ctx;
}
