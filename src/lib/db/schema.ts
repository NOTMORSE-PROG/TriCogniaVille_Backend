import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  serial,
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("students_email_idx").on(table.email),
    uniqueIndex("students_google_id_idx").on(table.googleId),
  ]
);

// ── Classes ──
export const classes = pgTable("classes", {
  id: uuid("id").defaultRandom().primaryKey(),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => teachers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Class-Student Many-to-Many ──
export const classStudents = pgTable(
  "class_students",
  {
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.classId, table.studentId] })]
);

// ── Quest Attempts ──
export const questAttempts = pgTable("quest_attempts", {
  id: serial("id").primaryKey(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  questId: text("quest_id").notNull(),
  buildingId: text("building_id").notNull(),
  passed: boolean("passed").notNull(),
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
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.buildingId] })]
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

// ── Relations ──
export const teachersRelations = relations(teachers, ({ many }) => ({
  classes: many(classes),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  classStudents: many(classStudents),
  questAttempts: many(questAttempts),
  buildingStates: many(buildingStates),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  teacher: one(teachers, {
    fields: [classes.teacherId],
    references: [teachers.id],
  }),
  classStudents: many(classStudents),
}));

export const classStudentsRelations = relations(classStudents, ({ one }) => ({
  class: one(classes, {
    fields: [classStudents.classId],
    references: [classes.id],
  }),
  student: one(students, {
    fields: [classStudents.studentId],
    references: [students.id],
  }),
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
