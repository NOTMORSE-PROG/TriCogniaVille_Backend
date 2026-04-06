import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { updateProfileSchema, formatZodError } from "@/lib/api/validators";
import { notFound, internalError } from "@/lib/api/errors";
import { eq } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";
import { checkAndAwardBadges } from "@/lib/gamification/badges";

export async function GET(request: NextRequest) {
  return withStudentAuth(request, async (_req: NextRequest, user: TokenPayload) => {
    try {
      const [student] = await db
        .select({
          id: students.id,
          email: students.email,
          name: students.name,
          readingLevel: students.readingLevel,
          xp: students.xp,
          streakDays: students.streakDays,
          lastActive: students.lastActive,
          onboardingDone: students.onboardingDone,
          createdAt: students.createdAt,
        })
        .from(students)
        .where(eq(students.id, user.sub))
        .limit(1);

      if (!student) {
        return notFound("Student not found");
      }

      return NextResponse.json({ student });
    } catch (error) {
      console.error("Get profile error:", error);
      return internalError();
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest, user: TokenPayload) => {
    try {
      const body = await req.json();
      const parsed = updateProfileSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.readingLevel !== undefined)
        updates.readingLevel = parsed.data.readingLevel;
      if (parsed.data.onboardingDone !== undefined)
        updates.onboardingDone = parsed.data.onboardingDone;

      const [updated] = await db
        .update(students)
        .set(updates)
        .where(eq(students.id, user.sub))
        .returning({
          id: students.id,
          email: students.email,
          name: students.name,
          readingLevel: students.readingLevel,
          xp: students.xp,
          streakDays: students.streakDays,
          onboardingDone: students.onboardingDone,
        });

      if (!updated) {
        return notFound("Student not found");
      }

      // Fire-and-forget badge check — don't block the response
      checkAndAwardBadges(user.sub).catch((err) =>
        console.error("Badge check failed (me PATCH):", err)
      );

      return NextResponse.json({ student: updated });
    } catch (error) {
      console.error("Update profile error:", error);
      return internalError();
    }
  });
}
