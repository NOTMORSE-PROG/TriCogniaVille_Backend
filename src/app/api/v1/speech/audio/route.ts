import { NextRequest, NextResponse } from "next/server";
import { deleteAudioFromCloudinary } from "@/lib/cloudinary/upload-audio";
import { withStudentAuth } from "@/lib/auth/middleware";
import { TokenPayload } from "@/lib/auth/jwt";

/**
 * DELETE /api/v1/speech/audio
 * Body: { audioUrls: string[] }
 *
 * Deletes audio recordings from Cloudinary for a student's incomplete quest session.
 * Called when a student quits or abandons a quest without completing it.
 * Best-effort — individual deletion failures do not fail the request.
 */
export async function DELETE(request: NextRequest) {
  return withStudentAuth(
    request,
    async (req: NextRequest, _user: TokenPayload) => {
      try {
        const body = await req.json();
        const audioUrls: unknown = body?.audioUrls;

        if (!Array.isArray(audioUrls)) {
          return NextResponse.json(
            { error: "audioUrls must be an array" },
            { status: 400 }
          );
        }

        const urls = audioUrls.filter(
          (u): u is string => typeof u === "string" && u.length > 0
        );

        // Best-effort deletion — ignore individual failures
        await Promise.allSettled(urls.map((url) => deleteAudioFromCloudinary(url)));

        return NextResponse.json({ deleted: urls.length });
      } catch (error) {
        console.error("[speech/audio DELETE] Error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
      }
    }
  );
}
