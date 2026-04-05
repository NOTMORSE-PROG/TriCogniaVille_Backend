import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classes, classStudents } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { joinClassSchema, formatZodError } from "@/lib/api/validators";
import { notFound, conflict, internalError } from "@/lib/api/errors";
import { eq, and } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest, user: TokenPayload) => {
    try {
      const body = await req.json();
      const parsed = joinClassSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      // Find class by invite code
      const [classRecord] = await db
        .select()
        .from(classes)
        .where(eq(classes.inviteCode, parsed.data.inviteCode))
        .limit(1);

      if (!classRecord) {
        return notFound("Invalid invite code");
      }

      // Check if already enrolled
      const [existing] = await db
        .select()
        .from(classStudents)
        .where(
          and(
            eq(classStudents.classId, classRecord.id),
            eq(classStudents.studentId, user.sub)
          )
        )
        .limit(1);

      if (existing) {
        return conflict("Already enrolled in this class");
      }

      // Enroll student
      await db.insert(classStudents).values({
        classId: classRecord.id,
        studentId: user.sub,
      });

      return NextResponse.json(
        {
          message: "Successfully joined class",
          class: {
            id: classRecord.id,
            name: classRecord.name,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Join class error:", error);
      return internalError();
    }
  });
}
