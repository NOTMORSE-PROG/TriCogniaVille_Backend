import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, questAttempts, buildingStates, studentBadges } from "@/lib/db/schema";
import { withTeacherAuth } from "@/lib/auth/middleware";
import { teacherOwnsStudent } from "@/lib/auth/teacher-access";
import { notFound, internalError } from "@/lib/api/errors";
import { eq, desc } from "drizzle-orm";
import { getLevelInfo } from "@/lib/gamification/levels";
import { BADGE_DEFINITIONS } from "@/lib/db/badge-definitions";
import { TokenPayload } from "@/lib/auth/jwt";


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  return withTeacherAuth(request, async (_req: NextRequest, teacher: TokenPayload) => {
    try {
      const { studentId } = await params;

      // Gate access to teacher's own roster. Use notFound to avoid enumeration.
      if (!(await teacherOwnsStudent(teacher.sub, studentId))) {
        return notFound("Student not found");
      }

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

      const [quests, buildings, earnedBadgeRows] = await Promise.all([
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
        db
          .select({ badgeId: studentBadges.badgeId, earnedAt: studentBadges.earnedAt })
          .from(studentBadges)
          .where(eq(studentBadges.studentId, studentId)),
      ]);

      const earnedMap = new Map(earnedBadgeRows.map((r) => [r.badgeId, r.earnedAt]));
      const levelInfo = getLevelInfo(student.xp);
      const badgeList = BADGE_DEFINITIONS.map((def) => ({
        ...def,
        earned: earnedMap.has(def.id),
        earnedAt: earnedMap.get(def.id) ?? null,
      }));

      return NextResponse.json({
        student,
        questAttempts: quests,
        buildingStates: buildings,
        badges: badgeList,
        level: levelInfo,
      });
    } catch (error) {
      console.error("Get student detail error:", error);
      return internalError();
    }
  });
}
