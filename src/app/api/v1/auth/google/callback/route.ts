import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, oauthPendingCodes } from "@/lib/db/schema";
import { signToken } from "@/lib/auth/jwt";
import { internalError } from "@/lib/api/errors";
import { eq } from "drizzle-orm";

interface GoogleTokenResponse {
  id_token: string;
  access_token: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      console.error("Token exchange failed:", await response.text());
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Token exchange error:", error);
    return null;
  }
}

// Get user info from Google
async function getGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

// GET /api/v1/auth/google/callback -- Google OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // sessionId
    const error = searchParams.get("error");

    if (error) {
      return new NextResponse(
        renderHtml("Authentication Failed", "Google sign-in was cancelled or failed. You can close this window and try again."),
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    if (!code || !state) {
      return new NextResponse(
        renderHtml("Invalid Request", "Missing authorization code. Please try again."),
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${appUrl}/api/v1/auth/google/callback`;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens) {
      return new NextResponse(
        renderHtml("Authentication Failed", "Failed to verify with Google. Please try again."),
        { status: 500, headers: { "Content-Type": "text/html" } }
      );
    }

    // Get user info
    const userInfo = await getGoogleUserInfo(tokens.access_token);
    if (!userInfo || !userInfo.email_verified) {
      return new NextResponse(
        renderHtml("Authentication Failed", "Could not verify your Google account. Please try again."),
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    // Find or create student
    let [student] = await db
      .select()
      .from(students)
      .where(eq(students.googleId, userInfo.sub))
      .limit(1);

    if (!student) {
      [student] = await db
        .select()
        .from(students)
        .where(eq(students.email, userInfo.email))
        .limit(1);

      if (student) {
        await db
          .update(students)
          .set({
            googleId: userInfo.sub,
            updatedAt: new Date(),
            lastActive: new Date(),
          })
          .where(eq(students.id, student.id));
      } else {
        [student] = await db
          .insert(students)
          .values({
            email: userInfo.email,
            googleId: userInfo.sub,
            name: userInfo.name || userInfo.email.split("@")[0],
          })
          .returning();
      }
    } else {
      await db
        .update(students)
        .set({ lastActive: new Date(), updatedAt: new Date() })
        .where(eq(students.id, student.id));
    }

    // Generate JWT
    const jwt = await signToken({
      sub: student.id,
      role: "student",
      email: student.email,
    });

    // Update pending code with token so Godot can poll for it
    await db
      .update(oauthPendingCodes)
      .set({
        studentId: student.id,
        token: jwt,
        status: "completed",
      })
      .where(eq(oauthPendingCodes.sessionId, state));

    // Show success page that Godot can detect
    return new NextResponse(
      renderHtml(
        "Sign In Successful!",
        "You have been signed in to TriCognia Ville. You can close this window and return to the app."
      ),
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("Google callback error:", error);
    return new NextResponse(
      renderHtml("Error", "An unexpected error occurred. Please try again."),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}

function renderHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - TriCognia Ville</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f0f4f8; color: #1a202c; }
    .card { background: white; border-radius: 12px; padding: 2rem; max-width: 400px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #4a5568; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
