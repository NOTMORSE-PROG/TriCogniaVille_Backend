import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildingStates } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { internalError, badRequest } from "@/lib/api/errors";
import { TokenPayload } from "@/lib/auth/jwt";
import { sql } from "drizzle-orm";

/**
 * POST /api/v1/buildings/tutorial
 * Body: { buildingId: string }
 *
 * Marks the tutorial stage as completed for a (student, building) pair.
 * Idempotent — uses UPSERT so repeated calls do not error or duplicate rows.
 * Does NOT touch the `unlocked` flag (that is set by POST /api/v1/quests
 * when the graded mission passes).
 */
export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest, user: TokenPayload) => {
    try {
      const body = await req.json().catch(() => ({}));
      const buildingId = typeof body?.buildingId === "string" ? body.buildingId.trim() : "";
      if (!buildingId) {
        return badRequest("buildingId is required");
      }

      await db
        .insert(buildingStates)
        .values({
          studentId: user.sub,
          buildingId,
          unlocked: false,
          tutorialDone: true,
        })
        .onConflictDoUpdate({
          target: [buildingStates.studentId, buildingStates.buildingId],
          set: {
            tutorialDone: true,
            syncedAt: sql`now()`,
          },
        });

      return NextResponse.json({ ok: true, buildingId, tutorialDone: true });
    } catch (error) {
      console.error("Mark tutorial done error:", error);
      return internalError();
    }
  });
}
