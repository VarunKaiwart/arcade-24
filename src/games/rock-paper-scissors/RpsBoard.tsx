import type { MatchPlayer, RpsChoice, RpsState } from '../../../shared/types.ts';

interface RpsBoardProps {
  state: RpsState;
  players: MatchPlayer[];
  currentUserId: string;
  disabled: boolean;
  onSubmitChoice: (choice: RpsChoice) => void;
}

const CHOICES: ReadonlyArray<{ id: RpsChoice; label: string; beats: string }> = [
  { id: 'ROCK', label: 'Rock', beats: 'Crushes Scissors' },
  { id: 'PAPER', label: 'Paper', beats: 'Covers Rock' },
  { id: 'SCISSORS', label: 'Scissors', beats: 'Cuts Paper' },
];

function ChoiceGlyph({ choice, className = 'h-10 w-10' }: { choice: RpsChoice | null; className?: string }) {
  if (choice === 'ROCK') {
    return (
      <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
        <polygon points="15,12 33,10 41,23 34,38 14,38 8,24" fill="#6366F122" stroke="#818CF8" strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M16 22L24 18L32 23" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (choice === 'PAPER') {
    return (
      <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
        <path d="M14 9H30L37 16V39H14V9Z" fill="#06B6D422" stroke="#22D3EE" strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M29 9V17H37" stroke="#22D3EE" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M19 24H31M19 30H28" stroke="#67E8F9" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (choice === 'SCISSORS') {
    return (
      <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
        <circle cx="15" cy="34" r="5" stroke="#60A5FA" strokeWidth="2.6" fill="#3B82F622" />
        <circle cx="33" cy="34" r="5" stroke="#60A5FA" strokeWidth="2.6" fill="#3B82F622" />
        <path d="M18 30L33 11M30 30L15 11" stroke="#60A5FA" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="14" stroke="#475569" strokeWidth="2.2" strokeDasharray="4 4" />
      <text x="24" y="29" textAnchor="middle" fill="#64748B" fontSize="16" fontWeight="600">
        ?
      </text>
    </svg>
  );
}

export function RpsBoard({
  state,
  players,
  currentUserId,
  disabled,
  onSubmitChoice,
}: RpsBoardProps) {
  const opponent = players.find((p) => p.userId !== currentUserId) ?? players[0];
  const myScore = state.scores[currentUserId] ?? 0;
  const oppScore = opponent ? state.scores[opponent.userId] ?? 0 : 0;

  const mySubmitted = Boolean(state.submittedBy[currentUserId]);
  const oppSubmitted = opponent ? Boolean(state.submittedBy[opponent.userId]) : false;

  const myChoice = state.revealedChoices[currentUserId] ?? null;
  const oppChoice = opponent ? state.revealedChoices[opponent.userId] ?? null : null;

  const canChoose =
    !disabled &&
    state.status === 'IN_PROGRESS' &&
    state.phase === 'WAITING_FOR_CHOICES' &&
    !mySubmitted;

  const isRevealing = state.phase === 'ROUND_REVEAL' || state.phase === 'COMPLETED';
  const lastRound = state.lastRound;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Scoreboard */}
      <div className="grid w-full max-w-lg grid-cols-3 items-center rounded-xl border border-white/10 bg-[#161D31] px-5 py-4 text-center">
        <div>
          <div className="text-xs text-slate-400">You</div>
          <div className="mt-1 font-mono text-3xl font-bold text-indigo-300 tabular-nums">
            {myScore}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {isRevealing ? myChoice ?? 'No pick' : mySubmitted ? 'Locked in' : 'Choosing...'}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-400">Round {state.roundNumber}</div>
          <div className="font-display text-sm font-semibold text-slate-200">
            First to {state.targetWins}
          </div>
          <div className="text-xs text-slate-500">
            {state.phase === 'WAITING_FOR_CHOICES'
              ? 'Blind pick'
              : state.phase === 'ROUND_REVEAL'
                ? 'Round reveal'
                : 'Match final'}
          </div>
        </div>

        <div>
          <div className="truncate text-xs text-slate-400">{opponent?.username ?? 'Opponent'}</div>
          <div className="mt-1 font-mono text-3xl font-bold text-cyan-300 tabular-nums">
            {oppScore}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {isRevealing ? oppChoice ?? 'No pick' : oppSubmitted ? 'Locked in' : 'Choosing...'}
          </div>
        </div>
      </div>

      {/* Arena Clash Reveal Stage */}
      <div className="flex w-full max-w-lg items-center justify-around rounded-xl border border-white/10 bg-[#0C111E] px-6 py-6">
        <div className="flex flex-col items-center gap-2">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-xl border ${
              mySubmitted ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-white/10 bg-[#101524]'
            }`}
          >
            <ChoiceGlyph choice={myChoice} className="h-12 w-12" />
          </div>
          <span className="text-xs font-medium text-slate-300">
            {myChoice ?? (mySubmitted ? 'Locked' : 'Your Pick')}
          </span>
        </div>

        <div className="text-center">
          <div className="font-display text-sm font-semibold text-slate-400">VS</div>
          {isRevealing && lastRound && (
            <div className="mt-1 text-xs font-semibold">
              {lastRound.isDraw ? (
                <span className="text-cyan-300">Round Tied</span>
              ) : lastRound.winnerUserId === currentUserId ? (
                <span className="text-emerald-400">Round Won</span>
              ) : (
                <span className="text-rose-400">Round Lost</span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-xl border ${
              isRevealing && oppChoice
                ? 'border-cyan-400/50 bg-cyan-500/10'
                : oppSubmitted
                  ? 'border-cyan-500/35 bg-cyan-500/5'
                  : 'border-white/10 bg-[#101524]'
            }`}
          >
            <ChoiceGlyph choice={isRevealing ? oppChoice : null} className="h-12 w-12" />
          </div>
          <span className="text-xs font-medium text-slate-300">
            {isRevealing
              ? oppChoice ?? 'Timed out'
              : oppSubmitted
                ? 'Hidden (Locked)'
                : 'Waiting...'}
          </span>
        </div>
      </div>

      {/* Choice Selector Buttons */}
      <div className="grid w-full max-w-lg grid-cols-3 gap-3">
        {CHOICES.map((opt) => {
          const selected = myChoice === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={!canChoose}
              onClick={() => canChoose && onSubmitChoice(opt.id)}
              aria-pressed={selected}
              className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-all duration-150 ${
                selected
                  ? 'border-indigo-400 bg-indigo-600/20 text-white'
                  : canChoose
                    ? 'border-white/15 bg-[#101524] text-slate-200 hover:border-indigo-400/60 hover:bg-[#161D31] cursor-pointer active:scale-[0.98]'
                    : 'border-white/10 bg-[#101524]/60 text-slate-500 cursor-not-allowed'
              }`}
            >
              <ChoiceGlyph choice={opt.id} className="h-10 w-10" />
              <span className="font-display text-sm font-semibold">{opt.label}</span>
              <span className="text-[11px] text-slate-400">{opt.beats}</span>
            </button>
          );
        })}
      </div>

      {/* Round History Strip */}
      {state.roundHistory.length > 0 && (
        <div className="w-full max-w-lg border-t border-white/10 pt-3">
          <div className="mb-2 text-xs font-medium text-slate-400">Round Log</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-300">
            {state.roundHistory.map((r) => {
              const mine = r.choices[currentUserId] ?? '—';
              const theirs = opponent ? r.choices[opponent.userId] ?? '—' : '—';
              const tag = r.isDraw ? 'Tie' : r.winnerUserId === currentUserId ? 'Win' : 'Loss';
              const tagColor = r.isDraw
                ? 'text-cyan-300'
                : r.winnerUserId === currentUserId
                  ? 'text-emerald-400'
                  : 'text-rose-400';
              return (
                <span key={r.roundNumber} className="font-mono tabular-nums">
                  R{r.roundNumber}: {mine[0]} vs {theirs[0]}{' '}
                  <span className={tagColor}>({tag})</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
