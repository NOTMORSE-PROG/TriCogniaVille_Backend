import { NextRequest, NextResponse } from "next/server";
import { db, getDbPool } from "@/lib/db";
import { questAttempts, students, buildingStates } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { questAttemptSchema, formatZodError } from "@/lib/api/validators";
import { internalError } from "@/lib/api/errors";
import { eq, and, desc } from "drizzle-orm";
import { TokenPayload } from "@/lib/auth/jwt";
import { checkAndAwardBadges } from "@/lib/gamification/badges";
import {
  QUEST_CONFIG,
  isValidBuildingId,
  isSequenceSatisfied,
  recomputePass,
  computeXpDelta,
  type BuildingId,
} from "@/lib/quests/quest-config";
import { nextStreak } from "@/lib/gamification/streak";

/**
 * POST /api/v1/quests
 *
 * Server-authoritative quest finalization. The Godot client posts the raw
 * (questId, buildingId, score, totalItems) and a client-generated UUID
 * `attemptId`. The server:
 *   1. Validates input (zod) and the building id against `quest-config.ts`.
 *   2. Recomputes pass/fail (client cannot lie about passing).
 *   3. Inside a single pool transaction:
 *      - Inserts the attempt with `ON CONFLICT (attempt_id) DO NOTHING` for
 *        idempotent retries (no double XP).
 *      - If passed and the building isn't already unlocked: validates the
 *        sequential UNLOCK_ORDER, then upserts `building_states.unlocked`,
 *        adds XP, recomputes reading level + streak, updates the student row
 *        in one statement.
 *      - Replays of an already-unlocked building award no XP.
 *      - Failed attempts are still recorded (for teacher analytics).
 *   4. After commit, fires `checkAndAwardBadges` (race-safe via student_badges PK).
 *
 * Response shape (frozen contract — Godot depends on this):
 *   {
 *     student: {...},                    // refreshed after the transaction
 *     questAttempt: {...},
 *     unlockedBuilding: { buildingId, unlockedAt } | null,
 *     newBadges: string[],
 *     levelUp: { from: number, to: number } | null
 *   }
 */
