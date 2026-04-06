import { NextResponse } from "next/server";

/**
 * POST /api/v1/auth/logout
 * Clears the student session cookie.
 * The JWT is stateless so we just delete the cookie on the client side;
 * the 7-day token is effectively invalidated from the client's perspective.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("student_token");
  return response;
}
