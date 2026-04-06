import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { speechAssessments, classStudents, classes } from "@/lib/db/schema";
import { withTeacherAuth } from "@/lib/auth/middleware";
import { speechReviewSchema, formatZodError } from "@/lib/api/validators";
import { notFound, internalError } from "@/lib/api/errors";
import { and, eq } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

/**
 * Returns the assessment row if and only if it belongs to a student in one of
 * the teacher's classes. Otherwise returns null.
 */
async function findAssessmentForTeacher(id: number, teacherId: string) {
  const [row] = await db
    .select({ assessment: speechAssessments })
    .from(speechAssessments)
    .innerJoin(
      classStudents,
      eq(classStudents.studentId, speechAssessments.studentId)
    )
    .innerJoin(classes, eq(classes.id, classStudents.classId))
    .where(and(eq(speechAssessments.id, id), eq(classes.teacherId, teacherId)))
    .limit(1);
  return row?.assessment ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  return withTeacherAuth(request, async (_req: NextRequest, teacher: TokenPayload) => {
    try {
      const { assessmentId } = await params;
      const id = parseInt(assessmentId, 10);
      if (isNaN(id)) return notFound("Invalid assessment ID");

      const assessment = await findAssessmentForTeacher(id, teacher.sub);
      if (!assessment) return notFound("Assessment not found");

      return NextResponse.json({ assessment });
    } catch (error) {
      console.error("Get speech assessment error:", error);
      return internalError();
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  return withTeacherAuth(request, async (req: NextRequest, teacher: TokenPayload) => {
    try {
      const { assessmentId } = await params;
      const id = parseInt(assessmentId, 10);
      if (isNaN(id)) return notFound("Invalid assessment ID");

      // Verify this teacher owns the student whose assessment this is.
      const owned = await findAssessmentForTeacher(id, teacher.sub);
      if (!owned) return notFound("Assessment not found");

      const body = await req.json();
      const parsed = speechReviewSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      const updates: Record<string, unknown> = {
        reviewedBy: teacher.sub,
        reviewedAt: new Date(),
      };
      if (parsed.data.teacherNote !== undefined) {
        updates.teacherNote = parsed.data.teacherNote;
      }
      if (parsed.data.flagReview !== undefined) {
        updates.flagReview = parsed.data.flagReview;
      }
      if (parsed.data.scoreOverride !== undefined) {
        updates.score = parsed.data.scoreOverride;
      }

      const [updated] = await db
        .update(speechAssessments)
        .set(updates)
        .where(eq(speechAssessments.id, id))
        .returning();

      if (!updated) return notFound("Assessment not found");

      return NextResponse.json({ assessment: updated });
    } catch (error) {
      console.error("Review speech assessment error:", error);
      return internalError();
    }
  });
}
