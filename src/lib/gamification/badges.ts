import { db } from "@/lib/db";
import {
  students,
  studentBadges,
  buildingStates,
  questAttempts,
} from "@/lib/db/schema";
import { BADGE_DEFINITIONS } from "@/lib/db/badge-definitions";
import { eq, and } from "drizzle-orm";

/**
 * Check all badge conditions for a student and insert any newly earned badges.
 * Idempotent — the composite PK on student_badges prevents double-awarding.
 * Returns the IDs of badges newly awarded this call.
 */
export async function checkAndAwardBadges(studentId: string): Promise<string[]> {
  // 4 parallel reads — minimal DB round-trips
  const [studentRows, buildingRows, questRows, existingRows] = await Promise.all([
    db
      .select({
        xp: students.xp,
        streakDays: students.streakDays,
        readingLevel: students.readingLevel,
      })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1),

    db
      .select({ buildingId: buildingStates.buildingId })
      .from(buildingStates)
      .where(
        and(
          eq(buildingStates.studentId, studentId),
          eq(buildingStates.unlocked, true)
        )
      ),

    db
      .select({ passed: questAttempts.passed, attempts: questAttempts.attempts })
      .from(questAttempts)
      .where(eq(questAttempts.studentId, studentId)),

    db
      .select({ badgeId: studentBadges.badgeId })
      .from(studentBadges)
      .where(eq(studentBadges.studentId, studentId)),
  ]);

  if (!studentRows.length) return [];

  const student = studentRows[0];
  const unlockedBuildings = new Set(buildingRows.map((b) => b.buildingId));
  const passedQuests = questRows.filter((q) => q.passed);
  const hasPerfectFirst = questRows.some((q) => q.passed && q.attempts === 1);
  const alreadyEarned = new Set(existingRows.map((b) => b.badgeId));

  const toAward: string[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (alreadyEarned.has(badge.id)) continue;

    let earned = false;

    switch (badge.category) {
      case "building":
        earned =
          badge.requirementKey != null &&
          unlockedBuildings.has(badge.requirementKey);
        break;

      case "streak":
        earned =
          badge.requirementValue != null &&
          student.streakDays >= badge.requirementValue;
        break;

      case "xp":
        earned =
          badge.requirementValue != null &&
          student.xp >= badge.requirementValue;
        break;

      case "quest":
        if (badge.id === "quest_perfect_first") {
          earned = hasPerfectFirst;
        } else {
          earned =
            badge.requirementValue != null &&
            passedQuests.length >= badge.requirementValue;
        }
        break;

      case "level":
        earned =
          badge.requirementValue != null &&
          student.readingLevel >= badge.requirementValue;
        break;
    }

    if (earned) toAward.push(badge.id);
  }

  // Race-safe awarding: use .returning() so we only report badges we actually
  // inserted. If two concurrent callers both see the same badge as un-earned,
  // only the one whose INSERT won the PK race will get a row back — and only
  // that caller's client will show the unlock notification.
  if (toAward.length > 0) {
    const inserted = await db
      .insert(studentBadges)
      .values(toAward.map((badgeId) => ({ studentId, badgeId })))
      .onConflictDoNothing()
      .returning({ badgeId: studentBadges.badgeId });
    return inserted.map((r) => r.badgeId);
  }

  return [];
}
