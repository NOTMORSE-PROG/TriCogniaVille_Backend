import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { signToken } from "@/lib/auth/jwt";
import { loginSchema, formatZodError } from "@/lib/api/validators";
import { unauthorized, internalError, tooManyRequests } from "@/lib/api/errors";
import { checkRateLimit, recordFailedAttempt } from "@/lib/api/rate-limit";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }

    const { email, password } = parsed.data;
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");

    // Check rate limit
    const rateCheck = await checkRateLimit(email, ip);
    if (!rateCheck.allowed) {
      return tooManyRequests(
        `Too many failed attempts. Try again in ${rateCheck.retryAfterMinutes} minutes.`
      );
    }

    // Find student
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.email, email))
      .limit(1);

    if (!student || !student.passwordHash) {
      await recordFailedAttempt(email, ip);
      return unauthorized("Invalid email or password");
    }

    // Verify password
    const valid = await compare(password, student.passwordHash);
    if (!valid) {
      await recordFailedAttempt(email, ip);
      return unauthorized("Invalid email or password");
    }

    // Update last active
    await db
      .update(students)
      .set({ lastActive: new Date(), updatedAt: new Date() })
      .where(eq(students.id, student.id));

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
    console.error("Login error:", error);
    return internalError();
  }
}
