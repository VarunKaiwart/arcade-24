import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Wifi, WifiOff } from 'lucide-react';
import {
  GAME_METADATA,
  type GameType,
  type LeaderboardEntry,
  type MatchHistoryItem,
} from '../../shared/types.ts';
import { Avatar } from '../components/common/Avatar.tsx';
import { GameEmblem } from '../components/common/GameEmblem.tsx';
import { RankBadge } from '../components/common/RankBadge.tsx';
import { EmptyState, LoadingState } from '../components/common/StateViews.tsx';
import { XpProgress } from '../components/common/XpProgress.tsx';
import { api } from '../lib/api.ts';
import { useAuth } from '../providers/AuthProvider.tsx';
import { useSocket } from '../providers/SocketProvider.tsx';

const GAMES: GameType[] = ['TICTACTOE', 'RPS', 'CONNECT_FOUR'];

export function DashboardPage() {
  const { user, stats, refreshStats } = useAuth();
  const { status } = useSocket();

  const [recentMatches, setRecentMatches] = useState<MatchHistoryItem[]>([]);
  const [topPlayers, setTopPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void refreshStats();

    Promise.all([
      api.getMatchHistory({ page: 1, limit: 5 }),
      api.getLeaderboard({ page: 1, limit: 5 }),
    ])
      .then(([historyRes, boardRes]) => {
        if (!active) return;
        setRecentMatches(historyRes.items);
        setTopPlayers(boardRes.entries);
      })
      .catch(() => {
        // Keep empty fallbacks silently on dashboard preview widgets
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshStats]);

  if (!user) return null;

  const isConnected = status === 'connected';

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
      {/* Player Welcome & Progression Strip */}
      <section className="rounded-xl border border-white/10 bg-[#101524] p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Avatar avatarId={user.avatar} username={user.username} size="lg" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="font-display text-2xl font-bold text-white">
                  Welcome back, {user.username}
                </h1>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  {isConnected ? (
                    <>
                      <Wifi className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      <span className="text-emerald-300">Live server connected</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                      <span className="text-amber-300">Reconnecting...</span>
                    </>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
                <RankBadge rank={stats?.rank ?? 'Bronze'} showLabel />
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{stats?.wins ?? 0}W – {stats?.losses ?? 0}L – {stats?.draws ?? 0}D</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{stats?.winRate ?? 0}% Win Rate</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:w-[360px] lg:flex-col lg:items-stretch">
            <XpProgress
              level={stats?.level ?? 1}
              currentLevelXp={stats?.currentLevelXp ?? 0}
              nextLevelXp={stats?.nextLevelXp ?? 500}
              totalXp={stats?.totalXp ?? 0}
            />
            <Link
              to="/play"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 whitespace-nowrap shrink-0"
            >
              Play Now
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Three Game Quick-Launch Cards */}
      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-bold text-white">Choose a Game</h2>
          <Link to="/play" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
            Open Full Lobby →
          </Link>
        </div>

        <div className="mt-4 grid gap-5 md:grid-cols-3">
          {GAMES.map((gameId) => {
            const game = GAME_METADATA[gameId];
            const perGame = stats?.perGame[gameId];
            return (
              <div
                key={gameId}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#101524] p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <GameEmblem gameType={gameId} className="h-10 w-10" />
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      {perGame ? `${perGame.wins}W / ${perGame.matches}M` : '0W / 0M'}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-white">{game.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{game.formatLabel}</p>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
                    {game.shortDescription}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-xs text-slate-500">{game.avgDuration}</span>
                  <Link
                    to={`/play?game=${gameId}`}
                    className="rounded-lg bg-[#161D31] border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:border-indigo-400/50 hover:bg-indigo-600/20 whitespace-nowrap shrink-0"
                  >
                    Launch Lobby
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Matches + Leaderboard Preview */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">Recent Matches</h2>
            <Link to="/history" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
              View All →
            </Link>
          </div>

          {loading ? (
            <LoadingState label="Loading recent matches..." />
          ) : recentMatches.length === 0 ? (
            <EmptyState
              title="No completed matches yet"
              description="Play your first Tic-Tac-Toe, Rock Paper Scissors, or Connect Four match to start tracking stats and XP."
              action={
                <Link
                  to="/play"
                  className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  Find a Match
                </Link>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101524]">
              <div className="divide-y divide-white/10">
                {recentMatches.map((item) => (
                  <Link
                    key={item.id}
                    to={`/match/${item.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <GameEmblem gameType={item.gameType} className="h-8 w-8 shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-100">
                          vs {item.opponent?.username ?? 'Opponent'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {GAME_METADATA[item.gameType].name} · {item.mode === 'PRIVATE' ? 'Private Room' : 'Quick Match'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-semibold ${
                          item.outcomeForUser === 'WIN'
                            ? 'text-emerald-400'
                            : item.outcomeForUser === 'LOSS'
                              ? 'text-rose-400'
                              : 'text-cyan-300'
                        }`}
                      >
                        {item.outcomeForUser}
                      </div>
                      <div className="font-mono text-xs text-slate-400 tabular-nums">
                        +{item.xpEarned} XP
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">Top Players</h2>
            <Link to="/leaderboard" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
              Full Standings →
            </Link>
          </div>

          {loading ? (
            <LoadingState label="Loading standings..." />
          ) : topPlayers.length === 0 ? (
            <EmptyState
              title="Leaderboard is empty"
              description="Complete matches to claim the top progression spots."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101524]">
              <div className="divide-y divide-white/10">
                {topPlayers.map((entry) => {
                  const isMe = entry.userId === user.id;
                  return (
                    <Link
                      key={entry.userId}
                      to={`/profile/${encodeURIComponent(entry.username)}`}
                      className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] ${
                        isMe ? 'bg-indigo-500/10' : ''
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-6 font-mono text-xs font-semibold text-slate-400 tabular-nums">
                          #{entry.position}
                        </span>
                        <Avatar avatarId={entry.avatar} username={entry.username} size="xs" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-100">
                            {entry.username}
                            {isMe ? ' (You)' : ''}
                          </div>
                          <RankBadge rank={entry.rank} className="text-xs" />
                        </div>
                      </div>
                      <div className="text-right font-mono shrink-0 tabular-nums">
                        <div className="text-sm font-semibold text-slate-100">
                          {entry.totalXp.toLocaleString()} XP
                        </div>
                        <div className="text-xs text-slate-400">{entry.wins} wins</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
