import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { questAttempts } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { questAttemptSchema, formatZodError } from "@/lib/api/validators";
import { internalError } from "@/lib/api/errors";
import { eq, desc } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest, user: TokenPayload) => {
    try {
      const body = await req.json();
      const parsed = questAttemptSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      const [attempt] = await db
        .insert(questAttempts)
        .values({
          studentId: user.sub,
          questId: parsed.data.questId,
          buildingId: parsed.data.buildingId,
          passed: parsed.data.passed,
          attempts: parsed.data.attempts,
          completedAt: parsed.data.completedAt
            ? new Date(parsed.data.completedAt)
            : new Date(),
        })
        .returning();

      return NextResponse.json({ questAttempt: attempt }, { status: 201 });
    } catch (error) {
      console.error("Record quest error:", error);
      return internalError();
    }
  });
}

export async function GET(request: NextRequest) {
  return withStudentAuth(request, async (_req: NextRequest, user: TokenPayload) => {
    try {
      const attempts = await db
        .select()
        .from(questAttempts)
        .where(eq(questAttempts.studentId, user.sub))
        .orderBy(desc(questAttempts.createdAt))
        .limit(100);

      return NextResponse.json({ questAttempts: attempts });
    } catch (error) {
      console.error("Get quests error:", error);
      return internalError();
    }
  });
}
