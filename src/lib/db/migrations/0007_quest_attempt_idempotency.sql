-- Idempotent retry support for POST /api/v1/quests.
-- The Godot client now generates a UUIDv4 attempt_id once per quest run and
-- reuses it on retries; the backend uses ON CONFLICT (attempt_id) DO NOTHING
-- to safely deduplicate without double-crediting XP.
--
-- Existing rows get a fresh random UUID so the unique constraint is satisfied
-- on the historic data — those rows can never be "retried" anyway since the
-- old client never sent attempt_id.

ALTER TABLE quest_attempts ADD COLUMN attempt_id uuid;
UPDATE quest_attempts SET attempt_id = gen_random_uuid() WHERE attempt_id IS NULL;
ALTER TABLE quest_attempts ALTER COLUMN attempt_id SET NOT NULL;
CREATE UNIQUE INDEX quest_attempts_attempt_id_key ON quest_attempts(attempt_id);
