import type { ProgressionRank } from './types.ts';

/**
 * Centralized progression configuration (FR-XP / Section 3.9).
 * XP-based ranks represent progression milestones, not skill/Elo ratings.
 */
export const XP_REWARDS = {
  WIN: 30,
  LOSS: 10,
  DRAW: 15,
} as const;

export interface RankThreshold {
  rank: ProgressionRank;
  minXp: number;
  maxXp: number | null;
  color: string;
}

export const RANK_THRESHOLDS: readonly RankThreshold[] = [
  { rank: 'Bronze', minXp: 0, maxXp: 499, color: '#CD7F32' },
  { rank: 'Silver', minXp: 500, maxXp: 1499, color: '#94A3B8' },
  { rank: 'Gold', minXp: 1500, maxXp: 2999, color: '#F59E0B' },
  { rank: 'Platinum', minXp: 3000, maxXp: 4999, color: '#38BDF8' },
  { rank: 'Diamond', minXp: 5000, maxXp: null, color: '#A78BFA' },
] as const;

/**
 * Level progression formula from project brief:
 * XP required to advance from level L to level L+1 = 500 * L
 *
 * Level 1: 0 .. 499 (needs 500 to reach Level 2)
 * Level 2: 500 .. 1499 (needs 1000 to reach Level 3)
 * Level 3: 1500 .. 2999 (needs 1500 to reach Level 4)
 */
export function calculateLevelProgress(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
} {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let remaining = safeXp;

  while (remaining >= 500 * level) {
    remaining -= 500 * level;
    level += 1;
  }

  return {
    level,
    currentLevelXp: remaining,
    nextLevelXp: 500 * level,
  };
}

export function calculateRank(totalXp: number): ProgressionRank {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let matched: ProgressionRank = 'Bronze';
  for (const tier of RANK_THRESHOLDS) {
    if (safeXp >= tier.minXp) {
      matched = tier.rank;
    }
  }
  return matched;
}

export function calculateWinRate(wins: number, totalMatches: number): number {
  if (totalMatches <= 0) return 0;
  return Math.round((wins / totalMatches) * 1000) / 10;
}
