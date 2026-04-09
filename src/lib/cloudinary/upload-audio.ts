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
    `data:audio/mp4;base64,${base64Audio}`,
    {
      resource_type: "video",
      folder: "tricognia/speech",
      format: "m4a",
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
