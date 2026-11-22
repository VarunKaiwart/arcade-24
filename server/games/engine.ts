import type { GameAction, GameState, GameType } from '../../shared/types.ts';

export interface ValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
}

export interface GameOutcome {
  result: 'WIN' | 'DRAW';
  winnerUserId: string | null;
}

export interface EnginePlayers {
  player1UserId: string;
  player2UserId: string;
}

export interface EngineOptions {
  turnSeconds?: number;
  now?: Date;
}

export interface GameEngine<TState extends GameState = GameState> {
  gameType: GameType;
  createInitialState(players: EnginePlayers, options?: EngineOptions): TState;
  validateAction(state: TState, playerId: string, action: GameAction): ValidationResult;
  applyAction(state: TState, playerId: string, action: GameAction, options?: EngineOptions): TState;
  getOutcome(state: TState): GameOutcome | null;
  getNextPlayer(state: TState): string | null;
  /**
   * Produces a safe copy of state for a specific viewer (critical for hidden RPS submissions).
   */
  sanitizeStateForPlayer(state: TState, viewerUserId: string): TState;
}