export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest, user: TokenPayload) => {
    try {
      const body = await req.json();
      const parsed = questAttemptSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      const data = parsed.data;
      if (!isValidBuildingId(data.buildingId)) {
        return NextResponse.json(
          { error: "Unknown buildingId", code: "BAD_BUILDING" },
          { status: 400 }
        );
      }
      const buildingId: BuildingId = data.buildingId;
      const cfg = QUEST_CONFIG[buildingId];
      const passed = recomputePass(buildingId, data.score, data.totalItems);

      const pool = getDbPool();

      type TxResult = {
        questAttempt: typeof questAttempts.$inferSelect;
        unlockedBuilding: { buildingId: string; unlockedAt: Date } | null;
        levelUp: { from: number; to: number } | null;
        student: typeof students.$inferSelect;
        idempotentReplay: boolean;
        sequenceViolation: boolean;
      };

      const result: TxResult = await pool.transaction(async (tx) => {
        // 1. Idempotent insert. If the attemptId already exists this is a
        //    retry — fetch the existing row, return it without touching XP.
        const inserted = await tx
          .insert(questAttempts)
          .values({
            attemptId: data.attemptId,
            studentId: user.sub,
            questId: cfg.questId,
            buildingId,
            passed,
            score: data.score,
            totalItems: data.totalItems,
            attempts: data.attempts,
            completedAt: data.completedAt
              ? new Date(data.completedAt)
              : new Date(),
          })
          .onConflictDoNothing({ target: questAttempts.attemptId })
          .returning();

        if (inserted.length === 0) {
          // Retry — load the existing attempt and current student, no mutation.
          const [existing] = await tx
            .select()
            .from(questAttempts)
            .where(eq(questAttempts.attemptId, data.attemptId))
            .limit(1);
          const [studentRow] = await tx
            .select()
            .from(students)
            .where(eq(students.id, user.sub))
            .limit(1);
          return {
            questAttempt: existing!,
            unlockedBuilding: null,
            levelUp: null,
            student: studentRow!,
            idempotentReplay: true,
            sequenceViolation: false,
          };
        }

        const attempt = inserted[0];

        // 2. Failed attempt — record only, no XP, no unlock.
        if (!passed) {
          const [studentRow] = await tx
            .select()
            .from(students)
            .where(eq(students.id, user.sub))
            .limit(1);
          return {
            questAttempt: attempt,
            unlockedBuilding: null,
            levelUp: null,
            student: studentRow!,
            idempotentReplay: false,
            sequenceViolation: false,
          };
        }

        // 3. Passed. Load current student + already-unlocked buildings.
        const [studentBefore] = await tx
          .select()
          .from(students)
          .where(eq(students.id, user.sub))
          .limit(1);
        if (!studentBefore) throw new Error("Student vanished mid-transaction");

        const unlockedRows = await tx
          .select({ buildingId: buildingStates.buildingId })
          .from(buildingStates)
          .where(
            and(
              eq(buildingStates.studentId, user.sub),
              eq(buildingStates.unlocked, true)
            )
          );
        const unlockedSet = new Set(unlockedRows.map((r) => r.buildingId));
        const isReplay = unlockedSet.has(buildingId);

        // 4. First-time unlock — enforce sequential UNLOCK_ORDER.
        if (!isReplay && !isSequenceSatisfied(buildingId, unlockedSet)) {
          // Roll back so the attempt row isn't kept either; the route handler
          // will turn this into a 409. Throwing is the cleanest abort.
          throw new SequenceViolationError();
        }

        // 5. Compute deltas (pass = base XP, perfect = base + 25 bonus).
        const xpDelta = computeXpDelta(buildingId, data.score, data.totalItems, isReplay);
        const newXp = studentBefore.xp + xpDelta;
        const newStreakValue = nextStreak(
          studentBefore.lastActive,
          studentBefore.streakDays
        );
        const now = new Date();

        // 6. Single UPDATE for all student-row mutations.
        const [studentAfter] = await tx
          .update(students)
          .set({
            xp: newXp,
            streakDays: newStreakValue,
            lastActive: now,
            updatedAt: now,
          })
          .where(eq(students.id, user.sub))
          .returning();

        // 7. Idempotent unlock upsert. PK is (studentId, buildingId).
        let unlockedBuilding: { buildingId: string; unlockedAt: Date } | null =
          null;
        if (!isReplay) {
          await tx
            .insert(buildingStates)
            .values({
              studentId: user.sub,
              buildingId,
              unlocked: true,
              unlockedAt: now,
            })
            .onConflictDoUpdate({
              target: [buildingStates.studentId, buildingStates.buildingId],
              set: { unlocked: true, unlockedAt: now, syncedAt: now },
            });
          unlockedBuilding = { buildingId, unlockedAt: now };
        }

        return {
          questAttempt: attempt,
          unlockedBuilding,
          levelUp: null,
          student: studentAfter,
          idempotentReplay: false,
          sequenceViolation: false,
        };
      });

      // Badge check runs AFTER commit. PK on student_badges is race-safe.
      const newBadges = await checkAndAwardBadges(user.sub).catch((err) => {
        console.error("Badge check failed (quests):", err);
        return [] as string[];
      });

      return NextResponse.json(
        {
          student: result.student,
          questAttempt: result.questAttempt,
          unlockedBuilding: result.unlockedBuilding,
          newBadges,
          levelUp: result.levelUp,
        },
        { status: result.idempotentReplay ? 200 : 201 }
      );
    } catch (error) {
      if (error instanceof SequenceViolationError) {
        return NextResponse.json(
          {
            error:
              "Cannot unlock this building — earlier buildings in the sequence are still locked.",
            code: "SEQUENCE_VIOLATION",
          },
          { status: 409 }
        );
      }
      console.error("Record quest error:", error);
      return internalError();
    }
  });
}

class SequenceViolationError extends Error {
  constructor() {
    super("SEQUENCE_VIOLATION");
    this.name = "SequenceViolationError";
  }
}

export async function GET(request: NextRequest) {
  return withStudentAuth(request, async (_req: NextRequest, user: TokenPayload) => {
    try {
      const attempts = await db
        .select()
        .from(questAttempts)
        .where(eq(questAttempts.studentId, user.sub))
        .orderBy(desc(questAttempts.createdAt))
        .limit(100);

      return NextResponse.json({ questAttempts: attempts });
    } catch (error) {
      console.error("Get quests error:", error);
      return internalError();
    }
  });
}
