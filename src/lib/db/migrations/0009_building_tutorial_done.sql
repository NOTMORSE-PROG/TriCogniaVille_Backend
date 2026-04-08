-- Track per-building tutorial completion. The tutorial stage is the guided,
-- non-graded warm-up shown before practice + mission. Once a student finishes
-- it for a building, the QuestPrompt unlocks "Skip to Challenge" on revisits
-- and shows a checkmark on the tutorial button.
--
-- Lives on building_states because that table is already keyed by
-- (student_id, building_id) and is hydrated on every profile fetch.

ALTER TABLE building_states
  ADD COLUMN IF NOT EXISTS tutorial_done boolean NOT NULL DEFAULT false;
