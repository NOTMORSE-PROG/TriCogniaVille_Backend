import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildingStates } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { buildingStateSchema, formatZodError } from "@/lib/api/validators";
import { internalError } from "@/lib/api/errors";
import { eq, and } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest, user: TokenPayload) => {
    try {
      const body = await req.json();
      const parsed = buildingStateSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      const { buildingId, unlocked, unlockedAt } = parsed.data;

      // Upsert building state
      const [existing] = await db
        .select()
        .from(buildingStates)
        .where(
          and(
            eq(buildingStates.studentId, user.sub),
            eq(buildingStates.buildingId, buildingId)
          )
        )
        .limit(1);

      let result;
      if (existing) {
        [result] = await db
          .update(buildingStates)
          .set({
            unlocked,
            unlockedAt: unlockedAt ? new Date(unlockedAt) : existing.unlockedAt,
            syncedAt: new Date(),
          })
          .where(
            and(
              eq(buildingStates.studentId, user.sub),
              eq(buildingStates.buildingId, buildingId)
            )
          )
          .returning();
      } else {
        [result] = await db
          .insert(buildingStates)
          .values({
            studentId: user.sub,
            buildingId,
            unlocked,
            unlockedAt: unlockedAt ? new Date(unlockedAt) : null,
          })
          .returning();
      }

      return NextResponse.json({ buildingState: result }, { status: 201 });
    } catch (error) {
      console.error("Record building error:", error);
      return internalError();
    }
  });
}

export async function GET(request: NextRequest) {
  return withStudentAuth(request, async (_req: NextRequest, user: TokenPayload) => {
    try {
      const states = await db
        .select()
        .from(buildingStates)
        .where(eq(buildingStates.studentId, user.sub));

      return NextResponse.json({ buildingStates: states });
    } catch (error) {
      console.error("Get buildings error:", error);
      return internalError();
    }
  });
}
