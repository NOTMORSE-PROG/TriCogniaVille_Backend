import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  serial,
  real,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Teachers ──
export const teachers = pgTable("teachers", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Students ──
export const students = pgTable(
  "students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"), // null if Google-only user
    googleId: text("google_id"), // null if email-only user
    name: text("name").notNull(),
    readingLevel: integer("reading_level").default(1).notNull(),
    xp: integer("xp").default(0).notNull(),
    streakDays: integer("streak_days").default(0).notNull(),
    lastActive: timestamp("last_active", { withTimezone: true }),
    onboardingDone: boolean("onboarding_done").default(false).notNull(),
    username: text("username"),
    characterGender: text("character_gender").default("male"),
    tutorialDone: boolean("tutorial_done").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("students_email_idx").on(table.email),
    uniqueIndex("students_google_id_idx").on(table.googleId),
  ]
);

// ── Quest Attempts ──
export const questAttempts = pgTable("quest_attempts", {
  id: serial("id").primaryKey(),
  // Client-generated UUID for idempotent retries. Unique constraint added in
  // migration 0007 — `INSERT ... ON CONFLICT (attempt_id) DO NOTHING` lets the
  // backend safely deduplicate retried POSTs without double-crediting XP.
  attemptId: uuid("attempt_id").notNull().unique(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  questId: text("quest_id").notNull(),
  buildingId: text("building_id").notNull(),
  passed: boolean("passed").notNull(),
  score: integer("score"),
  totalItems: integer("total_items"),
  attempts: integer("attempts").default(1).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Building States ──
export const buildingStates = pgTable(
  "building_states",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    buildingId: text("building_id").notNull(),
    unlocked: boolean("unlocked").default(false).notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    tutorialDone: boolean("tutorial_done").default(false).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.buildingId] })]
);

// ── Story Progress ──
export const storyProgress = pgTable(
  "story_progress",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    buildingId: text("building_id").notNull(),
    prologueSeen: boolean("prologue_seen").notNull().default(false),
    introSeen: boolean("intro_seen").notNull().default(false),
    outroSeen: boolean("outro_seen").notNull().default(false),
    endingSeen: boolean("ending_seen").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.buildingId] })]
);

// ── Badges (definitions, seeded once) ──
export const badges = pgTable("badges", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // "building"|"streak"|"xp"|"quest"|"level"
  icon: text("icon").notNull(),
  requirement: text("requirement").notNull(),
  requirementValue: integer("requirement_value"),
  requirementKey: text("requirement_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Student Badges (earned records) ──
export const studentBadges = pgTable(
  "student_badges",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    badgeId: text("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    earnedAt: timestamp("earned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.badgeId] })]
);

// ── Google OAuth Pending Codes (for Godot polling flow) ──
export const oauthPendingCodes = pgTable("oauth_pending_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  studentId: uuid("student_id").references(() => students.id),
  token: text("token"), // JWT set after OAuth completes
  status: text("status").notNull().default("pending"), // pending | completed | expired
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Failed Login Attempts (brute force protection) ──
export const failedLoginAttempts = pgTable("failed_login_attempts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  ipAddress: text("ip_address"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Speech Assessments ──
export const speechAssessments = pgTable("speech_assessments", {
  id: serial("id").primaryKey(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  questId: text("quest_id").notNull(),
  buildingId: text("building_id").notNull(),
  stage: text("stage").notNull(), // tutorial | practice | mission
  expectedText: text("expected_text").notNull(),
  transcript: text("transcript"), // null if speech API unavailable
  confidence: real("confidence"), // Web Speech API confidence 0–1
  score: integer("score"), // 0–100
  feedback: text("feedback"),
  errorTypes: text("error_types"), // JSON array string e.g. '["omission","phonetic"]'
  audioUrl: text("audio_url"),
  flagReview: boolean("flag_review").default(false).notNull(),
  attemptNumber: integer("attempt_number").default(1).notNull(),
  teacherNote: text("teacher_note"),
  reviewedBy: uuid("reviewed_by").references(() => teachers.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Relations ──
export const teachersRelations = relations(teachers, ({ many }) => ({
  reviewedAssessments: many(speechAssessments),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  questAttempts: many(questAttempts),
  buildingStates: many(buildingStates),
  storyProgress: many(storyProgress),
  speechAssessments: many(speechAssessments),
  studentBadges: many(studentBadges),
}));

export const questAttemptsRelations = relations(questAttempts, ({ one }) => ({
  student: one(students, {
    fields: [questAttempts.studentId],
    references: [students.id],
  }),
}));

export const buildingStatesRelations = relations(buildingStates, ({ one }) => ({
  student: one(students, {
    fields: [buildingStates.studentId],
    references: [students.id],
  }),
}));

export const badgesRelations = relations(badges, ({ many }) => ({
  studentBadges: many(studentBadges),
}));

export const studentBadgesRelations = relations(studentBadges, ({ one }) => ({
  student: one(students, {
    fields: [studentBadges.studentId],
    references: [students.id],
  }),
  badge: one(badges, {
    fields: [studentBadges.badgeId],
    references: [badges.id],
  }),
}));

export const storyProgressRelations = relations(storyProgress, ({ one }) => ({
  student: one(students, {
    fields: [storyProgress.studentId],
    references: [students.id],
  }),
}));

export const speechAssessmentsRelations = relations(speechAssessments, ({ one }) => ({
  student: one(students, {
    fields: [speechAssessments.studentId],
    references: [students.id],
  }),
  reviewer: one(teachers, {
    fields: [speechAssessments.reviewedBy],
    references: [teachers.id],
  }),
}));
