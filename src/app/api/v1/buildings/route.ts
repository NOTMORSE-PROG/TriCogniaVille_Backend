import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildingStates } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { internalError } from "@/lib/api/errors";
import { eq } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

/**
 * GET stays for the teacher dashboard / debug tooling.
 *
 * POST is removed: building unlocks now happen as a side-effect of
 * `POST /api/v1/quests` (server-authoritative). Old clients calling here
 * will get a 410 with a clear "please update" message.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Building writes are now handled by POST /api/v1/quests. Please update the TriCognia Ville app.",
      code: "GONE",
    },
    { status: 410 }
  );
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
