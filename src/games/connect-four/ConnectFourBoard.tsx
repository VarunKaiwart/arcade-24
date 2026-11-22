import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ConnectFourState } from '../../../shared/types.ts';

interface ConnectFourBoardProps {
  state: ConnectFourState;
  currentUserId: string;
  disabled: boolean;
  onDropToken: (column: number) => void;
}

export function ConnectFourBoard({
  state,
  currentUserId,
  disabled,
  onDropToken,
}: ConnectFourBoardProps) {
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const isMyTurn = state.status === 'IN_PROGRESS' && state.currentTurnUserId === currentUserId;
  const myColor = state.playerColors[currentUserId] ?? 'RED';

  const winningSet = new Set(
    (state.winningCells ?? []).map(([r, c]) => `${r}:${c}`)
  );

  const canDropColumn = (col: number) =>
    !disabled && isMyTurn && state.board[0][col] === null;

  return (
    <div className="flex flex-col items-center">
      {/* Column drop controls */}
      <div className="mb-2 grid w-full max-w-[448px] grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: state.cols }, (_, col) => {
          const playable = canDropColumn(col);
          const highlighted = playable && hoverCol === col;
          return (
            <button
              key={col}
              type="button"
              disabled={!playable}
              onClick={() => playable && onDropToken(col)}
              onMouseEnter={() => setHoverCol(col)}
              onMouseLeave={() => setHoverCol(null)}
              onFocus={() => setHoverCol(col)}
              onBlur={() => setHoverCol(null)}
              aria-label={`Drop token in column ${col + 1}`}
              className={`flex h-9 items-center justify-center rounded-lg border text-xs font-mono transition-colors ${
                highlighted
                  ? myColor === 'RED'
                    ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                    : 'border-amber-400/70 bg-amber-400/20 text-amber-200'
                  : playable
                    ? 'border-white/10 bg-[#161D31] text-slate-300 hover:border-white/25 cursor-pointer'
                    : 'border-white/5 bg-[#0C111E] text-slate-600 cursor-not-allowed'
              }`}
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {/* 6x7 Board Frame */}
      <div
        role="grid"
        aria-label="Connect Four 6 by 7 board"
        className="w-full max-w-[448px] rounded-xl border border-blue-500/30 bg-[#14203C] p-2.5 sm:p-3"
      >
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {state.board.map((row, rIdx) =>
            row.map((cell, cIdx) => {
              const isWinCell = winningSet.has(`${rIdx}:${cIdx}`);
              const isLast =
                state.lastMove?.row === rIdx && state.lastMove?.col === cIdx;
              const playableCol = canDropColumn(cIdx);
              const isHoverCol = playableCol && hoverCol === cIdx;

              return (
                <button
                  key={`${rIdx}-${cIdx}`}
                  type="button"
                  disabled={!playableCol}
                  onClick={() => playableCol && onDropToken(cIdx)}
                  onMouseEnter={() => setHoverCol(cIdx)}
                  onMouseLeave={() => setHoverCol(null)}
                  aria-label={`Row ${rIdx + 1}, Column ${cIdx + 1}${cell ? `, ${cell.toLowerCase()} token` : ', empty'}`}
                  className={`relative flex aspect-square items-center justify-center rounded-full border transition-all duration-150 ${
                    cell === 'RED'
                      ? isWinCell
                        ? 'border-white bg-rose-500 ring-2 ring-emerald-400'
                        : 'border-rose-300/40 bg-rose-500'
                      : cell === 'YELLOW'
                        ? isWinCell
                          ? 'border-white bg-amber-400 ring-2 ring-emerald-400'
                          : 'border-amber-200/50 bg-amber-400'
                        : isHoverCol
                          ? 'border-blue-400/50 bg-[#0D1528] cursor-pointer'
                          : 'border-white/10 bg-[#080B14]'
                  } ${isLast && !isWinCell ? 'ring-2 ring-white/70' : ''}`}
                />
              );
            })
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Your tokens:{' '}
        <span className={myColor === 'RED' ? 'font-semibold text-rose-400' : 'font-semibold text-amber-300'}>
          {myColor === 'RED' ? 'Crimson Red' : 'Solar Yellow'}
        </span>
        {' · '}
        {state.status === 'COMPLETED'
          ? state.isDraw
            ? 'Board full — draw.'
            : state.winnerUserId === currentUserId
              ? 'Four connected — you win.'
              : 'Opponent connected four.'
          : isMyTurn
            ? 'Click any open column to drop a token.'
            : 'Waiting for opponent drop.'}
      </p>
    </div>
  );
}
