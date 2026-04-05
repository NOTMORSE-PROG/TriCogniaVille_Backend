import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { teachers } from "@/lib/db/schema";
import { signToken } from "@/lib/auth/jwt";
import { teacherLoginSchema, formatZodError } from "@/lib/api/validators";
import { unauthorized, internalError, tooManyRequests } from "@/lib/api/errors";
import { checkRateLimit, recordFailedAttempt } from "@/lib/api/rate-limit";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = teacherLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }

    const { email, password } = parsed.data;
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip");

    // Check rate limit
    const rateCheck = await checkRateLimit(email, ip);
    if (!rateCheck.allowed) {
      return tooManyRequests(
        `Too many failed attempts. Try again in ${rateCheck.retryAfterMinutes} minutes.`
      );
    }

    // Find teacher
    const [teacher] = await db
      .select()
      .from(teachers)
      .where(eq(teachers.email, email))
      .limit(1);

    if (!teacher) {
      await recordFailedAttempt(email, ip);
      return unauthorized("Invalid email or password");
    }

    // Verify password
    const valid = await compare(password, teacher.passwordHash);
    if (!valid) {
      await recordFailedAttempt(email, ip);
      return unauthorized("Invalid email or password");
    }

    // Generate JWT
    const token = await signToken({
      sub: teacher.id,
      role: "teacher",
      email: teacher.email,
    });

    // Set HTTP-only cookie for dashboard
    const response = NextResponse.json({
      token,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
      },
    });

    response.cookies.set("teacher_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Teacher login error:", error);
    return internalError();
  }
}
