-- Add score and total_items to quest_attempts (sent by Godot client but previously dropped)
ALTER TABLE "quest_attempts" ADD COLUMN "score" integer;
--> statement-breakpoint
ALTER TABLE "quest_attempts" ADD COLUMN "total_items" integer;
--> statement-breakpoint
-- New story_progress table: persists per-student per-building narrative flags
CREATE TABLE "story_progress" (
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "building_id" text NOT NULL,
  "prologue_seen" boolean NOT NULL DEFAULT false,
  "intro_seen" boolean NOT NULL DEFAULT false,
  "outro_seen" boolean NOT NULL DEFAULT false,
  "ending_seen" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("student_id", "building_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_progress_student_id_idx" ON "story_progress" ("student_id");
