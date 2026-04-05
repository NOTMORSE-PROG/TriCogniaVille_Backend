import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { signToken } from "@/lib/auth/jwt";
import { registerSchema, formatZodError } from "@/lib/api/validators";
import { conflict, internalError, badRequest } from "@/lib/api/errors";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }

    const { email, password, name } = parsed.data;

    // Check if email already exists
    const existing = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.email, email))
      .limit(1);

    if (existing.length > 0) {
      return conflict("An account with this email already exists");
    }

    // Hash password with bcrypt cost factor 12
    const passwordHash = await hash(password, 12);

    // Create student
    const [student] = await db
      .insert(students)
      .values({
        email,
        passwordHash,
        name,
      })
      .returning({
        id: students.id,
        email: students.email,
        name: students.name,
        readingLevel: students.readingLevel,
        xp: students.xp,
        streakDays: students.streakDays,
        onboardingDone: students.onboardingDone,
        createdAt: students.createdAt,
      });

    // Generate JWT
    const token = await signToken({
      sub: student.id,
      role: "student",
      email: student.email,
    });

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);

    if (
      error instanceof Error &&
      error.message.includes("unique constraint")
    ) {
      return conflict("An account with this email already exists");
    }

    return internalError();
  }
}
