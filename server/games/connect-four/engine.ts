import type { ConnectFourColor, ConnectFourState, GameAction } from '../../../shared/types.ts';
import type { EngineOptions, EnginePlayers, GameEngine, GameOutcome, ValidationResult } from '../engine.ts';

const ROWS = 6;
const COLS = 7;

const DIRECTIONS: readonly [number, number][] = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
];

function computeDeadline(options?: EngineOptions): string | null {
  const seconds = options?.turnSeconds ?? 35;
  if (seconds <= 0) return null;
  const now = options?.now ?? new Date();
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

function findFourInARow(
  board: (ConnectFourColor | null)[][],
  row: number,
  col: number,
  color: ConnectFourColor
): [number, number][] | null {
  for (const [dr, dc] of DIRECTIONS) {
    const cells: [number, number][] = [[row, col]];

    // Forward direction
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === color) {
      cells.push([r, c]);
      r += dr;
      c += dc;
    }

    // Backward direction
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === color) {
      cells.unshift([r, c]);
      r -= dr;
      c -= dc;
    }

    if (cells.length >= 4) {
      return cells;
    }
  }
  return null;
}

export const connectFourEngine: GameEngine<ConnectFourState> = {
  gameType: 'CONNECT_FOUR',

  createInitialState(players: EnginePlayers, options?: EngineOptions): ConnectFourState {
    return {
      rows: ROWS,
      cols: COLS,
      board: Array.from({ length: ROWS }, () => Array<ConnectFourColor | null>(COLS).fill(null)),
      playerColors: {
        [players.player1UserId]: 'RED',
        [players.player2UserId]: 'YELLOW',
      },
      currentTurnUserId: players.player1UserId,
      status: 'IN_PROGRESS',
      winnerUserId: null,
      winningCells: null,
      lastMove: null,
      isDraw: false,
      turnDeadlineAt: computeDeadline(options),
    };
  },

  validateAction(state: ConnectFourState, playerId: string, action: GameAction): ValidationResult {
    if (state.status !== 'IN_PROGRESS') {
      return { valid: false, code: 'MATCH_ALREADY_COMPLETED', message: 'This match has already ended.' };
    }
    if (!state.playerColors[playerId]) {
      return { valid: false, code: 'NOT_A_PARTICIPANT', message: 'You are not a participant in this match.' };
    }
    if (state.currentTurnUserId !== playerId) {
      return { valid: false, code: 'NOT_YOUR_TURN', message: 'Wait for your opponent to drop their token.' };
    }
    if (action.type !== 'DROP_TOKEN') {
      return { valid: false, code: 'INVALID_ACTION_TYPE', message: 'Invalid action for Connect Four.' };
    }
    const { column } = action;
    if (!Number.isInteger(column) || column < 0 || column >= COLS) {
      return { valid: false, code: 'INVALID_COLUMN', message: 'Column must be between 0 and 6.' };
    }
    if (state.board[0][column] !== null) {
      return { valid: false, code: 'COLUMN_FULL', message: 'That column is already full.' };
    }
    return { valid: true };
  },

  applyAction(
    state: ConnectFourState,
    playerId: string,
    action: GameAction,
    options?: EngineOptions
  ): ConnectFourState {
    const validation = this.validateAction(state, playerId, action);
    if (!validation.valid || action.type !== 'DROP_TOKEN') {
      throw new Error(validation.message || 'Invalid Connect Four move');
    }

    const { column } = action;
    const color = state.playerColors[playerId];
    const nextBoard = state.board.map((row) => [...row]);

    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      if (nextBoard[r][column] === null) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error('Column is full');
    }

    nextBoard[targetRow][column] = color;
    const lastMove = { row: targetRow, col: column, userId: playerId };

    const winningCells = findFourInARow(nextBoard, targetRow, column, color);
    if (winningCells) {
      return {
        ...state,
        board: nextBoard,
        currentTurnUserId: null,
        status: 'COMPLETED',
        winnerUserId: playerId,
        winningCells,
        lastMove,
        isDraw: false,
        turnDeadlineAt: null,
      };
    }

    const isDraw = nextBoard[0].every((cell) => cell !== null);
    if (isDraw) {
      return {
        ...state,
        board: nextBoard,
        currentTurnUserId: null,
        status: 'COMPLETED',
        winnerUserId: null,
        winningCells: null,
        lastMove,
        isDraw: true,
        turnDeadlineAt: null,
      };
    }

    const playerIds = Object.keys(state.playerColors);
    const nextTurnUserId = playerIds.find((id) => id !== playerId) ?? null;

    return {
      ...state,
      board: nextBoard,
      currentTurnUserId: nextTurnUserId,
      status: 'IN_PROGRESS',
      winnerUserId: null,
      winningCells: null,
      lastMove,
      isDraw: false,
      turnDeadlineAt: computeDeadline(options),
    };
  },

  getOutcome(state: ConnectFourState): GameOutcome | null {
    if (state.status !== 'COMPLETED') return null;
    if (state.winnerUserId) {
      return { result: 'WIN', winnerUserId: state.winnerUserId };
    }
    return { result: 'DRAW', winnerUserId: null };
  },

  getNextPlayer(state: ConnectFourState): string | null {
    return state.status === 'IN_PROGRESS' ? state.currentTurnUserId : null;
  },

  sanitizeStateForPlayer(state: ConnectFourState): ConnectFourState {
    return {
      ...state,
      board: state.board.map((row) => [...row]),
      playerColors: { ...state.playerColors },
      winningCells: state.winningCells ? state.winningCells.map(([r, c]) => [r, c]) : null,
      lastMove: state.lastMove ? { ...state.lastMove } : null,
    };
  },
};
