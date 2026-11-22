interface XpProgressProps {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  totalXp: number;
  compact?: boolean;
}

export function XpProgress({
  level,
  currentLevelXp,
  nextLevelXp,
  totalXp,
  compact = false,
}: XpProgressProps) {
  const pct = nextLevelXp > 0 ? Math.min(100, Math.round((currentLevelXp / nextLevelXp) * 100)) : 0;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-slate-200 tabular-nums">
          Level {level}
        </span>
        <span className="font-mono text-slate-400 tabular-nums">
          {compact
            ? `${totalXp.toLocaleString()} XP`
            : `${currentLevelXp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP to Level ${level + 1}`}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-800/90"
        role="progressbar"
        aria-valuenow={currentLevelXp}
        aria-valuemin={0}
        aria-valuemax={nextLevelXp}
        aria-label={`Level ${level} XP progress`}
      >
        <div
          className="h-full rounded-full bg-indigo-500 transition-transform duration-300 origin-left"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
