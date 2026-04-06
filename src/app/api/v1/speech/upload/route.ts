import { NextRequest, NextResponse } from "next/server";
import { withStudentAuth } from "@/lib/auth/middleware";
import { internalError } from "@/lib/api/errors";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

      // Cloudinary treats audio as "video" resource type
      const result = await cloudinary.uploader.upload(
        `data:audio/mp4;base64,${audio}`,
        {
          resource_type: "video",
          folder: "tricognia/speech",
          format: "m4a",
        }
      );

      return NextResponse.json(
        { audioUrl: result.secure_url },
        { status: 201 }
      );
    } catch (error) {
      console.error("Upload audio error:", error);
      return internalError();
    }
  });
}
