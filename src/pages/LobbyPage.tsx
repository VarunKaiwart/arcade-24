import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Copy, Loader2, Search, Shield, Users, Wifi, WifiOff, X } from 'lucide-react';
import { GAME_METADATA, type GameType } from '../../shared/types.ts';
import { Avatar } from '../components/common/Avatar.tsx';
import { GameEmblem } from '../components/common/GameEmblem.tsx';
import { useAuth } from '../providers/AuthProvider.tsx';
import { useSocket } from '../providers/SocketProvider.tsx';

const GAMES: GameType[] = ['TICTACTOE', 'RPS', 'CONNECT_FOUR'];

function isValidGame(val: string | null): val is GameType {
  return val === 'TICTACTOE' || val === 'RPS' || val === 'CONNECT_FOUR';
}

export function LobbyPage() {
  const { user } = useAuth();
  const {
    status,
    queuedGame,
    waitingRoom,
    activeMatchId,
    joinMatchmaking,
    cancelMatchmaking,
    createPrivateRoom,
    joinPrivateRoom,
    cancelPrivateRoom,
  } = useSocket();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const paramGame = searchParams.get('game');
  const [selectedGame, setSelectedGame] = useState<GameType>(
    isValidGame(paramGame) ? paramGame : 'TICTACTOE'
  );
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [busyAction, setBusyAction] = useState<'queue' | 'create' | 'join' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isValidGame(paramGame)) {
      setSelectedGame(paramGame);
    }
  }, [paramGame]);

  const handleSelectGame = (game: GameType) => {
    setSelectedGame(game);
    setSearchParams({ game });
    setError(null);
  };

  const handleQuickMatch = async () => {
    setBusyAction('queue');
    setError(null);
    try {
      const res = await joinMatchmaking(selectedGame);
      if (res.status === 'MATCHED' && res.matchId) {
        navigate(`/match/${res.matchId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start matchmaking.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancelQueue = async () => {
    setBusyAction('cancel');
    setError(null);
    try {
      await cancelMatchmaking();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel queue.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateRoom = async () => {
    setBusyAction('create');
    setError(null);
    try {
      await createPrivateRoom(selectedGame);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create private room.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length < 6) {
      setError('Enter a valid 6-character room code.');
      return;
    }
    setBusyAction('join');
    setError(null);
    try {
      const res = await joinPrivateRoom(cleaned);
      navigate(`/match/${res.matchId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join room.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancelRoom = async () => {
    if (!waitingRoom) return;
    setBusyAction('cancel');
    setError(null);
    try {
      await cancelPrivateRoom(waitingRoom.id, waitingRoom.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel room.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyCode = async () => {
    if (!waitingRoom) return;
    try {
      await navigator.clipboard.writeText(waitingRoom.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — please highlight and copy the room code manually.');
    }
  };

  const gameMeta = GAME_METADATA[selectedGame];
  const isConnected = status === 'connected';
  const controlsDisabled = !isConnected || Boolean(activeMatchId) || busyAction !== null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header & Real-Time Connection State */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Play Lobby</h1>
          <p className="mt-1 text-sm text-slate-400">
            Select a game mode, enter Quick Match, or share a Private Room code with a friend.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-300">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <span className="text-amber-300">
                {status === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Active Match Guard */}
      {activeMatchId && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Active Match in Progress
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              You can only participate in one live match at a time. Rejoin your current match to continue.
            </p>
          </div>
          <Link
            to={`/match/${activeMatchId}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 whitespace-nowrap shrink-0"
          >
            Resume Match
          </Link>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      )}

      {/* Waiting Room View (FR-ROOM-03, Section 10.3 E) */}
      {waitingRoom ? (
        <section className="rounded-xl border border-indigo-500/35 bg-[#101524] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <GameEmblem gameType={waitingRoom.gameType} className="h-12 w-12" />
              <div>
                <p className="text-xs font-medium text-indigo-400">Private Waiting Room</p>
                <h2 className="font-display text-2xl font-bold text-white">
                  {GAME_METADATA[waitingRoom.gameType].name}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelRoom}
              disabled={busyAction === 'cancel'}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#161D31] px-4 py-2 text-sm font-medium text-slate-200 hover:bg-rose-500/15 hover:border-rose-500/40 hover:text-rose-200 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Cancel Room
            </button>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-12">
            {/* Room Code Block */}
            <div className="lg:col-span-6 space-y-4">
              <div>
                <span className="text-xs font-medium text-slate-400">Share this Room Code</span>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 rounded-xl border border-white/15 bg-[#080B14] px-5 py-4 text-center font-mono text-3xl font-bold tracking-[0.28em] text-white select-all">
                    {waitingRoom.code}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex h-16 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 whitespace-nowrap shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-400">
                Send this 6-character code to a friend. Once they enter it in their Play Lobby, both players automatically enter the match arena.
              </p>
              <p className="font-mono text-xs text-slate-500">
                Expires at {new Date(waitingRoom.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Player Slots */}
            <div className="lg:col-span-6 space-y-3">
              <span className="text-xs font-medium text-slate-400">Match Roster (1 / 2)</span>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#161D31] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar
                    avatarId={user?.avatar ?? waitingRoom.hostAvatar}
                    username={waitingRoom.hostUsername}
                    size="sm"
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {waitingRoom.hostUsername} (You)
                    </div>
                    <div className="text-xs text-indigo-300">Player 1 · Host</div>
                  </div>
                </div>
                <span className="text-xs font-medium text-emerald-400">Ready</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-dashed border-white/15 bg-[#0C111E] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#101524]">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-300">Waiting for opponent...</div>
                    <div className="text-xs text-slate-500">Player 2 slot open</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : queuedGame ? (
        /* Active Matchmaking Search View (FR-LOBBY-06, FR-MM-04) */
        <section className="rounded-xl border border-cyan-500/35 bg-[#101524] p-8 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-4">
            <GameEmblem gameType={queuedGame} className="h-14 w-14" />
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-cyan-300">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="text-xs font-semibold">Searching Live Queue</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-white">
                Finding a {GAME_METADATA[queuedGame].name} Opponent
              </h2>
              <p className="text-sm text-slate-400">
                Stay on this page or browse DuelZone — you will enter the match automatically as soon as an opponent joins the queue.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelQueue}
              disabled={busyAction === 'cancel'}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#161D31] px-5 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-rose-500/15 hover:border-rose-500/40 disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Cancel Search
            </button>
          </div>
        </section>
      ) : (
        /* Main Game Selector & Play Mode Controls */
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left: Select Game */}
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300">1. Select Game</h2>
            <div className="space-y-3" role="radiogroup" aria-label="Select a game">
              {GAMES.map((gameId) => {
                const meta = GAME_METADATA[gameId];
                const selected = selectedGame === gameId;
                return (
                  <button
                    key={gameId}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleSelectGame(gameId)}
                    className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? 'border-indigo-400 bg-[#161D31]'
                        : 'border-white/10 bg-[#101524] hover:border-white/25'
                    }`}
                  >
                    <GameEmblem gameType={gameId} className="h-11 w-11 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-base font-semibold text-white">
                          {meta.name}
                        </span>
                        <span className="font-mono text-xs text-slate-400">{meta.avgDuration}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{meta.formatLabel}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                        {meta.shortDescription}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Match Modes & Rules */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-xl border border-white/10 bg-[#101524] p-6">
              <div className="flex items-center gap-3">
                <GameEmblem gameType={selectedGame} className="h-10 w-10" />
                <div>
                  <h2 className="font-display text-xl font-bold text-white">{gameMeta.name}</h2>
                  <p className="text-xs text-slate-400">
                    {gameMeta.formatLabel} · Win +30 XP · Draw +15 XP · Loss +10 XP
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-slate-300">
                {gameMeta.rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="font-mono text-xs text-indigo-400 mt-0.5">0{idx + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>

              {/* Quick Match & Create Private Room Actions */}
              <div className="mt-6 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleQuickMatch}
                  disabled={controlsDisabled}
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40 whitespace-nowrap"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {busyAction === 'queue' ? 'Entering Queue...' : 'Quick Match'}
                </button>

                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={controlsDisabled}
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#161D31] px-5 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-indigo-400/50 hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
                >
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {busyAction === 'create' ? 'Creating Room...' : 'Create Private Room'}
                </button>
              </div>
            </div>

            {/* Join Existing Private Room by Code */}
            <div className="rounded-xl border border-white/10 bg-[#101524] p-6">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold text-white">
                  Join a Friend&apos;s Private Room
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Enter the 6-character room code shared by the host. Works for any of the three games.
              </p>

              <form onSubmit={handleJoinRoom} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  maxLength={10}
                  placeholder="Enter code (e.g. K7M4QX)"
                  aria-label="Private room code"
                  className="flex-1 rounded-lg border border-white/10 bg-[#080B14] px-4 py-2.5 font-mono text-base uppercase tracking-widest text-white placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder-slate-500 focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={controlsDisabled || joinCode.trim().length < 6}
                  className="rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  {busyAction === 'join' ? 'Joining...' : 'Join Room'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
