import type {
  ApiEnvelope,
  AuthenticatedUser,
  ChatMessageDto,
  GameType,
  LeaderboardEntry,
  MatchHistoryItem,
  MatchSnapshot,
  PlayerStats,
  PublicUser,
  RoomInfo,
} from '../../shared/types.ts';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

// Held strictly in JS memory — never persisted to localStorage or sessionStorage
let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Requested-With', 'DuelZone');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new ApiClientError(
      response.status,
      payload?.error?.code || 'REQUEST_FAILED',
      payload?.error?.message || `Request failed (${response.status})`
    );
  }

  return payload.data as T;
}

export const api = {
  health: () =>
    request<{
      status: string;
      database: string;
      onlinePlayers: number;
      queues: Record<GameType, number>;
      timestamp: string;
    }>('/health'),

  register: (body: { username: string; email: string; password: string; avatar?: string }) =>
    request<{ user: AuthenticatedUser; stats: PlayerStats; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { identifier: string; password: string }) =>
    request<{
      user: AuthenticatedUser;
      stats: PlayerStats;
      token: string;
      activeMatchId: string | null;
      waitingRoom: RoomInfo | null;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () =>
    request<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  me: () =>
    request<{
      user: AuthenticatedUser;
      stats: PlayerStats;
      token: string;
      activeMatchId: string | null;
      waitingRoom: RoomInfo | null;
      queuedGame: GameType | null;
    }>('/auth/me'),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ changed: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateProfile: (body: { username?: string; avatar?: string; bio?: string }) =>
    request<{ user: AuthenticatedUser; stats: PlayerStats }>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getPublicProfile: (username: string) =>
    request<{ profile: PublicUser; stats: PlayerStats; recentMatches: MatchHistoryItem[] }>(
      `/users/${encodeURIComponent(username)}`
    ),

  getMyStats: () => request<{ stats: PlayerStats }>('/stats/me'),

  getLeaderboard: (params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    return request<{
      entries: LeaderboardEntry[];
      currentUserEntry: LeaderboardEntry | null;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/leaderboard?${qs.toString()}`);
  },

  getMatchHistory: (params: {
    page?: number;
    limit?: number;
    gameType?: string;
    outcome?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.gameType) qs.set('gameType', params.gameType);
    if (params.outcome) qs.set('outcome', params.outcome);
    return request<{
      items: MatchHistoryItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/matches/history?${qs.toString()}`);
  },

  getMatch: (matchId: string) =>
    request<{ match: MatchSnapshot; messages: ChatMessageDto[] }>(
      `/matches/${encodeURIComponent(matchId)}`
    ),

  getActiveMatch: () => request<{ match: MatchSnapshot | null }>('/matches/active'),

  createRoom: (gameType: GameType) =>
    request<{ room: RoomInfo }>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ gameType }),
    }),

  joinRoom: (code: string) =>
    request<{ matchId: string; room: RoomInfo }>('/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  cancelRoom: (code: string) =>
    request<{ room: RoomInfo }>(`/rooms/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    }),
};
