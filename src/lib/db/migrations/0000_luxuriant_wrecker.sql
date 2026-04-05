CREATE TABLE "building_states" (
	"student_id" uuid NOT NULL,
	"building_id" text NOT NULL,
	"unlocked" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "building_states_student_id_building_id_pk" PRIMARY KEY("student_id","building_id")
);
--> statement-breakpoint
CREATE TABLE "class_students" (
	"class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_students_class_id_student_id_pk" PRIMARY KEY("class_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"name" text NOT NULL,
	"invite_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classes_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "failed_login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip_address" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_pending_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"student_id" uuid,
	"token" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_pending_codes_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "quest_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" uuid NOT NULL,
	"quest_id" text NOT NULL,
	"building_id" text NOT NULL,
	"passed" boolean NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"google_id" text,
	"name" text NOT NULL,
	"reading_level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"last_active" timestamp with time zone,
	"onboarding_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teachers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "building_states" ADD CONSTRAINT "building_states_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_students" ADD CONSTRAINT "class_students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_students" ADD CONSTRAINT "class_students_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_pending_codes" ADD CONSTRAINT "oauth_pending_codes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_attempts" ADD CONSTRAINT "quest_attempts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "students_email_idx" ON "students" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "students_google_id_idx" ON "students" USING btree ("google_id");