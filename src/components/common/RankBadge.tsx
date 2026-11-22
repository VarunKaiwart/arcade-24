import type { ProgressionRank } from '../../../shared/types.ts';
import { RANK_THRESHOLDS } from '../../../shared/progression.ts';

interface RankBadgeProps {
  rank: ProgressionRank;
  showLabel?: boolean;
  className?: string;
}

/**
 * Clean progression rank display without garish pill boxes.
 * Explicitly reflects XP progression tier (not skill/Elo rating).
 */
export function RankBadge({ rank, showLabel = false, className = '' }: RankBadgeProps) {
  const tier = RANK_THRESHOLDS.find((t) => t.rank === rank) ?? RANK_THRESHOLDS[0];

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${className}`}>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
        <polygon points="8,1 14,5 14,11 8,15 2,11 2,5" fill={tier.color} fillOpacity="0.22" stroke={tier.color} strokeWidth="1.4" />
        <polygon points="8,4.5 11,6.5 11,9.5 8,11.5 5,9.5 5,6.5" fill={tier.color} />
      </svg>
      <span style={{ color: tier.color }}>{rank}</span>
      {showLabel && <span className="text-xs text-slate-400">Progression Rank</span>}
    </span>
  );
}
