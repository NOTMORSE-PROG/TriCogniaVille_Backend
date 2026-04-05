import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classes, classStudents } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { internalError } from "@/lib/api/errors";
import { eq } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

export async function GET(request: NextRequest) {
  return withStudentAuth(request, async (_req: NextRequest, user: TokenPayload) => {
    try {
      const enrollments = await db
        .select({
          classId: classStudents.classId,
          className: classes.name,
          joinedAt: classStudents.joinedAt,
        })
        .from(classStudents)
        .innerJoin(classes, eq(classStudents.classId, classes.id))
        .where(eq(classStudents.studentId, user.sub));

      return NextResponse.json({ classes: enrollments });
    } catch (error) {
      console.error("Get my classes error:", error);
      return internalError();
    }
  });
}
