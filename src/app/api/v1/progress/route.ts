import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, questAttempts, buildingStates } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { notFound, internalError } from "@/lib/api/errors";
import { eq, desc } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

export async function GET(request: NextRequest) {
  return withStudentAuth(request, async (_req: NextRequest, user: TokenPayload) => {
    try {
      // Fetch student, quests, and buildings in parallel
      const [studentResult, questsResult, buildingsResult] = await Promise.all([
        db
          .select({
            id: students.id,
            name: students.name,
            email: students.email,
            readingLevel: students.readingLevel,
            xp: students.xp,
            streakDays: students.streakDays,
            onboardingDone: students.onboardingDone,
            lastActive: students.lastActive,
          })
          .from(students)
          .where(eq(students.id, user.sub))
          .limit(1),
        db
          .select()
          .from(questAttempts)
          .where(eq(questAttempts.studentId, user.sub))
          .orderBy(desc(questAttempts.createdAt))
          .limit(100),
        db
          .select()
          .from(buildingStates)
          .where(eq(buildingStates.studentId, user.sub)),
      ]);

      if (studentResult.length === 0) {
        return notFound("Student not found");
      }

      return NextResponse.json({
        student: studentResult[0],
        questAttempts: questsResult,
        buildingStates: buildingsResult,
      });
    } catch (error) {
      console.error("Get progress error:", error);
      return internalError();
    }
  });
}
