import type { CloudinaryTransform } from "@/types/photo";
import { env } from "@/lib/env";

/**
 * Build a Cloudinary CDN URL with optional transforms.
 * Returns empty string if publicId is null/empty.
 * URL pattern: https://res.cloudinary.com/{cloudName}/image/upload/{transforms}/{publicId}
 */
export function buildCloudinaryUrl(
  publicId: string | null,
  transforms?: Partial<CloudinaryTransform>
): string {
  if (!publicId) return "";

  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return "";

  const parts: string[] = [];
  if (transforms?.width) parts.push(`w_${transforms.width}`);
  parts.push(`f_${transforms?.format || "auto"}`);
  parts.push(`q_${transforms?.quality || "auto"}`);
  if (transforms?.additionalParams) parts.push(transforms.additionalParams);

  const transformStr = parts.join(",");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformStr}/${publicId}`;
}
