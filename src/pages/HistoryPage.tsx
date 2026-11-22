import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GAME_METADATA, type MatchHistoryItem } from '../../shared/types.ts';
import { Avatar } from '../components/common/Avatar.tsx';
import { GameEmblem } from '../components/common/GameEmblem.tsx';
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateViews.tsx';
import { api } from '../lib/api.ts';

const GAME_FILTERS = [
  { id: 'ALL', label: 'All Games' },
  { id: 'TICTACTOE', label: 'Tic-Tac-Toe' },
  { id: 'RPS', label: 'RPS' },
  { id: 'CONNECT_FOUR', label: 'Connect Four' },
] as const;

const OUTCOME_FILTERS = [
  { id: 'ALL', label: 'All Results' },
  { id: 'WIN', label: 'Wins' },
  { id: 'LOSS', label: 'Losses' },
  { id: 'DRAW', label: 'Draws' },
] as const;

export function HistoryPage() {
  const [gameFilter, setGameFilter] = useState<string>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MatchHistoryItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMatchHistory({
        page,
        limit: 12,
        gameType: gameFilter,
        outcome: outcomeFilter,
      });
      setItems(data.items);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load match history.');
    } finally {
      setLoading(false);
    }
  }, [page, gameFilter, outcomeFilter]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Match History</h1>
          <p className="mt-1 text-sm text-slate-400">
            Completed 1v1 matches, outcomes, and verified XP awards.
          </p>
        </div>
        <span className="font-mono text-xs text-slate-400 tabular-nums">
          {total.toLocaleString()} {total === 1 ? 'match' : 'matches'}
        </span>
      </div>

      {/* Interactive Filter Bars */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#101524] p-1">
          {GAME_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setGameFilter(f.id);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                gameFilter === f.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#101524] p-1">
          {OUTCOME_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setOutcomeFilter(f.id);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                outcomeFilter === f.id
                  ? 'bg-[#1E293B] text-white'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading match history..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadHistory()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No matches match these filters"
          description="Finish a match in the Play Lobby or broaden your filters to see past games."
          action={
            <Link
              to="/play"
              className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Play a Match
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101524]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-[#161D31] text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Game</th>
                  <th className="px-4 py-3 font-medium">Opponent</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 text-right font-medium">XP</th>
                  <th className="px-4 py-3 text-right font-medium">Played</th>
                  <th className="px-4 py-3 text-right font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {items.map((item) => {
                  const resultColor =
                    item.outcomeForUser === 'WIN'
                      ? 'text-emerald-400'
                      : item.outcomeForUser === 'LOSS'
                        ? 'text-rose-400'
                        : item.outcomeForUser === 'DRAW'
                          ? 'text-cyan-300'
                          : 'text-slate-400';

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <GameEmblem gameType={item.gameType} className="h-7 w-7 shrink-0" />
                          <span className="font-medium text-slate-100 whitespace-nowrap">
                            {GAME_METADATA[item.gameType].name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {item.opponent ? (
                          <Link
                            to={`/profile/${encodeURIComponent(item.opponent.username)}`}
                            className="flex items-center gap-2.5 text-slate-200 hover:text-indigo-300"
                          >
                            <Avatar
                              avatarId={item.opponent.avatar}
                              username={item.opponent.username}
                              size="xs"
                            />
                            <span className="truncate">{item.opponent.username}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                        {item.mode === 'PRIVATE' ? 'Private Room' : 'Quick Match'}
                      </td>
                      <td className={`px-4 py-3.5 text-xs font-semibold ${resultColor}`}>
                        {item.outcomeForUser}
                        {item.result === 'FORFEIT' ? ' (Forfeit)' : ''}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-indigo-300 tabular-nums">
                        +{item.xpEarned}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-400 whitespace-nowrap tabular-nums">
                        {new Date(item.completedAt || item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/match/${item.id}`}
                          className="text-xs font-medium text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
                        >
                          Inspect
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-slate-400">
              <span className="font-mono tabular-nums">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#161D31] px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#161D31] px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
