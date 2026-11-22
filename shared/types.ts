export type GameType = 'TICTACTOE' | 'RPS' | 'CONNECT_FOUR';

export type MatchMode = 'PRIVATE' | 'RANDOM';

export type MatchStatus =
  | 'WAITING_FOR_PLAYER'
  | 'READY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ABANDONED'
  | 'EXPIRED';

export type MatchResultType = 'WIN' | 'DRAW' | 'ABANDONED' | 'FORFEIT';

export type ProgressionRank = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface PublicUser {
  id: string;
  username: string;
  avatar: string;
  bio: string;
  createdAt: string;
}

export interface AuthenticatedUser extends PublicUser {
  email: string;
}

export interface PerGameStat {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface PlayerStats {
  userId: string;
  totalXp: number;
  level: number;
  rank: ProgressionRank;
  currentLevelXp: number;
  nextLevelXp: number;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  perGame: {
    TICTACTOE: PerGameStat;
    RPS: PerGameStat;
    CONNECT_FOUR: PerGameStat;
  };
  updatedAt: string;
}

export interface MatchPlayer {
  userId: string;
  slot: 1 | 2;
  username: string;
  avatar: string;
  connected?: boolean;
}

// --- Game Specific States ---

export type TicTacToeMark = 'X' | 'O';

export interface TicTacToeState {
  board: (TicTacToeMark | null)[];
  playerSymbols: Record<string, TicTacToeMark>;
  currentTurnUserId: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  winnerUserId: string | null;
  winningLine: number[] | null;
  isDraw: boolean;
  turnDeadlineAt: string | null;
}

export type RpsChoice = 'ROCK' | 'PAPER' | 'SCISSORS';

export interface RpsRoundRecord {
  roundNumber: number;
  choices: Record<string, RpsChoice | null>;
  winnerUserId: string | null;
  isDraw: boolean;
  reason: 'NORMAL' | 'TIMEOUT';
}

export interface RpsState {
  roundNumber: number;
  targetWins: number;
  scores: Record<string, number>;
  /**
   * Publicly broadcast to clients: booleans showing who has locked in.
   * Actual hidden choices are NEVER exposed while phase === 'WAITING_FOR_CHOICES'.
   */
  submittedBy: Record<string, boolean>;
  /**
   * Populated only during ROUND_REVEAL or COMPLETED, or solely for the current player's own choice.
   */
  revealedChoices: Record<string, RpsChoice | null>;
  /**
   * Private server-only map (stripped before broadcasting during WAITING_FOR_CHOICES).
   */
  _privateSubmissions?: Record<string, RpsChoice | null>;
  lastRound: RpsRoundRecord | null;
  roundHistory: RpsRoundRecord[];
  phase: 'WAITING_FOR_CHOICES' | 'ROUND_REVEAL' | 'COMPLETED';
  deadlineAt: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  winnerUserId: string | null;
  isDraw: boolean;
}

export type ConnectFourColor = 'RED' | 'YELLOW';

export interface ConnectFourState {
  rows: number;
  cols: number;
  board: (ConnectFourColor | null)[][];
  playerColors: Record<string, ConnectFourColor>;
  currentTurnUserId: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  winnerUserId: string | null;
  winningCells: [number, number][] | null;
  lastMove: { row: number; col: number; userId: string } | null;
  isDraw: boolean;
  turnDeadlineAt: string | null;
}

export type GameState = TicTacToeState | RpsState | ConnectFourState;

export type GameAction =
  | { type: 'PLACE_MARK'; index: number }
  | { type: 'SUBMIT_CHOICE'; choice: RpsChoice }
  | { type: 'DROP_TOKEN'; column: number };

export interface XpAwardSummary {
  userId: string;
  amount: number;
  reason: 'WIN' | 'LOSS' | 'DRAW';
  totalXp: number;
  level: number;
  rank: ProgressionRank;
  leveledUp: boolean;
  rankedUp: boolean;
}

export interface MatchSnapshot {
  id: string;
  gameType: GameType;
  mode: MatchMode;
  status: MatchStatus;
  version: number;
  players: MatchPlayer[];
  state: GameState;
  currentTurnUserId: string | null;
  winnerUserId: string | null;
  result: MatchResultType | null;
  xpAwards?: XpAwardSummary[];
  rematchRequestedBy: string[];
  disconnectedPlayers: Record<string, string>; // userId -> gracePeriodEndsAt ISO
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface RoomInfo {
  id: string;
  code: string;
  gameType: GameType;
  hostUserId: string;
  hostUsername: string;
  hostAvatar: string;
  guestUserId: string | null;
  matchId: string | null;
  status: 'WAITING' | 'JOINED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

export interface ChatMessageDto {
  id: string;
  matchId: string;
  senderId: string;
  senderUsername: string;
  senderAvatar: string;
  message: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  position: number;
  userId: string;
  username: string;
  avatar: string;
  totalXp: number;
  level: number;
  rank: ProgressionRank;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number;
  winRate: number;
}

export interface MatchHistoryItem {
  id: string;
  gameType: GameType;
  mode: MatchMode;
  status: MatchStatus;
  result: MatchResultType | null;
  outcomeForUser: 'WIN' | 'LOSS' | 'DRAW' | 'ABANDONED';
  opponent: {
    userId: string;
    username: string;
    avatar: string;
  } | null;
  xpEarned: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const GAME_METADATA: Record<
  GameType,
  {
    id: GameType;
    name: string;
    shortDescription: string;
    rules: string[];
    formatLabel: string;
    avgDuration: string;
    accentColor: string;
  }
> = {
  TICTACTOE: {
    id: 'TICTACTOE',
    name: 'Tic-Tac-Toe',
    shortDescription: 'Classic 3x3 tactical grid duel. Claim three in a row before your rival blocks the lane.',
    rules: [
      'Players take alternating turns placing X and O on a 3×3 board.',
      'First player to align three marks horizontally, vertically, or diagonally wins.',
      'If all nine squares fill with no three-in-a-row, the match ends in a draw.',
      'Each turn has a 30-second shot clock; timing out forfeits the match.',
    ],
    formatLabel: 'Single board · 3×3',
    avgDuration: '1–2 min',
    accentColor: '#6366F1',
  },
  RPS: {
    id: 'RPS',
    name: 'Rock Paper Scissors',
    shortDescription: 'Simultaneous blind-pick mind game. Outread your opponent in a high-tension first-to-3 set.',
    rules: [
      'Both players lock in Rock, Paper, or Scissors simultaneously each round.',
      'Choices stay hidden on the server until both players lock in or the 20s timer expires.',
      'Rock beats Scissors, Scissors beats Paper, Paper beats Rock. Ties replay the round.',
      'Best of 5 wins format: first player to reach 3 round victories wins the match.',
    ],
    formatLabel: 'First to 3 rounds',
    avgDuration: '2–3 min',
    accentColor: '#06B6D4',
  },
  CONNECT_FOUR: {
    id: 'CONNECT_FOUR',
    name: 'Connect Four',
    shortDescription: 'Gravity-drop 6×7 strategy board. Build vertical traps and four-disc diagonal threats.',
    rules: [
      'Players alternate dropping colored tokens into any of the seven columns.',
      'Tokens fall to the lowest open row in the selected column.',
      'First player to connect four tokens horizontally, vertically, or diagonally wins.',
      'Each turn has a 35-second shot clock; a full 42-slot board with no winner is a draw.',
    ],
    formatLabel: 'Gravity grid · 6×7',
    avgDuration: '3–5 min',
    accentColor: '#3B82F6',
  },
};
