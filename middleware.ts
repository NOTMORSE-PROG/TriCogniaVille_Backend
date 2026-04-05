import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get("teacher_token")?.value;

    if (!token) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(signInUrl);
    }

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error("JWT_SECRET not configured");
      }

      await jwtVerify(token, new TextEncoder().encode(secret), {
        issuer: "tricognia-ville",
      });

      return NextResponse.next();
    } catch {
      // Invalid/expired token — clear cookie and redirect
      const signInUrl = new URL("/sign-in", request.url);
      const response = NextResponse.redirect(signInUrl);
      response.cookies.delete("teacher_token");
      return response;
    }
  }

  // Add CORS headers for API routes (for Godot cross-origin requests)
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: response.headers,
      });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
