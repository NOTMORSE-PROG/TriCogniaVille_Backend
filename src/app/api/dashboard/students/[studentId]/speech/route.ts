import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { speechAssessments, students } from "@/lib/db/schema";
import { withTeacherAuth } from "@/lib/auth/middleware";
import { teacherOwnsStudent } from "@/lib/auth/teacher-access";
import { notFound, internalError } from "@/lib/api/errors";
import { eq, desc } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  return withTeacherAuth(request, async (_req: NextRequest, teacher: TokenPayload) => {
    try {
      const { studentId } = await params;

      // Gate access to teacher's own roster. notFound avoids enumeration.
      if (!(await teacherOwnsStudent(teacher.sub, studentId))) {
        return notFound("Student not found");
      }

      // Verify student exists
      const [student] = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);

      if (!student) return notFound("Student not found");

      const assessments = await db
        .select()
        .from(speechAssessments)
        .where(eq(speechAssessments.studentId, studentId))
        .orderBy(desc(speechAssessments.createdAt))
        .limit(50);

      return NextResponse.json({ assessments });
    } catch (error) {
      console.error("Get student speech assessments error:", error);
      return internalError();
    }
  });
}
