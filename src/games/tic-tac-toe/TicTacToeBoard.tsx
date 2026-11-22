import type { TicTacToeState } from '../../../shared/types.ts';

interface TicTacToeBoardProps {
  state: TicTacToeState;
  currentUserId: string;
  disabled: boolean;
  onPlaceMark: (index: number) => void;
}

export function TicTacToeBoard({
  state,
  currentUserId,
  disabled,
  onPlaceMark,
}: TicTacToeBoardProps) {
  const isMyTurn = state.status === 'IN_PROGRESS' && state.currentTurnUserId === currentUserId;
  const myMark = state.playerSymbols[currentUserId] ?? 'X';
  const winSet = new Set(state.winningLine ?? []);

  return (
    <div className="flex flex-col items-center">
      <div
        role="grid"
        aria-label="Tic-Tac-Toe 3 by 3 board"
        className="grid w-full max-w-[360px] grid-cols-3 gap-3"
      >
        {state.board.map((cell, index) => {
          const row = Math.floor(index / 3) + 1;
          const col = (index % 3) + 1;
          const isWinningCell = winSet.has(index);
          const playable = !disabled && isMyTurn && cell === null;

          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              disabled={!playable}
              onClick={() => playable && onPlaceMark(index)}
              aria-label={`Row ${row}, Column ${col}${cell ? `, occupied by ${cell}` : ', empty'}`}
              className={`group relative flex aspect-square items-center justify-center rounded-xl border transition-all duration-150 ${
                isWinningCell
                  ? 'border-emerald-400/70 bg-emerald-500/15'
                  : cell !== null
                    ? 'border-white/10 bg-[#161D31]'
                    : playable
                      ? 'border-white/15 bg-[#101524] hover:border-indigo-400/70 hover:bg-[#161D31] cursor-pointer active:scale-[0.97]'
                      : 'border-white/10 bg-[#101524]/70 cursor-not-allowed'
              }`}
            >
              {cell === 'X' && (
                <svg viewBox="0 0 48 48" className="h-12 w-12 sm:h-14 sm:w-14" fill="none" aria-hidden="true">
                  <path
                    d="M12 12L36 36M36 12L12 36"
                    stroke={isWinningCell ? '#34D399' : '#818CF8'}
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {cell === 'O' && (
                <svg viewBox="0 0 48 48" className="h-12 w-12 sm:h-14 sm:w-14" fill="none" aria-hidden="true">
                  <circle
                    cx="24"
                    cy="24"
                    r="13"
                    stroke={isWinningCell ? '#34D399' : '#22D3EE'}
                    strokeWidth="5"
                  />
                </svg>
              )}
              {cell === null && playable && (
                <span
                  aria-hidden="true"
                  className="font-display text-3xl font-bold text-slate-600 opacity-0 transition-opacity group-hover:opacity-60"
                >
                  {myMark}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        You play as{' '}
        <span className={myMark === 'X' ? 'font-semibold text-indigo-300' : 'font-semibold text-cyan-300'}>
          {myMark}
        </span>
        {' · '}
        {state.status === 'COMPLETED'
          ? state.isDraw
            ? 'Board full — draw.'
            : state.winnerUserId === currentUserId
              ? 'Three in a row achieved.'
              : 'Opponent connected three in a row.'
          : isMyTurn
            ? 'Select any empty square to place your mark.'
            : 'Waiting for opponent move.'}
      </p>
    </div>
  );
}
