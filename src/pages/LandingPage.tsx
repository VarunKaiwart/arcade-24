import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Trophy, Users, Zap } from 'lucide-react';
import { GAME_METADATA, type GameType } from '../../shared/types.ts';
import { GameEmblem } from '../components/common/GameEmblem.tsx';
import { useAuth } from '../providers/AuthProvider.tsx';

const GAMES: GameType[] = ['TICTACTOE', 'RPS', 'CONNECT_FOUR'];

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
      {/* Hero Section */}
      <section className="grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-6">
          <p className="text-sm font-medium text-indigo-400">
            Real-time 1v1 browser arena · Server-authoritative multiplayer
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Challenge a friend or queue into ranked 1v1 duels
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-slate-300">
            DuelZone pairs instant matchmaking and private room codes across three classic head-to-head games. Every move is validated by the server, every match is recorded, and every finish advances your progression rank.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            {user ? (
              <Link
                to="/play"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 whitespace-nowrap shrink-0"
              >
                Enter Play Lobby
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 whitespace-nowrap shrink-0"
                >
                  Create Free Account
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#101524] px-6 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-[#161D31] whitespace-nowrap shrink-0"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Right visual summary panel */}
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-white/10 bg-[#101524] p-6">
            <h2 className="font-display text-lg font-semibold text-white">How DuelZone Works</h2>
            <div className="mt-5 space-y-5 divide-y divide-white/10">
              <div className="flex items-start gap-3.5 pt-1">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Private Rooms or Quick Match</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Generate a 6-character code to invite a friend directly, or join a live per-game matchmaking queue.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 pt-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Authoritative Real-Time State</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Turns, blind RPS picks, timers, and win conditions are verified server-side with automatic reconnect recovery.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 pt-4">
                <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">XP, Ranks & Global Leaderboard</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Earn +30 XP per win, +15 XP per draw, and +10 XP per loss to climb from Bronze to Diamond.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 pt-4">
                <Zap className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Match Chat & Instant Rematches</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Private participant-only match chat and one-click rematches with swapped first-turn order.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Games Showcase */}
      <section id="games" className="mt-20 border-t border-white/10 pt-14">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Three Competitive 1v1 Modes
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Built on one synchronized match engine with shot clocks, live chat, and full match history.
            </p>
          </div>
          <Link
            to="/leaderboard"
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 whitespace-nowrap shrink-0"
          >
            View Global Leaderboard →
          </Link>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {GAMES.map((gameId) => {
            const game = GAME_METADATA[gameId];
            return (
              <article
                key={gameId}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#101524] p-6"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <GameEmblem gameType={gameId} className="h-11 w-11" />
                    <span className="font-mono text-xs text-slate-400">{game.avgDuration}</span>
                  </div>
                  <h3 className="mt-5 font-display text-xl font-semibold text-white">{game.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{game.formatLabel}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    {game.shortDescription}
                  </p>
                </div>

                <div className="mt-6 border-t border-white/10 pt-4">
                  <Link
                    to={user ? `/play?game=${gameId}` : '/register'}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    {user ? `Play ${game.name}` : 'Sign up to play'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
