import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LeaderboardEntry } from '../../shared/types.ts';
import { Avatar } from '../components/common/Avatar.tsx';
import { RankBadge } from '../components/common/RankBadge.tsx';
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateViews.tsx';
import { api } from '../lib/api.ts';
import { useAuth } from '../providers/AuthProvider.tsx';

export function LeaderboardPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getLeaderboard({ page: targetPage, limit: 15 });
      setEntries(data.entries);
      setCurrentUserEntry(data.currentUserEntry);
      setTotalPages(data.pagination.totalPages);
      setTotalPlayers(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard(page);
  }, [page, loadBoard]);

  const userInCurrentPage = Boolean(
    user && entries.some((entry) => entry.userId === user.id)
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Global Leaderboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ranked by total Progression XP (tie-breakers: wins, then account join date). Ranks reflect XP progression, not skill/Elo rating.
          </p>
        </div>
        <span className="font-mono text-xs text-slate-400 tabular-nums">
          {totalPlayers.toLocaleString()} registered players
        </span>
      </div>

      {/* Show current user's position if outside current page */}
      {currentUserEntry && !userInCurrentPage && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-500/35 bg-indigo-950/25 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-indigo-300 tabular-nums">
              #{currentUserEntry.position}
            </span>
            <Avatar
              avatarId={currentUserEntry.avatar}
              username={currentUserEntry.username}
              size="xs"
            />
            <span className="text-sm font-semibold text-white">
              Your Standing · {currentUserEntry.username}
            </span>
            <RankBadge rank={currentUserEntry.rank} />
          </div>
          <div className="flex items-center gap-5 font-mono text-sm tabular-nums">
            <span className="text-slate-300">Lv.{currentUserEntry.level}</span>
            <span className="font-semibold text-white">
              {currentUserEntry.totalXp.toLocaleString()} XP
            </span>
            <span className="text-slate-400">{currentUserEntry.wins}W</span>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading global standings..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadBoard(page)} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No players on the leaderboard yet"
          description="Register and play a match to appear in the global progression standings."
          action={
            <Link
              to={user ? '/play' : '/register'}
              className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {user ? 'Enter Lobby' : 'Create Account'}
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101524]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-[#161D31] text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Pos</th>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Progression Rank</th>
                  <th className="px-4 py-3 text-right font-medium">Level</th>
                  <th className="px-4 py-3 text-right font-medium">Wins</th>
                  <th className="px-4 py-3 text-right font-medium">Win Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Total XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {entries.map((entry) => {
                  const isMe = user?.id === entry.userId;
                  return (
                    <tr
                      key={entry.userId}
                      className={`transition-colors hover:bg-white/[0.03] ${
                        isMe ? 'bg-indigo-500/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-400 tabular-nums">
                        #{entry.position}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          to={`/profile/${encodeURIComponent(entry.username)}`}
                          className="flex items-center gap-3 hover:text-indigo-300"
                        >
                          <Avatar avatarId={entry.avatar} username={entry.username} size="xs" />
                          <span className="font-medium text-slate-100">
                            {entry.username}
                            {isMe ? ' (You)' : ''}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <RankBadge rank={entry.rank} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-300 tabular-nums">
                        {entry.level}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-300 tabular-nums">
                        {entry.wins}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-400 tabular-nums">
                        {entry.winRate}%
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-white tabular-nums">
                        {entry.totalXp.toLocaleString()} XP
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
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
