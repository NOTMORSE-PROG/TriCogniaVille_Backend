-- Reconcile reading_level for existing students after the move to fully online.
-- The Godot client previously computed reading_level locally using thresholds
-- 100/250/500 XP. The backend used a different formula (100*level^1.8) which
-- would have demoted some students. This migration locks reading_level to the
-- Godot thresholds so no one is silently downgraded after the cutover.
--
-- See backend/src/lib/gamification/reading-level.ts for the canonical helper.

UPDATE students SET reading_level = CASE
  WHEN xp >= 500 THEN 4
  WHEN xp >= 250 THEN 3
  WHEN xp >= 100 THEN 2
  ELSE GREATEST(reading_level, 1)
END
WHERE onboarding_done = true;
