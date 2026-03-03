import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

// Existing config export (kept for backwards compatibility with renderer)
export const cloudinaryConfig = {
  url: process.env.CLOUDINARY_URL || '',
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'blog',
};

// SDK initialization (lazy singleton)
let configured = false;

export function getCloudinaryClient(): typeof cloudinary {
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}
