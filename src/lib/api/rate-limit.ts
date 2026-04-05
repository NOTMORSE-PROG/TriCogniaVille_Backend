import { db } from "@/lib/db";
import { failedLoginAttempts } from "@/lib/db/schema";
import { and, eq, gte } from "drizzle-orm";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

export async function checkRateLimit(
  email: string,
  ipAddress: string | null
): Promise<{ allowed: boolean; retryAfterMinutes?: number }> {
  const windowStart = new Date(
    Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000
  );

  const recentAttempts = await db
    .select()
    .from(failedLoginAttempts)
    .where(
      and(
        eq(failedLoginAttempts.email, email),
        gte(failedLoginAttempts.attemptedAt, windowStart)
      )
    );

  if (recentAttempts.length >= MAX_FAILED_ATTEMPTS) {
    return { allowed: false, retryAfterMinutes: LOCKOUT_WINDOW_MINUTES };
  }

  return { allowed: true };
}

export async function recordFailedAttempt(
  email: string,
  ipAddress: string | null
): Promise<void> {
  await db.insert(failedLoginAttempts).values({
    email,
    ipAddress,
  });
}
