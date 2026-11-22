import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Flag, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import {
  GAME_METADATA,
  type ChatMessageDto,
  type ConnectFourState,
  type GameAction,
  type MatchSnapshot,
  type RpsChoice,
  type RpsState,
  type TicTacToeState,
  type XpAwardSummary,
} from '../../shared/types.ts';
import { Avatar } from '../components/common/Avatar.tsx';
import { GameEmblem } from '../components/common/GameEmblem.tsx';
import { ConfirmDialog, ErrorState, LoadingState } from '../components/common/StateViews.tsx';
import { ChatPanel } from '../components/game/ChatPanel.tsx';
import { GameTimer } from '../components/game/GameTimer.tsx';
import { MatchResultModal } from '../components/game/MatchResultModal.tsx';
import { ConnectFourBoard } from '../games/connect-four/ConnectFourBoard.tsx';
import { RpsBoard } from '../games/rock-paper-scissors/RpsBoard.tsx';
import { TicTacToeBoard } from '../games/tic-tac-toe/TicTacToeBoard.tsx';
import { api } from '../lib/api.ts';
import { soundFx } from '../lib/sound.ts';
import { useAuth } from '../providers/AuthProvider.tsx';
import { useSocket } from '../providers/SocketProvider.tsx';

function createActionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user, refreshStats } = useAuth();
  const { socket, status: socketStatus, emitWithAck, setActiveMatchId } = useSocket();

  const [match, setMatch] = useState<MatchSnapshot | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [xpAwards, setXpAwards] = useState<XpAwardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [forfeiting, setForfeiting] = useState(false);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [muted, setMuted] = useState(soundFx.isMuted());

  const latestVersionRef = useRef<number>(0);

  /**
   * Monotonic version guard (Section 12): ignores stale out-of-order snapshots.
   */
  const applySnapshot = useCallback((incoming: MatchSnapshot) => {
    setMatch((prev) => {
      if (prev && prev.id === incoming.id && incoming.version < latestVersionRef.current) {
        return prev;
      }
      latestVersionRef.current = incoming.version;
      return incoming;
    });
    if (incoming.xpAwards && incoming.xpAwards.length > 0) {
      setXpAwards(incoming.xpAwards);
    }
  }, []);

  const loadInitialMatch = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    setLoadError(null);
    latestVersionRef.current = 0;
    try {
      const data = await api.getMatch(matchId);
      applySnapshot(data.match);
      setMessages(data.messages);
      if (data.match.status === 'IN_PROGRESS' || data.match.status === 'READY') {
        setActiveMatchId(data.match.id);
      } else {
        setActiveMatchId(null);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load match.');
    } finally {
      setLoading(false);
    }
  }, [matchId, applySnapshot, setActiveMatchId]);

  useEffect(() => {
    void loadInitialMatch();
  }, [loadInitialMatch]);

  // Synchronize with Socket.io events & handle automatic reconnect recovery
  useEffect(() => {
    if (!socket || !matchId) return;

    const requestSync = () => {
      socket.emit(
        'match:reconnect',
        { matchId, lastKnownVersion: latestVersionRef.current },
        (res?: {
          success: boolean;
          data?: { snapshot: MatchSnapshot; messages: ChatMessageDto[] };
        }) => {
          if (res?.success && res.data) {
            applySnapshot(res.data.snapshot);
            setMessages(res.data.messages);
          }
        }
      );
    };

    if (socket.connected) {
      requestSync();
    }

    const onConnect = () => requestSync();

    const onGameState = (payload: { matchId: string; snapshot?: MatchSnapshot }) => {
      if (payload.matchId !== matchId || !payload.snapshot) return;
      applySnapshot(payload.snapshot);
      setActionError(null);
    };

    const onMatchCompleted = (payload: {
      matchId: string;
      xpAwards?: XpAwardSummary[];
      snapshot?: MatchSnapshot;
    }) => {
      if (payload.matchId !== matchId) return;
      if (payload.snapshot) {
        applySnapshot(payload.snapshot);
      }
      if (payload.xpAwards) {
        setXpAwards(payload.xpAwards);
      }
      setActiveMatchId(null);
      void refreshStats();

      if (payload.snapshot && user) {
        if (payload.snapshot.result === 'DRAW') {
          soundFx.playDraw();
        } else if (payload.snapshot.winnerUserId === user.id) {
          soundFx.playWin();
        } else {
          soundFx.playLoss();
        }
      }
    };

    const onOpponentDisconnected = (payload: {
      matchId?: string;
      userId: string;
      gracePeriodEndsAt: string;
    }) => {
      if (payload.matchId && payload.matchId !== matchId) return;
      setMatch((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          disconnectedPlayers: {
            ...prev.disconnectedPlayers,
            [payload.userId]: payload.gracePeriodEndsAt,
          },
        };
      });
    };

    const onOpponentReconnected = (payload: { matchId?: string; userId: string }) => {
      if (payload.matchId && payload.matchId !== matchId) return;
      setMatch((prev) => {
        if (!prev) return prev;
        const nextDisc = { ...prev.disconnectedPlayers };
        delete nextDisc[payload.userId];
        return { ...prev, disconnectedPlayers: nextDisc };
      });
    };

    const onRematchRequested = (payload: {
      matchId: string;
      requestedBy: string[];
    }) => {
      if (payload.matchId !== matchId) return;
      setMatch((prev) => (prev ? { ...prev, rematchRequestedBy: payload.requestedBy } : prev));
    };

    const onChatMessage = (payload: { matchId?: string; chatMessage?: ChatMessageDto }) => {
      if (!payload.chatMessage || payload.chatMessage.matchId !== matchId) return;
      const incoming = payload.chatMessage;
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
    };

    const onGameError = (payload: { message?: string }) => {
      if (payload.message) {
        setActionError(payload.message);
      }
    };

    socket.on('connect', onConnect);
    socket.on('game:state', onGameState);
    socket.on('match:completed', onMatchCompleted);
    socket.on('match:opponent-disconnected', onOpponentDisconnected);
    socket.on('match:opponent-reconnected', onOpponentReconnected);
    socket.on('match:rematch-requested', onRematchRequested);
    socket.on('chat:message', onChatMessage);
    socket.on('game:error', onGameError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('game:state', onGameState);
      socket.off('match:completed', onMatchCompleted);
      socket.off('match:opponent-disconnected', onOpponentDisconnected);
      socket.off('match:opponent-reconnected', onOpponentReconnected);
      socket.off('match:rematch-requested', onRematchRequested);
      socket.off('chat:message', onChatMessage);
      socket.off('game:error', onGameError);
    };
  }, [socket, matchId, applySnapshot, setActiveMatchId, refreshStats, user]);

  const sendAction = async (action: GameAction) => {
    if (!match || !user || submittingAction || socketStatus !== 'connected') return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await emitWithAck<{ snapshot: MatchSnapshot }>('game:action', {
        matchId: match.id,
        actionId: createActionId(),
        action,
      });
      if (action.type === 'PLACE_MARK') soundFx.playMove();
      else if (action.type === 'DROP_TOKEN') soundFx.playDrop();
      else if (action.type === 'SUBMIT_CHOICE') soundFx.playLockIn();

      if (res?.snapshot) {
        applySnapshot(res.snapshot);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Move rejected by server.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleForfeit = async () => {
    if (!match) return;
    setForfeiting(true);
    setActionError(null);
    try {
      await emitWithAck('match:forfeit', { matchId: match.id });
      setForfeitOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to forfeit match.');
    } finally {
      setForfeiting(false);
    }
  };

  const handleRequestRematch = async () => {
    if (!match) return;
    setRematchLoading(true);
    setActionError(null);
    try {
      const res = await emitWithAck<{ requestedBy: string[]; newMatchId: string | null }>(
        'match:rematch-request',
        { matchId: match.id }
      );
      if (res.newMatchId) {
        navigate(`/match/${res.newMatchId}`);
      } else {
        setMatch((prev) => (prev ? { ...prev, rematchRequestedBy: res.requestedBy } : prev));
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to request rematch.');
    } finally {
      setRematchLoading(false);
    }
  };

  const handleSendChat = async (message: string) => {
    if (!match) return;
    await emitWithAck('chat:send', { matchId: match.id, message });
  };

  const toggleMute = () => {
    const next = !muted;
    soundFx.setMuted(next);
    setMuted(next);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <LoadingState label="Synchronizing match state..." />
      </div>
    );
  }

  if (loadError || !match || !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <ErrorState
          title="Unable to load match"
          message={loadError || 'Match could not be found or you are not authorized to view it.'}
          onRetry={() => void loadInitialMatch()}
        />
        <div className="mt-4 text-center">
          <Link to="/play" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
            ← Return to Play Lobby
          </Link>
        </div>
      </div>
    );
  }

  const gameMeta = GAME_METADATA[match.gameType];
  const isFinished = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const opponent = match.players.find((p) => p.userId !== user.id) ?? match.players[0];
  const me = match.players.find((p) => p.userId === user.id) ?? match.players[0];
  const opponentDisconnectDeadline = opponent ? match.disconnectedPlayers[opponent.userId] : undefined;

  const activeDeadline = isFinished
    ? null
    : match.gameType === 'RPS'
      ? (match.state as RpsState).deadlineAt
      : 'turnDeadlineAt' in match.state
        ? match.state.turnDeadlineAt
        : null;

  const turnBanner = isFinished
    ? match.result === 'DRAW'
      ? 'Match Finished · Draw'
      : match.result === 'ABANDONED'
        ? 'Match Abandoned'
        : match.winnerUserId === user.id
          ? 'Match Finished · You Won'
          : `Match Finished · ${opponent?.username ?? 'Opponent'} Won`
    : match.gameType === 'RPS'
      ? (match.state as RpsState).phase === 'ROUND_REVEAL'
        ? 'Round Resolved · Preparing Next Round'
        : (match.state as RpsState).submittedBy[user.id]
          ? `Choice Locked · Waiting for ${opponent?.username ?? 'Opponent'}`
          : 'Lock in your choice before the timer expires'
      : match.currentTurnUserId === user.id
        ? 'Your Turn'
        : `${opponent?.username ?? 'Opponent'}'s Turn`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Top Match HUD */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-[#101524] px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <GameEmblem gameType={match.gameType} className="h-10 w-10 shrink-0" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-lg font-bold text-white">{gameMeta.name}</h1>
              <span className="text-xs text-slate-400">
                · {match.mode === 'PRIVATE' ? 'Private Room' : 'Quick Match'}
              </span>
            </div>
            <p className="text-xs text-slate-400">{turnBanner}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeDeadline && (
            <GameTimer
              deadlineAt={activeDeadline}
              label={match.gameType === 'RPS' ? 'Round' : 'Turn'}
            />
          )}

          <div className="flex items-center gap-1.5 text-xs">
            {socketStatus === 'connected' ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span className="text-slate-300">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <span className="text-amber-300">Reconnecting</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute game audio' : 'Mute game audio'}
            title={muted ? 'Unmute sound' : 'Mute sound'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#161D31] text-slate-300 hover:bg-slate-800"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {!isFinished && (
            <button
              type="button"
              onClick={() => setForfeitOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 whitespace-nowrap shrink-0"
            >
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              Forfeit
            </button>
          )}
        </div>
      </div>

      {/* Opponent Disconnected Grace Period Notice */}
      {!isFinished && opponentDisconnectDeadline && opponent && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <span>
              {opponent.username} disconnected. Waiting for them to reconnect before forfeit is awarded.
            </span>
          </div>
          <GameTimer deadlineAt={opponentDisconnectDeadline} label="Grace" />
        </div>
      )}

      {/* Match Result Summary Banner */}
      {isFinished && (
        <MatchResultModal
          match={match}
          currentUserId={user.id}
          xpAwards={xpAwards.length > 0 ? xpAwards : match.xpAwards ?? []}
          rematchLoading={rematchLoading}
          onRequestRematch={() => void handleRequestRematch()}
          onReturnToLobby={() => navigate('/play')}
        />
      )}

      {/* Main Match Arena + Chat Split */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-5">
          {/* Player Vs Opponent Strip */}
          <div className="grid grid-cols-2 gap-3">
            {[me, opponent].map((p) => {
              if (!p) return null;
              const isTurn = !isFinished && match.currentTurnUserId === p.userId;
              const isDisc = Boolean(match.disconnectedPlayers[p.userId]);
              let roleLabel = '';
              if (match.gameType === 'TICTACTOE') {
                roleLabel = `Symbol: ${(match.state as TicTacToeState).playerSymbols[p.userId] ?? ''}`;
              } else if (match.gameType === 'CONNECT_FOUR') {
                const col = (match.state as ConnectFourState).playerColors[p.userId];
                roleLabel = col === 'RED' ? 'Crimson Red' : 'Solar Yellow';
              } else {
                roleLabel = `Score: ${(match.state as RpsState).scores[p.userId] ?? 0} / 3`;
              }

              return (
                <div
                  key={p.userId}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    isTurn
                      ? 'border-indigo-400/70 bg-[#161D31]'
                      : 'border-white/10 bg-[#101524]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar avatarId={p.avatar} username={p.username} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {p.username}
                        {p.userId === user.id ? ' (You)' : ''}
                      </div>
                      <div className="text-xs text-slate-400">
                        {roleLabel}
                        {isDisc ? ' · Offline' : ''}
                      </div>
                    </div>
                  </div>
                  {isTurn && (
                    <span className="text-xs font-semibold text-indigo-300 whitespace-nowrap shrink-0">
                      Active
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {actionError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200"
            >
              {actionError}
            </div>
          )}

          {/* Game Board Container */}
          <div className="rounded-xl border border-white/10 bg-[#101524] p-6 sm:p-8">
            {match.gameType === 'TICTACTOE' && (
              <TicTacToeBoard
                state={match.state as TicTacToeState}
                currentUserId={user.id}
                disabled={isFinished || submittingAction || socketStatus !== 'connected'}
                onPlaceMark={(index) => void sendAction({ type: 'PLACE_MARK', index })}
              />
            )}

            {match.gameType === 'RPS' && (
              <RpsBoard
                state={match.state as RpsState}
                players={match.players}
                currentUserId={user.id}
                disabled={isFinished || submittingAction || socketStatus !== 'connected'}
                onSubmitChoice={(choice: RpsChoice) =>
                  void sendAction({ type: 'SUBMIT_CHOICE', choice })
                }
              />
            )}

            {match.gameType === 'CONNECT_FOUR' && (
              <ConnectFourBoard
                state={match.state as ConnectFourState}
                currentUserId={user.id}
                disabled={isFinished || submittingAction || socketStatus !== 'connected'}
                onDropToken={(column) => void sendAction({ type: 'DROP_TOKEN', column })}
              />
            )}
          </div>
        </div>

        {/* Authorized In-Game Chat */}
        <div className="lg:col-span-4">
          <ChatPanel
            messages={messages}
            currentUserId={user.id}
            disabled={socketStatus !== 'connected'}
            onSend={handleSendChat}
          />
        </div>
      </div>

      <ConfirmDialog
        open={forfeitOpen}
        title="Forfeit this match?"
        description="Forfeiting immediately awards the victory to your opponent. You will receive standard match completion XP (+10 XP) and a loss will be recorded."
        confirmLabel="Confirm Forfeit"
        cancelLabel="Keep Playing"
        destructive
        loading={forfeiting}
        onConfirm={() => void handleForfeit()}
        onCancel={() => setForfeitOpen(false)}
      />
    </div>
  );
}
