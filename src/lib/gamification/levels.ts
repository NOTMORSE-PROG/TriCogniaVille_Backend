/**
 * XP level system — non-linear progression.
 * Level N requires Math.floor(100 * N^1.8) cumulative XP to reach.
 *   Level 1:  0 XP
 *   Level 2:  180 XP
 *   Level 3:  430 XP
 *   Level 4:  740 XP
 *   Level 5:  1,100 XP
 *   Level 6:  1,521 XP
 *
 * Pure math — no DB, safe to import in both server routes and client components.
 */

/** Cumulative XP required to reach level N. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level, 1.8));
}

export interface LevelInfo {
  level: number;
  currentLevelXp: number; // XP threshold to enter this level
  nextLevelXp: number;    // XP threshold to enter the next level
  progressXp: number;     // XP earned above the current level floor
  progressPct: number;    // 0–100 progress through current level
}

/** Compute level info from a student's total XP. */
export function getLevelInfo(totalXp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) {
    level++;
  }
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progressXp = totalXp - currentLevelXp;
  const rangeXp = nextLevelXp - currentLevelXp;
  return {
    level,
    currentLevelXp,
    nextLevelXp,
    progressXp,
    progressPct: Math.min(100, Math.floor((progressXp / rangeXp) * 100)),
  };
}
