import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classes, classStudents } from "@/lib/db/schema";
import { withTeacherAuth } from "@/lib/auth/middleware";
import { createClassSchema, formatZodError } from "@/lib/api/validators";
import { internalError } from "@/lib/api/errors";
import { eq, sql } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";
import { randomBytes } from "crypto";

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function GET(request: NextRequest) {
  return withTeacherAuth(request, async (_req: NextRequest, teacher: TokenPayload) => {
    try {
      const teacherClasses = await db
        .select({
          id: classes.id,
          name: classes.name,
          inviteCode: classes.inviteCode,
          createdAt: classes.createdAt,
          studentCount: sql<number>`cast(count(${classStudents.studentId}) as int)`,
        })
        .from(classes)
        .leftJoin(classStudents, eq(classes.id, classStudents.classId))
        .where(eq(classes.teacherId, teacher.sub))
        .groupBy(classes.id)
        .orderBy(classes.createdAt);

      return NextResponse.json({ classes: teacherClasses });
    } catch (error) {
      console.error("Get classes error:", error);
      return internalError();
    }
  });
}

export async function POST(request: NextRequest) {
  return withTeacherAuth(request, async (req: NextRequest, teacher: TokenPayload) => {
    try {
      const body = await req.json();
      const parsed = createClassSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      const [newClass] = await db
        .insert(classes)
        .values({
          teacherId: teacher.sub,
          name: parsed.data.name,
          inviteCode: generateInviteCode(),
        })
        .returning();

      return NextResponse.json({ class: newClass }, { status: 201 });
    } catch (error) {
      console.error("Create class error:", error);
      return internalError();
    }
  });
}
