import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { speechAssessments } from "@/lib/db/schema";
import { withStudentAuth } from "@/lib/auth/middleware";
import { speechAssessSchema, formatZodError } from "@/lib/api/validators";
import { internalError } from "@/lib/api/errors";
import { TokenPayload } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest, user: TokenPayload) => {
    try {
      const body = await req.json();
      const parsed = speechAssessSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(formatZodError(parsed.error), { status: 400 });
      }

      const d = parsed.data;

      const [assessment] = await db
        .insert(speechAssessments)
        .values({
          studentId: user.sub,
          questId: d.questId,
          buildingId: d.buildingId,
          stage: d.stage,
          expectedText: d.expectedText,
          transcript: d.transcript ?? null,
          confidence: d.confidence ?? null,
          score: d.score,
          feedback: d.feedback ?? null,
          errorTypes: d.errorTypes ? JSON.stringify(d.errorTypes) : null,
          flagReview: d.flagReview,
          attemptNumber: d.attemptNumber ?? 1,
          audioUrl: d.audioUrl ?? null,
        })
        .returning({ id: speechAssessments.id });

      return NextResponse.json({ assessmentId: assessment.id }, { status: 201 });
    } catch (error) {
      console.error("Submit speech assessment error:", error);
      return internalError();
    }
  });
}
