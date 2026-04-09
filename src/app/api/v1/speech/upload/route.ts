import { NextRequest, NextResponse } from "next/server";
import { withStudentAuth } from "@/lib/auth/middleware";
import { internalError } from "@/lib/api/errors";
import { uploadAudioToCloudinary } from "@/lib/cloudinary/upload-audio";

export async function POST(request: NextRequest) {
  return withStudentAuth(request, async (req: NextRequest) => {
    try {
      const body = await req.json();
      const audio: string | undefined = body.audio;

      if (!audio || typeof audio !== "string" || audio.length < 100) {
        return NextResponse.json(
          { error: "Missing or invalid audio data" },
          { status: 400 }
        );
      }

      const audioUrl = await uploadAudioToCloudinary(audio);

      return NextResponse.json({ audioUrl }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "UPLOAD_TIMEOUT") {
        return NextResponse.json(
          { error: "Audio upload timed out", code: "UPLOAD_TIMEOUT" },
          { status: 408 }
        );
      }
      console.error("Upload audio error:", error);
      return internalError();
    }
  });
}
