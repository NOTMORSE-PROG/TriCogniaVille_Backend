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
  readingLevel: z.number().int().min(1).max(3).optional(),
  onboardingDone: z.boolean().optional(),
  username: z.string().min(2).max(50).trim().optional(),
  characterGender: z.enum(["male", "female"]).optional(),
  tutorialDone: z.boolean().optional(),
});

// ── Quest / Story / Onboarding Validators ──

/**
 * Quest attempt body. The client generates `attemptId` (UUID v4) once per
 * quest run and reuses it on retries — backend uses this for idempotency.
 * `passed` is intentionally NOT accepted; the server recomputes it from
 * (buildingId, score, totalItems) using `quest-config.ts`.
 */
export const questAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  questId: z.string().min(1).max(100),
  buildingId: z.string().min(1).max(100),
  score: z.number().int().min(0).max(100),
  totalItems: z.number().int().min(0).max(100),
  attempts: z.number().int().min(1).max(100).default(1),
  completedAt: z.string().datetime().optional(),
});

export const storyProgressSingleSchema = z.object({
  // Empty string is valid — prologue/ending flags are "global" (no building).
  buildingId: z.string().max(50),
  flag: z.enum(["prologueSeen", "introSeen", "outroSeen", "endingSeen"]),
});

export const onboardingCompleteSchema = z.object({
  username: z.string().min(1).max(40).trim(),
  characterGender: z.enum(["male", "female"]),
  readingLevel: z.number().int().min(1).max(3),
});

// ── Speech Validators ──

export const speechAssessSchema = z.object({
  questId: z.string().min(1).max(100),
  buildingId: z.string().min(1).max(100),
  stage: z.enum(["tutorial", "practice", "mission"]),
  expectedText: z.string().min(1).max(2000),
  transcript: z.string().max(2000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  score: z.number().int().min(0).max(100),
  feedback: z.string().max(2000).optional(),
  errorTypes: z.array(z.string()).optional(),
  flagReview: z.boolean(),
  attemptNumber: z.number().int().min(1).max(10).optional(),
  audioUrl: z.string().url().max(500).optional(),
});

export const speechReviewSchema = z.object({
  teacherNote: z.string().max(1000).optional(),
  flagReview: z.boolean().optional(),
  scoreOverride: z.number().int().min(0).max(100).optional(),
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
