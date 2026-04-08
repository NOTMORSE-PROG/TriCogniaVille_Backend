/**
 * Daily streak computation. Called only from write endpoints that represent
 * actual gameplay activity (currently `POST /quests` and
 * `POST /onboarding/complete`). Read endpoints must NOT touch streak —
 * viewing your profile is not "activity".
 *
 * Timezone caveat: streak uses UTC days. The TriCognia rollout is in PH
 * (UTC+8); afternoon school sessions work correctly. The edge case is a
 * student playing past midnight UTC (8 AM PH next day) — they get the
 * streak bump a few hours "early", which is harmless.
 */

export function nextStreak(
  lastActive: Date | null,
  currentStreak: number
): number {
  if (!lastActive) return 1;
  const last = new Date(lastActive);
  const lastUtcDay = Date.UTC(
    last.getUTCFullYear(),
    last.getUTCMonth(),
    last.getUTCDate()
  );
  const now = new Date();
  const nowUtcDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const days = Math.floor((nowUtcDay - lastUtcDay) / 86400000);
  if (days <= 0) return Math.max(currentStreak, 1); // same UTC day
  if (days === 1) return currentStreak + 1;
  return 1;
}
