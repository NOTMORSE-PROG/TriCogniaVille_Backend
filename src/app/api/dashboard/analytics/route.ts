import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, questAttempts } from "@/lib/db/schema";
import { withTeacherAuth } from "@/lib/auth/middleware";
import { visibleStudentIds } from "@/lib/auth/teacher-access";
import { internalError } from "@/lib/api/errors";
import { sql, desc, inArray, gte, and } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

export async function GET(request: NextRequest) {
  return withTeacherAuth(request, async (_req: NextRequest, teacher: TokenPayload) => {
    try {
      const visible = visibleStudentIds(teacher.sub);

      const totalStudents = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(students)
        .where(inArray(students.id, visible))
        .then((r) => r[0]?.count ?? 0);

      if (totalStudents === 0) {
        return NextResponse.json({
          totalStudents: 0,
          activeToday: 0,
          readingLevelDistribution: [],
          questPassRate: [],
          streakLeaderboard: [],
          recentActivity: [],
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        readingLevelDist,
        activeResult,
        questPassRate,
        streakLeaderboard,
        recentActivity,
      ] = await Promise.all([
        db
          .select({
            level: students.readingLevel,
            count: sql<number>`cast(count(*) as int)`,
          })
          .from(students)
          .where(inArray(students.id, visibleStudentIds(teacher.sub)))
          .groupBy(students.readingLevel)
          .orderBy(students.readingLevel),

        db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(students)
          .where(
            and(
              inArray(students.id, visibleStudentIds(teacher.sub)),
              gte(students.lastActive, today)
            )
          )
          .then((r) => r[0]),

        db
          .select({
            buildingId: questAttempts.buildingId,
            total: sql<number>`cast(count(*) as int)`,
            passed: sql<number>`cast(sum(case when ${questAttempts.passed} then 1 else 0 end) as int)`,
          })
          .from(questAttempts)
          .where(inArray(questAttempts.studentId, visibleStudentIds(teacher.sub)))
          .groupBy(questAttempts.buildingId),

        db
          .select({
            id: students.id,
            name: students.name,
            streakDays: students.streakDays,
            xp: students.xp,
          })
          .from(students)
          .where(inArray(students.id, visibleStudentIds(teacher.sub)))
          .orderBy(desc(students.streakDays))
          .limit(10),

        db
          .select({
            questId: questAttempts.questId,
            buildingId: questAttempts.buildingId,
            passed: questAttempts.passed,
            completedAt: questAttempts.completedAt,
            studentName: students.name,
          })
          .from(questAttempts)
          .innerJoin(students, sql`${questAttempts.studentId} = ${students.id}`)
          .where(inArray(questAttempts.studentId, visibleStudentIds(teacher.sub)))
          .orderBy(desc(questAttempts.createdAt))
          .limit(20),
      ]);

      return NextResponse.json({
        totalStudents,
        activeToday: activeResult?.count ?? 0,
        readingLevelDistribution: readingLevelDist,
        questPassRate: questPassRate.map((q) => ({
          ...q,
          rate: q.total > 0 ? Math.round((q.passed / q.total) * 100) : 0,
        })),
        streakLeaderboard,
        recentActivity,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      return internalError();
    }
  });
}
