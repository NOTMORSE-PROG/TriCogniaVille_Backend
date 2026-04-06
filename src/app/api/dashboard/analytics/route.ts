import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  classes,
  classStudents,
  students,
  questAttempts,
} from "@/lib/db/schema";
import { withTeacherAuth } from "@/lib/auth/middleware";
import { internalError } from "@/lib/api/errors";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

export async function GET(request: NextRequest) {
  return withTeacherAuth(request, async (_req: NextRequest, teacher: TokenPayload) => {
    try {
      // Get all classes for this teacher
      const teacherClasses = await db
        .select({ id: classes.id })
        .from(classes)
        .where(eq(classes.teacherId, teacher.sub));

      const classIds = teacherClasses.map((c) => c.id);

      if (classIds.length === 0) {
        return NextResponse.json({
          totalStudents: 0,
          activeToday: 0,
          readingLevelDistribution: [],
          questPassRate: [],
          streakLeaderboard: [],
          recentActivity: [],
        });
      }

      // Get all student IDs in teacher's classes
      const enrollments = await db
        .select({ studentId: classStudents.studentId })
        .from(classStudents)
        .where(sql`${classStudents.classId} = ANY(ARRAY[${sql.join(classIds.map(id => sql`${id}::uuid`), sql`, `)}])`);

      const studentIds = [...new Set(enrollments.map((e) => e.studentId))];

      if (studentIds.length === 0) {
        return NextResponse.json({
          totalStudents: 0,
          activeToday: 0,
          readingLevelDistribution: [],
          questPassRate: [],
          streakLeaderboard: [],
          recentActivity: [],
        });
      }

      const studentIdFilter = sql`${students.id} = ANY(ARRAY[${sql.join(studentIds.map(id => sql`${id}::uuid`), sql`, `)}])`;

      // Reading level distribution
      const readingLevelDist = await db
        .select({
          level: students.readingLevel,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(students)
        .where(studentIdFilter)
        .groupBy(students.readingLevel)
        .orderBy(students.readingLevel);

      // Active today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [activeResult] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(students)
        .where(
          and(studentIdFilter, gte(students.lastActive, today))
        );

      // Quest pass rate by building
      const questPassRate = await db
        .select({
          buildingId: questAttempts.buildingId,
          total: sql<number>`cast(count(*) as int)`,
          passed: sql<number>`cast(sum(case when ${questAttempts.passed} then 1 else 0 end) as int)`,
        })
        .from(questAttempts)
        .where(sql`${questAttempts.studentId} = ANY(ARRAY[${sql.join(studentIds.map(id => sql`${id}::uuid`), sql`, `)}])`)
        .groupBy(questAttempts.buildingId);

      // Streak leaderboard (top 10)
      const streakLeaderboard = await db
        .select({
          id: students.id,
          name: students.name,
          streakDays: students.streakDays,
          xp: students.xp,
        })
        .from(students)
        .where(studentIdFilter)
        .orderBy(desc(students.streakDays))
        .limit(10);

      // Recent activity (last 20 quest attempts)
      const recentActivity = await db
        .select({
          questId: questAttempts.questId,
          buildingId: questAttempts.buildingId,
          passed: questAttempts.passed,
          attempts: questAttempts.attempts,
          completedAt: questAttempts.completedAt,
          studentName: students.name,
        })
        .from(questAttempts)
        .innerJoin(students, eq(questAttempts.studentId, students.id))
        .where(sql`${questAttempts.studentId} = ANY(ARRAY[${sql.join(studentIds.map(id => sql`${id}::uuid`), sql`, `)}])`)
        .orderBy(desc(questAttempts.createdAt))
        .limit(20);

      return NextResponse.json({
        totalStudents: studentIds.length,
        activeToday: activeResult?.count || 0,
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
