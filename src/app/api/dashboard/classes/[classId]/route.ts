import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  classes,
  classStudents,
  students,
  questAttempts,
  buildingStates,
} from "@/lib/db/schema";
import { withTeacherAuth } from "@/lib/auth/middleware";
import { notFound, internalError } from "@/lib/api/errors";
import { eq, and, sql } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  return withTeacherAuth(request, async (_req: NextRequest, teacher: TokenPayload) => {
    try {
      const { classId } = await params;

      // Verify class belongs to teacher
      const [classRecord] = await db
        .select()
        .from(classes)
        .where(
          and(eq(classes.id, classId), eq(classes.teacherId, teacher.sub))
        )
        .limit(1);

      if (!classRecord) {
        return notFound("Class not found");
      }

      // Get students in this class with their stats
      const classStudentsList = await db
        .select({
          id: students.id,
          name: students.name,
          email: students.email,
          readingLevel: students.readingLevel,
          xp: students.xp,
          streakDays: students.streakDays,
          lastActive: students.lastActive,
          onboardingDone: students.onboardingDone,
          joinedAt: classStudents.joinedAt,
        })
        .from(classStudents)
        .innerJoin(students, eq(classStudents.studentId, students.id))
        .where(eq(classStudents.classId, classId));

      // Get aggregate stats
      const studentIds = classStudentsList.map((s) => s.id);

      let totalQuests = 0;
      let passedQuests = 0;
      let totalBuildings = 0;

      if (studentIds.length > 0) {
        const [questStats] = await db
          .select({
            total: sql<number>`cast(count(*) as int)`,
            passed: sql<number>`cast(sum(case when ${questAttempts.passed} then 1 else 0 end) as int)`,
          })
          .from(questAttempts)
          .where(sql`${questAttempts.studentId} = ANY(ARRAY[${sql.join(studentIds.map(id => sql`${id}::uuid`), sql`, `)}])`);

        totalQuests = questStats?.total || 0;
        passedQuests = questStats?.passed || 0;

        const [buildingStats] = await db
          .select({
            total: sql<number>`cast(count(*) as int)`,
          })
          .from(buildingStates)
          .where(
            and(
              sql`${buildingStates.studentId} = ANY(ARRAY[${sql.join(studentIds.map(id => sql`${id}::uuid`), sql`, `)}])`,
              eq(buildingStates.unlocked, true)
            )
          );

        totalBuildings = buildingStats?.total || 0;
      }

      return NextResponse.json({
        class: classRecord,
        students: classStudentsList,
        stats: {
          totalStudents: classStudentsList.length,
          totalQuests,
          passedQuests,
          passRate: totalQuests > 0 ? Math.round((passedQuests / totalQuests) * 100) : 0,
          totalBuildingsUnlocked: totalBuildings,
          avgReadingLevel:
            classStudentsList.length > 0
              ? +(
                  classStudentsList.reduce((sum, s) => sum + s.readingLevel, 0) /
                  classStudentsList.length
                ).toFixed(1)
              : 0,
        },
      });
    } catch (error) {
      console.error("Get class detail error:", error);
      return internalError();
    }
  });
}
