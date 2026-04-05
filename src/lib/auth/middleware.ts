import { NextRequest, NextResponse } from "next/server";
import { verifyToken, TokenPayload } from "./jwt";
import { cookies } from "next/headers";

export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload;
}

// Error response helper
function unauthorizedResponse(message: string = "Unauthorized") {
  return NextResponse.json(
    { error: message, code: "UNAUTHORIZED", status: 401 },
    { status: 401 }
  );
}

// Extract Bearer token from Authorization header
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

// Student auth: verifies Bearer token from Authorization header
export async function withStudentAuth(
  request: NextRequest,
  handler: (request: NextRequest, student: TokenPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  const token = extractBearerToken(request);
  if (!token) {
    return unauthorizedResponse("Missing authorization token");
  }

  try {
    const payload = await verifyToken(token);
    if (payload.role !== "student") {
      return unauthorizedResponse("Student access required");
    }
    return handler(request, payload);
  } catch {
    return unauthorizedResponse("Invalid or expired token");
  }
}

// Teacher auth: verifies token from cookie or Authorization header
export async function withTeacherAuth(
  request: NextRequest,
  handler: (request: NextRequest, teacher: TokenPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  // Try cookie first (dashboard), then Bearer token (API)
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("teacher_token")?.value;
  const bearerToken = extractBearerToken(request);
  const token = cookieToken || bearerToken;

  if (!token) {
    return unauthorizedResponse("Missing authorization token");
  }

  try {
    const payload = await verifyToken(token);
    if (payload.role !== "teacher") {
      return unauthorizedResponse("Teacher access required");
    }
    return handler(request, payload);
  } catch {
    return unauthorizedResponse("Invalid or expired token");
  }
}

// Verify teacher token from cookie (for server components)
export async function getTeacherFromCookie(): Promise<TokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("teacher_token")?.value;
    if (!token) return null;

    const payload = await verifyToken(token);
    if (payload.role !== "teacher") return null;
    return payload;
  } catch {
    return null;
  }
}

// Verify student token from header (for API routes)
export async function getStudentFromHeader(
  request: NextRequest
): Promise<TokenPayload | null> {
  try {
    const token = extractBearerToken(request);
    if (!token) return null;

    const payload = await verifyToken(token);
    if (payload.role !== "student") return null;
    return payload;
  } catch {
    return null;
  }
}
