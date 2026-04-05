import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, questAttempts, buildingStates } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { syncSchema, formatZodError } from "@/lib/api/validators";
import { internalError } from "@/lib/api/errors";
import { eq, and } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest, user: TokenPayload) => {
    try {
      const body = await req.json();
      const parsed = syncSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      const data = parsed.data;
      const errors: string[] = [];
      let syncedQuests = 0;
      let syncedBuildings = 0;

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

      await db
        .update(students)
        .set(studentUpdates)
        .where(eq(students.id, user.sub));

      // Sync quest attempts
      for (const quest of data.questAttempts) {
        try {
          await db.insert(questAttempts).values({
            studentId: user.sub,
            questId: quest.questId,
            buildingId: quest.buildingId,
            passed: quest.passed,
            attempts: quest.attempts,
            completedAt: quest.completedAt
              ? new Date(quest.completedAt)
              : null,
          });
          syncedQuests++;
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : "Unknown error";
          errors.push(`Quest ${quest.questId}: ${msg}`);
        }
      }

      // Sync building states (upsert)
      for (const building of data.buildingStates) {
        try {
          // Check if exists
          const [existing] = await db
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
            await db
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
            await db.insert(buildingStates).values({
              studentId: user.sub,
              buildingId: building.buildingId,
              unlocked: building.unlocked,
              unlockedAt: building.unlockedAt
                ? new Date(building.unlockedAt)
                : null,
            });
          }
          syncedBuildings++;
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : "Unknown error";
          errors.push(`Building ${building.buildingId}: ${msg}`);
        }
      }

      // Fetch updated student profile
      const [updatedStudent] = await db
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

      return NextResponse.json({
        synced: {
          quests: syncedQuests,
          buildings: syncedBuildings,
        },
        errors: errors.length > 0 ? errors : undefined,
        student: updatedStudent,
      });
    } catch (error) {
      console.error("Sync error:", error);
      return internalError();
    }
  });
}
