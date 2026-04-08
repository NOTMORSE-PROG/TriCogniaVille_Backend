import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storyProgress } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import {
  storyProgressSingleSchema,
  formatZodError,
} from "@/lib/api/validators";
import { internalError } from "@/lib/api/errors";
import { and, eq, sql } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

/**
 * POST /api/v1/story-progress
 *
 * Marks a single story flag as seen for the authenticated student. Flags are
 * monotonic — once true, they stay true (the upsert uses `OR` semantics so a
 * stale POST never clears an earlier flag).
 *
 * Body: { buildingId: string, flag: 'prologueSeen' | 'introSeen' | 'outroSeen' | 'endingSeen' }
 *
 * Note: prologue/ending are conceptually "global" but the schema requires a
 * buildingId composite key — the Godot client passes "" (empty string) for
 * those, matching how the old SQLite layer worked.
 */
export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest, user: TokenPayload) => {
    try {
      const body = await req.json();
      const parsed = storyProgressSingleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      const { buildingId, flag } = parsed.data;

      const insertValues = {
        studentId: user.sub,
        buildingId,
        prologueSeen: flag === "prologueSeen",
        introSeen: flag === "introSeen",
        outroSeen: flag === "outroSeen",
        endingSeen: flag === "endingSeen",
      };

      // Postgres upsert with OR-merge so flags only ever flip false→true.
      // EXCLUDED.<col> refers to the row we tried to insert.
      await db
        .insert(storyProgress)
        .values(insertValues)
        .onConflictDoUpdate({
          target: [storyProgress.studentId, storyProgress.buildingId],
          set: {
            prologueSeen: sql`${storyProgress.prologueSeen} OR EXCLUDED.prologue_seen`,
            introSeen: sql`${storyProgress.introSeen} OR EXCLUDED.intro_seen`,
            outroSeen: sql`${storyProgress.outroSeen} OR EXCLUDED.outro_seen`,
            endingSeen: sql`${storyProgress.endingSeen} OR EXCLUDED.ending_seen`,
            updatedAt: new Date(),
          },
        });

      const [row] = await db
        .select()
        .from(storyProgress)
        .where(
          and(
            eq(storyProgress.studentId, user.sub),
            eq(storyProgress.buildingId, buildingId)
          )
        )
        .limit(1);

      return NextResponse.json({ storyProgress: row }, { status: 200 });
    } catch (error) {
      console.error("Story progress error:", error);
      return internalError();
    }
  });
}
