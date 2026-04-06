import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, oauthPendingCodes } from "@/lib/db/schema";
import { signToken } from "@/lib/auth/jwt";
import { googleAuthSchema, formatZodError } from "@/lib/api/validators";
import { unauthorized, internalError } from "@/lib/api/errors";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

interface GoogleTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

// Verify Google ID token
async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleTokenPayload | null> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as GoogleTokenPayload & { aud: string };

    // Verify audience matches our client ID(s)
    const validClientIds = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
    ].filter(Boolean);

    if (!validClientIds.includes(payload.aud)) {
      console.error("Google token audience mismatch:", payload.aud);
      return null;
    }

    if (!payload.email_verified) {
      console.error("Google email not verified");
      return null;
    }

    return payload;
  } catch (error) {
    console.error("Google token verification error:", error);
    return null;
  }
}

// POST /api/v1/auth/google -- Direct ID token verification (from Godot/mobile)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = googleAuthSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }

    const googlePayload = await verifyGoogleIdToken(parsed.data.idToken);
    if (!googlePayload) {
      return unauthorized("Invalid Google token");
    }

    const { sub: googleId, email, name } = googlePayload;

    // Find existing student by googleId or email
    let [student] = await db
      .select()
      .from(students)
      .where(eq(students.googleId, googleId))
      .limit(1);

    if (!student) {
      // Check by email (might have registered with email+password first)
      [student] = await db
        .select()
        .from(students)
        .where(eq(students.email, email))
        .limit(1);

      if (student) {
        // Link Google account to existing email account
        await db
          .update(students)
          .set({ googleId, updatedAt: new Date(), lastActive: new Date() })
          .where(eq(students.id, student.id));
      } else {
        // Create new student
        [student] = await db
          .insert(students)
          .values({
            email,
            googleId,
            name: name || email.split("@")[0],
          })
          .returning();
      }
    } else {
      // Update last active
      await db
        .update(students)
        .set({ lastActive: new Date(), updatedAt: new Date() })
        .where(eq(students.id, student.id));
    }

    // Generate JWT
    const token = await signToken({
      sub: student.id,
      role: "student",
      email: student.email,
    });

    return NextResponse.json({
      token,
      student: {
        id: student.id,
        email: student.email,
        name: student.name,
        readingLevel: student.readingLevel,
        xp: student.xp,
        streakDays: student.streakDays,
        onboardingDone: student.onboardingDone,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    return internalError();
  }
}

// GET /api/v1/auth/google -- Initiate OAuth flow (for browser-based flow from Godot)
export async function GET() {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!clientId) {
      return internalError("Google OAuth is not configured");
    }

    // Create a pending session for Godot to poll
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Self-healing cleanup — prune stale pending codes so the table doesn't grow
    // unbounded. Runs on every new pending-code INSERT, piggybacking on an
    // already-hot code path. No cron needed.
    await db.delete(oauthPendingCodes).where(
      sql`${oauthPendingCodes.expiresAt} < NOW()
          OR (${oauthPendingCodes.status} IN ('completed','expired')
              AND ${oauthPendingCodes.createdAt} < NOW() - INTERVAL '1 hour')`
    );

    await db.insert(oauthPendingCodes).values({
      sessionId,
      status: "pending",
      expiresAt,
    });

    const redirectUri = `${appUrl}/api/v1/auth/google/callback`;
    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("state", sessionId);
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "select_account");

    return NextResponse.json({
      authUrl: googleAuthUrl.toString(),
      sessionId,
    });
  } catch (error) {
    console.error("Google OAuth init error:", error);
    return internalError();
  }
}
