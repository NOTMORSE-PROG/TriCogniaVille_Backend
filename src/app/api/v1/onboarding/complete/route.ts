import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import {
  onboardingCompleteSchema,
  formatZodError,
} from "@/lib/api/validators";
import { conflict, internalError, notFound } from "@/lib/api/errors";
import { eq } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";
import { nextStreak } from "@/lib/gamification/streak";

/**
 * POST /api/v1/onboarding/complete
 *
 * Atomic onboarding finalize. Replaces the previous dual-write where the
 * Godot client wrote to SQLite first, then fired-and-forgot a PATCH /me.
 *
 * Body: { username, characterGender, readingLevel }
 *
 * Sets username/characterGender/readingLevel/onboardingDone in a single
 * UPDATE. Also bumps lastActive + streakDays so finishing onboarding counts
 * as a day-1 streak. Returns the updated student row. 409 if onboarding was
 * already completed (prevents accidental re-runs from rewriting the level).
 */
export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest, user: TokenPayload) => {
    try {
      const body = await req.json();
      const parsed = onboardingCompleteSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      const [existing] = await db
        .select({
          id: students.id,
          onboardingDone: students.onboardingDone,
          lastActive: students.lastActive,
          streakDays: students.streakDays,
        })
        .from(students)
        .where(eq(students.id, user.sub))
        .limit(1);

      if (!existing) return notFound("Student not found");
      if (existing.onboardingDone) {
        return conflict("Onboarding already completed");
      }

      const now = new Date();
      const newStreak = nextStreak(existing.lastActive, existing.streakDays);

      const [updated] = await db
        .update(students)
        .set({
          username: parsed.data.username,
          characterGender: parsed.data.characterGender,
          readingLevel: parsed.data.readingLevel,
          onboardingDone: true,
          lastActive: now,
          streakDays: newStreak,
          updatedAt: now,
        })
        .where(eq(students.id, user.sub))
        .returning();

      return NextResponse.json({ student: updated }, { status: 200 });
    } catch (error) {
      console.error("Onboarding complete error:", error);
      return internalError();
    }
  });
}
