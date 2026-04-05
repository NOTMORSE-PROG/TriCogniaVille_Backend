import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { oauthPendingCodes } from "@/lib/db/schema";
import { badRequest, notFound, internalError } from "@/lib/api/errors";
import { eq, and, gt } from "drizzle-orm";

// GET /api/v1/auth/google/poll?sessionId=xxx
// Godot polls this endpoint to check if OAuth flow completed
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return badRequest("sessionId is required");
    }

    const [pending] = await db
      .select()
      .from(oauthPendingCodes)
      .where(
        and(
          eq(oauthPendingCodes.sessionId, sessionId),
          gt(oauthPendingCodes.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!pending) {
      return notFound("Session not found or expired");
    }

    if (pending.status === "pending") {
      return NextResponse.json({ status: "pending" });
    }

    if (pending.status === "completed" && pending.token) {
      // Delete the pending code after retrieval (one-time use)
      await db
        .delete(oauthPendingCodes)
        .where(eq(oauthPendingCodes.id, pending.id));

      return NextResponse.json({
        status: "completed",
        token: pending.token,
      });
    }

    return NextResponse.json({ status: pending.status });
  } catch (error) {
    console.error("OAuth poll error:", error);
    return internalError();
  }
}
