import type { GameAction, RpsChoice, RpsRoundRecord, RpsState } from '../../../shared/types.ts';
import type { EngineOptions, EnginePlayers, GameEngine, GameOutcome, ValidationResult } from '../engine.ts';

const VALID_CHOICES = new Set<RpsChoice>(['ROCK', 'PAPER', 'SCISSORS']);
const TARGET_WINS = 3; // Best-of-five: first to 3 round wins

function computeDeadline(options?: EngineOptions): string | null {
  const seconds = options?.turnSeconds ?? 20;
  if (seconds <= 0) return null;
  const now = options?.now ?? new Date();
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

export function determineRpsRoundWinner(
  p1Id: string,
  c1: RpsChoice | null,
  p2Id: string,
  c2: RpsChoice | null
): { winnerUserId: string | null; isDraw: boolean } {
  if (!c1 && !c2) return { winnerUserId: null, isDraw: true };
  if (c1 && !c2) return { winnerUserId: p1Id, isDraw: false };
  if (!c1 && c2) return { winnerUserId: p2Id, isDraw: false };
  if (c1 === c2) return { winnerUserId: null, isDraw: true };

  if (
    (c1 === 'ROCK' && c2 === 'SCISSORS') ||
    (c1 === 'PAPER' && c2 === 'ROCK') ||
    (c1 === 'SCISSORS' && c2 === 'PAPER')
  ) {
    return { winnerUserId: p1Id, isDraw: false };
  }
  return { winnerUserId: p2Id, isDraw: false };
}

function finalizeRpsRound(
  state: RpsState,
  reason: 'NORMAL' | 'TIMEOUT'
): RpsState {
  const playerIds = Object.keys(state.scores);
  const [p1Id, p2Id] = playerIds;
  const subs = state._privateSubmissions ?? {};
  const c1 = subs[p1Id] ?? null;
  const c2 = subs[p2Id] ?? null;

  const { winnerUserId, isDraw } = determineRpsRoundWinner(p1Id, c1, p2Id, c2);
  const nextScores = { ...state.scores };
  if (winnerUserId) {
    nextScores[winnerUserId] = (nextScores[winnerUserId] ?? 0) + 1;
  }

  const record: RpsRoundRecord = {
    roundNumber: state.roundNumber,
    choices: {
      [p1Id]: c1,
      [p2Id]: c2,
    },
    winnerUserId,
    isDraw,
    reason,
  };

  const matchWinner =
    nextScores[p1Id] >= state.targetWins
      ? p1Id
      : nextScores[p2Id] >= state.targetWins
        ? p2Id
        : null;

  return {
    ...state,
    scores: nextScores,
    submittedBy: {
      [p1Id]: c1 !== null,
      [p2Id]: c2 !== null,
    },
    revealedChoices: {
      [p1Id]: c1,
      [p2Id]: c2,
    },
    _privateSubmissions: {
      [p1Id]: c1,
      [p2Id]: c2,
    },
    lastRound: record,
    roundHistory: [...state.roundHistory, record],
    phase: matchWinner ? 'COMPLETED' : 'ROUND_REVEAL',
    deadlineAt: null,
    status: matchWinner ? 'COMPLETED' : 'IN_PROGRESS',
    winnerUserId: matchWinner,
    isDraw: false,
  };
}

/**
 * Transitions RPS from ROUND_REVEAL into the next round's WAITING_FOR_CHOICES phase.
 */
export function advanceRpsNextRound(state: RpsState, options?: EngineOptions): RpsState {
  if (state.status === 'COMPLETED' || state.phase !== 'ROUND_REVEAL') {
    return state;
  }
  const playerIds = Object.keys(state.scores);
  const submittedBy: Record<string, boolean> = {};
  const revealedChoices: Record<string, RpsChoice | null> = {};
  const privateSubmissions: Record<string, RpsChoice | null> = {};
  for (const id of playerIds) {
    submittedBy[id] = false;
    revealedChoices[id] = null;
    privateSubmissions[id] = null;
  }
  return {
    ...state,
    roundNumber: state.roundNumber + 1,
    submittedBy,
    revealedChoices,
    _privateSubmissions: privateSubmissions,
    phase: 'WAITING_FOR_CHOICES',
    deadlineAt: computeDeadline(options),
  };
}

/**
 * Resolves an RPS round when the selection timer expires before both players submit.
 */
export function resolveRpsRoundTimeout(state: RpsState): RpsState {
  if (state.status === 'COMPLETED' || state.phase !== 'WAITING_FOR_CHOICES') {
    return state;
  }
  return finalizeRpsRound(state, 'TIMEOUT');
}

export const rpsEngine: GameEngine<RpsState> = {
  gameType: 'RPS',

  createInitialState(players: EnginePlayers, options?: EngineOptions): RpsState {
    const { player1UserId, player2UserId } = players;
    return {
      roundNumber: 1,
      targetWins: TARGET_WINS,
      scores: {
        [player1UserId]: 0,
        [player2UserId]: 0,
      },
      submittedBy: {
        [player1UserId]: false,
        [player2UserId]: false,
      },
      revealedChoices: {
        [player1UserId]: null,
        [player2UserId]: null,
      },
      _privateSubmissions: {
        [player1UserId]: null,
        [player2UserId]: null,
      },
      lastRound: null,
      roundHistory: [],
      phase: 'WAITING_FOR_CHOICES',
      deadlineAt: computeDeadline(options),
      status: 'IN_PROGRESS',
      winnerUserId: null,
      isDraw: false,
    };
  },

  validateAction(state: RpsState, playerId: string, action: GameAction): ValidationResult {
    if (state.status !== 'IN_PROGRESS') {
      return { valid: false, code: 'MATCH_ALREADY_COMPLETED', message: 'This match has already ended.' };
    }
    if (!(playerId in state.scores)) {
      return { valid: false, code: 'NOT_A_PARTICIPANT', message: 'You are not a participant in this match.' };
    }
    if (state.phase !== 'WAITING_FOR_CHOICES') {
      return {
        valid: false,
        code: 'ROUND_IN_REVEAL',
        message: 'Round is resolving. Wait for the next round to start.',
      };
    }
    if (action.type !== 'SUBMIT_CHOICE') {
      return { valid: false, code: 'INVALID_ACTION_TYPE', message: 'Invalid action for Rock Paper Scissors.' };
    }
    if (!VALID_CHOICES.has(action.choice)) {
      return { valid: false, code: 'INVALID_CHOICE', message: 'Choice must be ROCK, PAPER, or SCISSORS.' };
    }
    if (state.submittedBy[playerId]) {
      return {
        valid: false,
        code: 'CHOICE_ALREADY_SUBMITTED',
        message: 'You have already locked in your choice for this round.',
      };
    }
    return { valid: true };
  },

  applyAction(state: RpsState, playerId: string, action: GameAction): RpsState {
    const validation = this.validateAction(state, playerId, action);
    if (!validation.valid || action.type !== 'SUBMIT_CHOICE') {
      throw new Error(validation.message || 'Invalid RPS action');
    }

    const nextPrivate: Record<string, RpsChoice | null> = {
      ...(state._privateSubmissions ?? {}),
      [playerId]: action.choice,
    };
    const nextSubmittedBy: Record<string, boolean> = {
      ...state.submittedBy,
      [playerId]: true,
    };

    const nextState: RpsState = {
      ...state,
      submittedBy: nextSubmittedBy,
      _privateSubmissions: nextPrivate,
    };

    const allSubmitted = Object.keys(state.scores).every((uid) => Boolean(nextSubmittedBy[uid]));
    if (allSubmitted) {
      return finalizeRpsRound(nextState, 'NORMAL');
    }

    return nextState;
  },

  getOutcome(state: RpsState): GameOutcome | null {
    if (state.status !== 'COMPLETED') return null;
    if (state.winnerUserId) {
      return { result: 'WIN', winnerUserId: state.winnerUserId };
    }
    return { result: 'DRAW', winnerUserId: null };
  },

  getNextPlayer(): string | null {
    // RPS is simultaneous, so no single turn owner exists.
    return null;
  },

  sanitizeStateForPlayer(state: RpsState, viewerUserId: string): RpsState {
    const playerIds = Object.keys(state.scores);
    const revealedChoices: Record<string, RpsChoice | null> = {};

    if (state.phase === 'WAITING_FOR_CHOICES') {
      // Reveal ONLY the viewer's own locked-in choice; never leak the opponent's hidden pick!
      for (const uid of playerIds) {
        revealedChoices[uid] =
          uid === viewerUserId ? (state._privateSubmissions?.[uid] ?? null) : null;
      }
    } else {
      for (const uid of playerIds) {
        revealedChoices[uid] = state.revealedChoices[uid] ?? null;
      }
    }

    return {
      roundNumber: state.roundNumber,
      targetWins: state.targetWins,
      scores: { ...state.scores },
      submittedBy: { ...state.submittedBy },
      revealedChoices,
      lastRound: state.lastRound
        ? { ...state.lastRound, choices: { ...state.lastRound.choices } }
        : null,
      roundHistory: state.roundHistory.map((r) => ({ ...r, choices: { ...r.choices } })),
      phase: state.phase,
      deadlineAt: state.deadlineAt,
      status: state.status,
      winnerUserId: state.winnerUserId,
      isDraw: state.isDraw,
    };
  },
};
