import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { students, questAttempts, buildingStates, storyProgress } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { syncSchema, formatZodError } from "@/lib/api/validators";
import { internalError } from "@/lib/api/errors";
import { eq, and } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";
import { checkAndAwardBadges } from "@/lib/gamification/badges";

export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest, user: TokenPayload) => {
    try {
      const body = await req.json();
      const parsed = syncSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      const data = parsed.data;
      const db = getDbPool();

      // Everything runs in a single transaction so a mid-sync failure rolls back
      // cleanly. The Godot client only marks records synced on 200, so a rollback
      // means the next sync will retry the exact same batch.
      const { syncedQuests, syncedBuildings, syncedStoryProgress, updatedStudent } =
        await db.transaction(async (tx) => {
          // Update student profile fields if provided
          const studentUpdates: Record<string, unknown> = {
            updatedAt: new Date(),
            lastActive: new Date(),
          };
          if (data.xp !== undefined) studentUpdates.xp = data.xp;
          if (data.streakDays !== undefined)
            studentUpdates.streakDays = data.streakDays;
          if (data.readingLevel !== undefined)
            studentUpdates.readingLevel = data.readingLevel;
          if (data.onboardingDone !== undefined)
            studentUpdates.onboardingDone = data.onboardingDone;

          await tx
            .update(students)
            .set(studentUpdates)
            .where(eq(students.id, user.sub));

          // Sync quest attempts
          let syncedQuests = 0;
          for (const quest of data.questAttempts) {
            await tx.insert(questAttempts).values({
              studentId: user.sub,
              questId: quest.questId,
              buildingId: quest.buildingId,
              passed: quest.passed,
              score: quest.score ?? null,
              totalItems: quest.totalItems ?? null,
              attempts: quest.attempts,
              completedAt: quest.completedAt
                ? new Date(quest.completedAt)
                : null,
            });
            syncedQuests++;
          }

          // Sync building states (upsert)
          let syncedBuildings = 0;
          for (const building of data.buildingStates) {
            const [existing] = await tx
              .select()
              .from(buildingStates)
              .where(
                and(
                  eq(buildingStates.studentId, user.sub),
                  eq(buildingStates.buildingId, building.buildingId)
                )
              )
              .limit(1);

            if (existing) {
              await tx
                .update(buildingStates)
                .set({
                  unlocked: building.unlocked,
                  unlockedAt: building.unlockedAt
                    ? new Date(building.unlockedAt)
                    : existing.unlockedAt,
                  syncedAt: new Date(),
                })
                .where(
                  and(
                    eq(buildingStates.studentId, user.sub),
                    eq(buildingStates.buildingId, building.buildingId)
                  )
                );
            } else {
              await tx.insert(buildingStates).values({
                studentId: user.sub,
                buildingId: building.buildingId,
                unlocked: building.unlocked,
                unlockedAt: building.unlockedAt
                  ? new Date(building.unlockedAt)
                  : null,
              });
            }
            syncedBuildings++;
          }

          // Sync story progress (upsert, flags are monotonic — once true, stay true)
          let syncedStoryProgress = 0;
          for (const story of data.storyProgress) {
            const [existing] = await tx
              .select()
              .from(storyProgress)
              .where(
                and(
                  eq(storyProgress.studentId, user.sub),
                  eq(storyProgress.buildingId, story.buildingId)
                )
              )
              .limit(1);

            if (existing) {
              await tx
                .update(storyProgress)
                .set({
                  prologueSeen: story.prologueSeen || existing.prologueSeen,
                  introSeen: story.introSeen || existing.introSeen,
                  outroSeen: story.outroSeen || existing.outroSeen,
                  endingSeen: story.endingSeen || existing.endingSeen,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(storyProgress.studentId, user.sub),
                    eq(storyProgress.buildingId, story.buildingId)
                  )
                );
            } else {
              await tx.insert(storyProgress).values({
                studentId: user.sub,
                buildingId: story.buildingId,
                prologueSeen: story.prologueSeen,
                introSeen: story.introSeen,
                outroSeen: story.outroSeen,
                endingSeen: story.endingSeen,
              });
            }
            syncedStoryProgress++;
          }

          // Fetch updated student profile (inside tx so the response reflects the
          // post-commit state rather than stale pre-tx data)
          const [updatedStudent] = await tx
            .select({
              id: students.id,
              email: students.email,
              name: students.name,
              readingLevel: students.readingLevel,
              xp: students.xp,
              streakDays: students.streakDays,
              onboardingDone: students.onboardingDone,
            })
            .from(students)
            .where(eq(students.id, user.sub))
            .limit(1);

          return { syncedQuests, syncedBuildings, syncedStoryProgress, updatedStudent };
        });

      // Badge check runs AFTER the transaction commits — it reads committed state
      // and inserts into student_badges (which is safe to be non-transactional
      // because its PK prevents duplicates).
      const newBadges = await checkAndAwardBadges(user.sub).catch((err) => {
        console.error("Badge check failed (sync):", err);
        return [] as string[];
      });

      return NextResponse.json({
        synced: {
          quests: syncedQuests,
          buildings: syncedBuildings,
          storyProgress: syncedStoryProgress,
        },
        student: updatedStudent,
        badges: newBadges,
      });
    } catch (error) {
      console.error("Sync error:", error);
      return internalError();
    }
  });
}
