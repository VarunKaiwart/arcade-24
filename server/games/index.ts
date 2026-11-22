import type { GameType } from '../../shared/types.ts';
import type { GameEngine } from './engine.ts';
import { ticTacToeEngine } from './tic-tac-toe/engine.ts';
import { rpsEngine } from './rock-paper-scissors/engine.ts';
import { connectFourEngine } from './connect-four/engine.ts';

const engines: Record<GameType, GameEngine<any>> = {
  TICTACTOE: ticTacToeEngine,
  RPS: rpsEngine,
  CONNECT_FOUR: connectFourEngine,
};

export function getGameEngine(gameType: GameType): GameEngine<any> {
  const engine = engines[gameType];
  if (!engine) {
    throw new Error(`Unsupported game type: ${String(gameType)}`);
  }
  return engine;
}

export { ticTacToeEngine, rpsEngine, connectFourEngine };
