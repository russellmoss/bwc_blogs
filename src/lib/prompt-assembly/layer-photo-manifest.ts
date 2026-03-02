import type { PromptLayer } from "@/types/claude";
import type { PhotoManifest } from "@/types/photo";

export function buildLayerPhotoManifest(manifest: PhotoManifest | null): PromptLayer {
  if (!manifest || manifest.photos.length === 0) {
    return {
      name: "Photo Manifest",
      content: "PHOTOS: No photos have been selected for this article. Do NOT include image content nodes. Set heroImage to null.",
      tokenEstimate: 30,
    };
  }

  const lines: string[] = [
    "SELECTED PHOTOS FOR THIS ARTICLE:",
    `Total available: ${manifest.totalAvailable}`,
    `Hero photo ID: ${manifest.heroPhotoId ?? "Not assigned"}`,
    "",
  ];

  for (const photo of manifest.photos) {
    lines.push(`Photo ID ${photo.id}:`);
    lines.push(`  Filename: ${photo.filename}`);
    lines.push(`  Category: ${photo.category || "uncategorized"}`);
    lines.push(`  Description: ${photo.description || "No description"}`);
    lines.push(`  Alt text: ${photo.altText || "Needs alt text"}`);
    lines.push(`  Classification: ${photo.classification}`);
    if (photo.cloudinaryUrl) {
      lines.push(`  CDN URL: ${photo.cloudinaryUrl}`);
    } else if (photo.driveUrl) {
      lines.push(`  Drive URL (temporary): ${photo.driveUrl}`);
    }
    if (photo.widthPx && photo.heightPx) {
      lines.push(`  Dimensions: ${photo.widthPx}x${photo.heightPx}`);
    }
    lines.push("");
  }

  lines.push("INSTRUCTIONS:");
  lines.push("- Use the photo IDs, URLs, alt text, and dimensions provided above");
  lines.push("- Assign hero image using the designated hero photo ID");
  lines.push("- Place inline images contextually within relevant sections");
  lines.push("- Informative images: alt text 10-25 words describing the image");
  lines.push('- Decorative images: alt=""');

  const content = lines.join("\n");

  return {
    name: "Photo Manifest",
    content,
    tokenEstimate: Math.ceil(content.length / 4),
  };
}
