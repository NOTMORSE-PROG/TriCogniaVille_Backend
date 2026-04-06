import { z } from "zod";

// ── Auth Validators ──

export const registerSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email too long")
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password too long"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .trim(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required"),
});

export const teacherLoginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

// ── Profile Validators ──

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  readingLevel: z.number().int().min(1).max(4).optional(),
  onboardingDone: z.boolean().optional(),
});

// ── Sync Validators ──

export const questAttemptSchema = z.object({
  questId: z.string().min(1).max(100),
  buildingId: z.string().min(1).max(100),
  passed: z.boolean(),
  attempts: z.number().int().min(1).max(100).default(1),
  completedAt: z.string().datetime().optional(),
});

export const buildingStateSchema = z.object({
  buildingId: z.string().min(1).max(100),
  unlocked: z.boolean(),
  unlockedAt: z.string().datetime().optional(),
});

export const syncSchema = z.object({
  questAttempts: z.array(questAttemptSchema).max(100).default([]),
  buildingStates: z.array(buildingStateSchema).max(50).default([]),
  xp: z.number().int().min(0).optional(),
  streakDays: z.number().int().min(0).optional(),
  readingLevel: z.number().int().min(1).max(4).optional(),
  onboardingDone: z.boolean().optional(),
});

// ── Class Validators ──

export const createClassSchema = z.object({
  name: z.string().min(1, "Class name is required").max(100).trim(),
});

export const joinClassSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required").max(20).trim(),
});

// ── Error Response Helper ──

export function formatZodError(error: z.ZodError) {
  return {
    error: "Validation failed",
    code: "VALIDATION_ERROR",
    status: 400,
    details: error.issues.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    })),
  };
}
