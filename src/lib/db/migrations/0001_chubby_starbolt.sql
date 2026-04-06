CREATE TABLE "speech_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" uuid NOT NULL,
	"quest_id" text NOT NULL,
	"building_id" text NOT NULL,
	"stage" text NOT NULL,
	"expected_text" text NOT NULL,
	"transcript" text,
	"confidence" real,
	"score" integer,
	"feedback" text,
	"error_types" text,
	"audio_url" text,
	"flag_review" boolean DEFAULT false NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"teacher_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "speech_assessments" ADD CONSTRAINT "speech_assessments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speech_assessments" ADD CONSTRAINT "speech_assessments_reviewed_by_teachers_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;