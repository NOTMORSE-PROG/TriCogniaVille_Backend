import { NextResponse } from "next/server";

/**
 * The offline-first sync endpoint has been removed. The Godot client now
 * writes every state change directly via `POST /quests`, `POST /story-progress`,
 * `POST /onboarding/complete`, and `PATCH /me`.
 *
 * We deliberately keep this file (instead of returning 404) so old APK builds
 * still in the wild see a clear "please update" error rather than an opaque
 * crash. Remove the file once telemetry shows zero hits.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Sync endpoint removed. Please update the TriCognia Ville app.",
      code: "GONE",
    },
    { status: 410 }
  );
}
