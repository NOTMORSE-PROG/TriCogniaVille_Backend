import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, questAttempts, buildingStates } from "@/lib/db/schema";
import { withTeacherAuth } from "@/lib/auth/middleware";
import { notFound, internalError } from "@/lib/api/errors";
import { eq, desc } from "drizzle-orm";


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  return withTeacherAuth(request, async () => {
    try {
      const { studentId } = await params;

      const [student] = await db
        .select({
          id: students.id,
          name: students.name,
          email: students.email,
          readingLevel: students.readingLevel,
          xp: students.xp,
          streakDays: students.streakDays,
          lastActive: students.lastActive,
          onboardingDone: students.onboardingDone,
          createdAt: students.createdAt,
        })
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);

      if (!student) {
        return notFound("Student not found");
      }

      const [quests, buildings] = await Promise.all([
        db
          .select()
          .from(questAttempts)
          .where(eq(questAttempts.studentId, studentId))
          .orderBy(desc(questAttempts.createdAt))
          .limit(100),
        db
          .select()
          .from(buildingStates)
          .where(eq(buildingStates.studentId, studentId)),
      ]);

      return NextResponse.json({
        student,
        questAttempts: quests,
        buildingStates: buildings,
      });
    } catch (error) {
      console.error("Get student detail error:", error);
      return internalError();
    }
  });
}
