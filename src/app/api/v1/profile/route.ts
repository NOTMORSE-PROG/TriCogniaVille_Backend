import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, studentBadges, buildingStates, questAttempts } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { notFound, internalError } from "@/lib/api/errors";
import { eq, and, count } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";
import { getLevelInfo } from "@/lib/gamification/levels";
import { BADGE_DEFINITIONS } from "@/lib/db/badge-definitions";

export async function GET(request: NextRequest) {
  return withStudentAuth(request, async (_req: NextRequest, user: TokenPayload) => {
    try {
      const [studentRows, earnedRows, buildingRows, questCountRows] = await Promise.all([
        db
          .select({
            id: students.id,
            name: students.name,
            email: students.email,
            xp: students.xp,
            streakDays: students.streakDays,
            readingLevel: students.readingLevel,
            lastActive: students.lastActive,
            onboardingDone: students.onboardingDone,
            username: students.username,
            characterGender: students.characterGender,
            tutorialDone: students.tutorialDone,
          })
          .from(students)
          .where(eq(students.id, user.sub))
          .limit(1),

        db
          .select({ badgeId: studentBadges.badgeId, earnedAt: studentBadges.earnedAt })
          .from(studentBadges)
          .where(eq(studentBadges.studentId, user.sub)),

        db
          .select({ buildingId: buildingStates.buildingId })
          .from(buildingStates)
          .where(
            and(
              eq(buildingStates.studentId, user.sub),
              eq(buildingStates.unlocked, true)
            )
          ),

        db
          .select({ total: count() })
          .from(questAttempts)
          .where(
            and(
              eq(questAttempts.studentId, user.sub),
              eq(questAttempts.passed, true)
            )
          ),
      ]);

      if (!studentRows.length) {
        return notFound("Student not found");
      }

      const student = studentRows[0];
      const earnedMap = new Map(earnedRows.map((r) => [r.badgeId, r.earnedAt]));
      const levelInfo = getLevelInfo(student.xp);

      const badgeList = BADGE_DEFINITIONS.map((def) => ({
        ...def,
        earned: earnedMap.has(def.id),
        earnedAt: earnedMap.get(def.id) ?? null,
      }));

      return NextResponse.json({
        name: student.name,
        email: student.email,
        username: student.username,
        characterGender: student.characterGender,
        tutorialDone: student.tutorialDone,
        xp: student.xp,
        streakDays: student.streakDays,
        readingLevel: student.readingLevel,
        lastActive: student.lastActive,
        onboardingDone: student.onboardingDone,
        level: levelInfo,
        badges: badgeList,
        stats: {
          questsPassed: questCountRows[0]?.total ?? 0,
          buildingsUnlocked: buildingRows.length,
          earnedBadgeCount: earnedRows.length,
          totalBadgeCount: BADGE_DEFINITIONS.length,
        },
      });
    } catch (error) {
      console.error("Get profile error:", error);
      return internalError();
    }
  });
}
