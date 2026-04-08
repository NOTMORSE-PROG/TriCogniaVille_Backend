/**
 * Reading level (1-4) — used to gate quest difficulty and content variants.
 *
 * NOTE: This is DISTINCT from `levels.ts`, which computes the gamification
 * "player level" using a non-linear curve (100 * level^1.8) for badges/UI.
 *
 * Reading level uses the original Godot thresholds (100/250/500 XP) so
 * existing student data is preserved when the client moves to fully online.
 * See migration `0006_reconcile_reading_levels.sql`.
 */

export function readingLevelFromXp(xp: number): 1 | 2 | 3 | 4 {
  if (xp >= 500) return 4;
  if (xp >= 250) return 3;
  if (xp >= 100) return 2;
  return 1;
}
