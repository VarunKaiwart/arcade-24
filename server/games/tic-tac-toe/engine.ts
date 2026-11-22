import type { GameAction, TicTacToeMark, TicTacToeState } from '../../../shared/types.ts';
import type { EngineOptions, EnginePlayers, GameEngine, GameOutcome, ValidationResult } from '../engine.ts';

const WIN_LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function computeDeadline(options?: EngineOptions): string | null {
  const seconds = options?.turnSeconds ?? 30;
  if (seconds <= 0) return null;
  const now = options?.now ?? new Date();
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

function findWinner(
  board: (TicTacToeMark | null)[],
  playerSymbols: Record<string, TicTacToeMark>
): { winnerUserId: string; winningLine: number[] } | null {
  const markToUser = new Map<TicTacToeMark, string>();
  for (const [uid, mark] of Object.entries(playerSymbols)) {
    markToUser.set(mark, uid);
  }

  for (const [a, b, c] of WIN_LINES) {
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      const winnerUserId = markToUser.get(mark);
      if (winnerUserId) {
        return { winnerUserId, winningLine: [a, b, c] };
      }
    }
  }
  return null;
}

export const ticTacToeEngine: GameEngine<TicTacToeState> = {
  gameType: 'TICTACTOE',

  createInitialState(players: EnginePlayers, options?: EngineOptions): TicTacToeState {
    return {
      board: Array<TicTacToeMark | null>(9).fill(null),
      playerSymbols: {
        [players.player1UserId]: 'X',
        [players.player2UserId]: 'O',
      },
      currentTurnUserId: players.player1UserId,
      status: 'IN_PROGRESS',
      winnerUserId: null,
      winningLine: null,
      isDraw: false,
      turnDeadlineAt: computeDeadline(options),
    };
  },

  validateAction(state: TicTacToeState, playerId: string, action: GameAction): ValidationResult {
    if (state.status !== 'IN_PROGRESS') {
      return { valid: false, code: 'MATCH_ALREADY_COMPLETED', message: 'This match has already ended.' };
    }
    if (!state.playerSymbols[playerId]) {
      return { valid: false, code: 'NOT_A_PARTICIPANT', message: 'You are not a participant in this match.' };
    }
    if (state.currentTurnUserId !== playerId) {
      return { valid: false, code: 'NOT_YOUR_TURN', message: 'Wait for your opponent to make their move.' };
    }
    if (action.type !== 'PLACE_MARK') {
      return { valid: false, code: 'INVALID_ACTION_TYPE', message: 'Invalid action for Tic-Tac-Toe.' };
    }
    const { index } = action;
    if (!Number.isInteger(index) || index < 0 || index > 8) {
      return { valid: false, code: 'INVALID_CELL', message: 'Cell index must be between 0 and 8.' };
    }
    if (state.board[index] !== null) {
      return { valid: false, code: 'CELL_OCCUPIED', message: 'That cell is already occupied.' };
    }
    return { valid: true };
  },

  applyAction(
    state: TicTacToeState,
    playerId: string,
    action: GameAction,
    options?: EngineOptions
  ): TicTacToeState {
    const validation = this.validateAction(state, playerId, action);
    if (!validation.valid || action.type !== 'PLACE_MARK') {
      throw new Error(validation.message || 'Invalid Tic-Tac-Toe move');
    }

    const mark = state.playerSymbols[playerId];
    const nextBoard = [...state.board];
    nextBoard[action.index] = mark;

    const win = findWinner(nextBoard, state.playerSymbols);
    if (win) {
      return {
        ...state,
        board: nextBoard,
        currentTurnUserId: null,
        status: 'COMPLETED',
        winnerUserId: win.winnerUserId,
        winningLine: win.winningLine,
        isDraw: false,
        turnDeadlineAt: null,
      };
    }

    const isDraw = nextBoard.every((cell) => cell !== null);
    if (isDraw) {
      return {
        ...state,
        board: nextBoard,
        currentTurnUserId: null,
        status: 'COMPLETED',
        winnerUserId: null,
        winningLine: null,
        isDraw: true,
        turnDeadlineAt: null,
      };
    }

    const playerIds = Object.keys(state.playerSymbols);
    const nextTurnUserId = playerIds.find((id) => id !== playerId) ?? null;

    return {
      ...state,
      board: nextBoard,
      currentTurnUserId: nextTurnUserId,
      status: 'IN_PROGRESS',
      winnerUserId: null,
      winningLine: null,
      isDraw: false,
      turnDeadlineAt: computeDeadline(options),
    };
  },

  getOutcome(state: TicTacToeState): GameOutcome | null {
    if (state.status !== 'COMPLETED') return null;
    if (state.winnerUserId) {
      return { result: 'WIN', winnerUserId: state.winnerUserId };
    }
    return { result: 'DRAW', winnerUserId: null };
  },

  getNextPlayer(state: TicTacToeState): string | null {
    return state.status === 'IN_PROGRESS' ? state.currentTurnUserId : null;
  },

  sanitizeStateForPlayer(state: TicTacToeState): TicTacToeState {
    return {
      ...state,
      board: [...state.board],
      playerSymbols: { ...state.playerSymbols },
      winningLine: state.winningLine ? [...state.winningLine] : null,
    };
  },
};
