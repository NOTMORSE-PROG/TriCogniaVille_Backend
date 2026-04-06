-- Performance indexes on high-frequency foreign key columns.
-- Without these, every per-student query (sync, progress, dashboard) does a full table scan.

CREATE INDEX IF NOT EXISTS "quest_attempts_student_id_idx" ON "quest_attempts" ("student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "speech_assessments_student_id_idx" ON "speech_assessments" ("student_id");
--> statement-breakpoint
-- building_states already has a composite PK (student_id, building_id) which covers
-- queries filtering on both columns, but add a standalone index for student-only filters.
CREATE INDEX IF NOT EXISTS "building_states_student_id_idx" ON "building_states" ("student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_badges_student_id_idx" ON "student_badges" ("student_id");
