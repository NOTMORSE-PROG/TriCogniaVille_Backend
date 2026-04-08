import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  students,
  studentBadges,
  buildingStates,
  questAttempts,
  storyProgress,
} from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { notFound, internalError } from "@/lib/api/errors";
import { eq, and, count, desc } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";
import { getLevelInfo } from "@/lib/gamification/levels";
import { BADGE_DEFINITIONS } from "@/lib/db/badge-definitions";

export async function GET(request: NextRequest) {
  return withStudentAuth(request, async (_req: NextRequest, user: TokenPayload) => {
    try {
      const [
        studentRows,
        earnedRows,
        buildingRows,
        questCountRows,
        storyRows,
        recentQuestRows,
      ] = await Promise.all([
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

        // All building rows for this student. We derive both the unlocked
        // list and the tutorial-done list from this single query.
        db
          .select({
            buildingId: buildingStates.buildingId,
            unlocked: buildingStates.unlocked,
            tutorialDone: buildingStates.tutorialDone,
          })
          .from(buildingStates)
          .where(eq(buildingStates.studentId, user.sub)),

        db
          .select({ total: count() })
          .from(questAttempts)
          .where(
            and(
              eq(questAttempts.studentId, user.sub),
              eq(questAttempts.passed, true)
            )
          ),

        // Story progress for the boot hydration. Hard-capped by table shape:
        // at most one row per building (max ~7 rows).
        db
          .select({
            buildingId: storyProgress.buildingId,
            prologueSeen: storyProgress.prologueSeen,
            introSeen: storyProgress.introSeen,
            outroSeen: storyProgress.outroSeen,
            endingSeen: storyProgress.endingSeen,
          })
          .from(storyProgress)
          .where(eq(storyProgress.studentId, user.sub)),

        // Recent quest attempts — HARD CAP 10. Used by the client only to
        // populate the tracker UI; teacher dashboard uses /quests GET (limit 100).
        db
          .select({
            id: questAttempts.id,
            attemptId: questAttempts.attemptId,
            questId: questAttempts.questId,
            buildingId: questAttempts.buildingId,
            passed: questAttempts.passed,
            score: questAttempts.score,
            totalItems: questAttempts.totalItems,
            completedAt: questAttempts.completedAt,
          })
          .from(questAttempts)
          .where(eq(questAttempts.studentId, user.sub))
          .orderBy(desc(questAttempts.createdAt))
          .limit(10),
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
        id: student.id,
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
          buildingsUnlocked: buildingRows.filter((b) => b.unlocked).length,
          earnedBadgeCount: earnedRows.length,
          totalBadgeCount: BADGE_DEFINITIONS.length,
        },
        unlockedBuildings: buildingRows.filter((b) => b.unlocked).map((b) => b.buildingId),
        tutorialBuildings: buildingRows.filter((b) => b.tutorialDone).map((b) => b.buildingId),
        storyProgress: storyRows,
        recentQuestAttempts: recentQuestRows,
      });
    } catch (error) {
      console.error("Get profile error:", error);
      return internalError();
    }
  });
}
