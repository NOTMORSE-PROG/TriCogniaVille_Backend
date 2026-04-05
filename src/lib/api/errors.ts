import { NextResponse } from "next/server";

export interface ApiError {
  error: string;
  code: string;
  status: number;
  details?: unknown;
}

export function errorResponse(
  message: string,
  code: string,
  status: number,
  details?: unknown
): NextResponse<ApiError> {
  return NextResponse.json({ error: message, code, status, details }, { status });
}

export function badRequest(message: string = "Bad request", details?: unknown) {
  return errorResponse(message, "BAD_REQUEST", 400, details);
}

export function unauthorized(message: string = "Unauthorized") {
  return errorResponse(message, "UNAUTHORIZED", 401);
}

export function forbidden(message: string = "Forbidden") {
  return errorResponse(message, "FORBIDDEN", 403);
}

export function notFound(message: string = "Not found") {
  return errorResponse(message, "NOT_FOUND", 404);
}

export function conflict(message: string = "Conflict") {
  return errorResponse(message, "CONFLICT", 409);
}

export function tooManyRequests(message: string = "Too many requests") {
  return errorResponse(message, "TOO_MANY_REQUESTS", 429);
}

export function internalError(message: string = "Internal server error") {
  return errorResponse(message, "INTERNAL_ERROR", 500);
}

// Wraps a route handler with try/catch to prevent leaking internal errors
export function withErrorHandler(
  handler: (request: Request) => Promise<NextResponse>
) {
  return async (request: Request): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      console.error("Unhandled API error:", error);

      // Check for known database errors
      if (error instanceof Error) {
        if (error.message.includes("unique constraint")) {
          return conflict("Resource already exists");
        }
        if (error.message.includes("foreign key constraint")) {
          return badRequest("Referenced resource does not exist");
        }
      }

      return internalError();
    }
  };
}
