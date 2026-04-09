import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload base64-encoded audio to Cloudinary with a 30-second timeout.
 * Returns the secure URL of the uploaded file.
 */
export async function uploadAudioToCloudinary(
  base64Audio: string
): Promise<string> {
  const uploadPromise = cloudinary.uploader.upload(
    `data:audio/mpeg;base64,${base64Audio}`,
    {
      resource_type: "video",
      folder: "tricognia/speech",
      format: "mp3",
    }
  );

  const result = await Promise.race([
    uploadPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("UPLOAD_TIMEOUT")), 30_000)
    ),
  ]);

  return result.secure_url;
}

/**
 * Delete an audio file from Cloudinary by its URL.
 * Extracts the public_id from the URL and calls destroy().
 * Safe to call with old M4A URLs — handles both formats.
 */
export async function deleteAudioFromCloudinary(
  audioUrl: string
): Promise<void> {
  // Match public_id: "tricognia/speech/<id>" (no extension, no version)
  const match = audioUrl.match(/\/tricognia\/speech\/([^./]+)/);
  if (!match) return;
  const publicId = `tricognia/speech/${match[1]}`;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
  } catch {
    // Best-effort — log but don't throw
    console.warn(`[Cloudinary] Failed to delete ${publicId}`);
  }
}
