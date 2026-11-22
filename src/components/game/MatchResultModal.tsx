import { RotateCcw, Trophy, ArrowLeft } from 'lucide-react';
import type { MatchSnapshot, RpsState, XpAwardSummary } from '../../../shared/types.ts';
import { Avatar } from '../common/Avatar.tsx';
import { RankBadge } from '../common/RankBadge.tsx';

interface MatchResultModalProps {
  match: MatchSnapshot;
  currentUserId: string;
  xpAwards: XpAwardSummary[];
  rematchLoading: boolean;
  onRequestRematch: () => void;
  onReturnToLobby: () => void;
}

export function MatchResultModal({
  match,
  currentUserId,
  xpAwards,
  rematchLoading,
  onRequestRematch,
  onReturnToLobby,
}: MatchResultModalProps) {
  const isWinner = match.winnerUserId === currentUserId;
  const isDraw = match.result === 'DRAW';
  const isAbandoned = match.result === 'ABANDONED' || match.status === 'ABANDONED';
  const isForfeit = match.result === 'FORFEIT';

  const myAward = xpAwards.find((a) => a.userId === currentUserId) ?? null;
  const iRequestedRematch = match.rematchRequestedBy.includes(currentUserId);
  const opponentRequestedRematch = match.rematchRequestedBy.some((id) => id !== currentUserId);

  let headline = 'Defeat';
  let subline = 'Review the board and challenge for a rematch.';
  let accentClass = 'text-rose-400';

  if (isAbandoned) {
    headline = 'Match Abandoned';
    subline = 'Both players disconnected before the match finished. No XP was awarded.';
    accentClass = 'text-slate-300';
  } else if (isDraw) {
    headline = 'Draw Match';
    subline = 'Deadlocked finish — both players split progression points.';
    accentClass = 'text-cyan-300';
  } else if (isWinner) {
    headline = isForfeit ? 'Victory by Forfeit' : 'Victory';
    subline = isForfeit
      ? 'Your opponent forfeited or timed out.'
      : 'Clean execution. Your match record and XP have been updated.';
    accentClass = 'text-emerald-400';
  } else if (isForfeit) {
    headline = 'Forfeited';
    subline = 'Match concluded by forfeit or turn timeout.';
    accentClass = 'text-rose-400';
  }

  const rpsScores = match.gameType === 'RPS' ? (match.state as RpsState).scores : null;

  return (
    <div
      className="rounded-xl border border-white/15 bg-[#101524] p-6"
      role="region"
      aria-label="Match result summary"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isWinner && <Trophy className="h-5 w-5 text-amber-400" aria-hidden="true" />}
            <h2 className={`font-display text-2xl font-bold ${accentClass}`}>{headline}</h2>
          </div>
          <p className="text-sm text-slate-400">{subline}</p>
        </div>

        {myAward && (
          <div className="flex items-center gap-4 border-t border-white/10 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
            <div>
              <div className="text-xs text-slate-400">XP Earned</div>
              <div className="font-mono text-xl font-bold text-indigo-400 tabular-nums">
                +{myAward.amount} XP
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" aria-hidden="true" />
            <div>
              <div className="text-xs text-slate-400">
                Level {myAward.level}
                {myAward.leveledUp ? ' · Level Up' : ''}
              </div>
              <RankBadge rank={myAward.rank} />
            </div>
          </div>
        )}
      </div>

      {/* Match scoreboard */}
      <div className="mt-5 grid grid-cols-2 gap-3 border-y border-white/10 py-4">
        {match.players.map((player) => {
          const won = match.winnerUserId === player.userId;
          const award = xpAwards.find((a) => a.userId === player.userId);
          return (
            <div key={player.userId} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar avatarId={player.avatar} username={player.username} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100">
                    {player.username}
                    {player.userId === currentUserId ? ' (You)' : ''}
                  </div>
                  <div className="text-xs text-slate-400">
                    {won ? 'Winner' : isDraw ? 'Draw' : isAbandoned ? 'Abandoned' : 'Runner-up'}
                    {award ? ` · +${award.amount} XP` : ''}
                  </div>
                </div>
              </div>
              {rpsScores && (
                <span className="font-mono text-lg font-bold text-slate-100 tabular-nums">
                  {rpsScores[player.userId] ?? 0}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Rematch status & actions */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-400">
          {iRequestedRematch
            ? 'Rematch requested — waiting for opponent to accept...'
            : opponentRequestedRematch
              ? 'Your opponent wants a rematch. Accept to start a new match immediately.'
              : 'Rematch starts a fresh match record with swapped first turn.'}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReturnToLobby}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#161D31] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Return to Lobby
          </button>
          <button
            type="button"
            onClick={onRequestRematch}
            disabled={rematchLoading || iRequestedRematch}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {iRequestedRematch
              ? 'Waiting...'
              : opponentRequestedRematch
                ? 'Accept Rematch'
                : 'Request Rematch'}
          </button>
        </div>
      </div>
    </div>
  );
}
