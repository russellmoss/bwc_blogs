import type { PromptLayer } from "@/types/claude";
import type { PhotoManifest } from "@/types/photo";

export function buildLayerPhotoManifest(manifest: PhotoManifest | null): PromptLayer {
  if (!manifest || manifest.photos.length === 0) {
    return {
      name: "Photo Manifest",
      content: "PHOTOS: No photos have been cataloged in the library. Do NOT include image content nodes. Set heroImage to null.",
      tokenEstimate: 30,
    };
  }

  const lines: string[] = [
    "AVAILABLE PHOTO LIBRARY:",
    `Total photos in library: ${manifest.totalAvailable}`,
    `Pre-assigned hero photo ID: ${manifest.heroPhotoId ?? "None — you choose the best hero image"}`,
    "",
  ];

  // List all photos (cap at 50 to avoid token budget issues)
  const photosToList = manifest.photos.slice(0, 50);
  for (const photo of photosToList) {
    lines.push(`Photo ID ${photo.id}:`);
    lines.push(`  Filename: ${photo.filename}`);
    lines.push(`  Category: ${photo.category || "uncategorized"}`);
    lines.push(`  Base Description: ${photo.description || "No description"}`);
    lines.push(`  Base Alt Text: ${photo.altText || "Needs alt text"}`);
    lines.push(`  Classification: ${photo.classification}`);
    if (photo.cloudinaryUrl) {
      lines.push(`  CDN URL: ${photo.cloudinaryUrl}`);
    } else if (photo.driveUrl) {
      lines.push(`  Drive URL (temporary): ${photo.driveUrl}`);
    }
    if (photo.widthPx && photo.heightPx) {
      lines.push(`  Dimensions: ${photo.widthPx}x${photo.heightPx}`);
    }
    if (photo.vineyardName) {
      lines.push(`  Vineyard: ${photo.vineyardName}`);
    }
    if (photo.season) {
      lines.push(`  Season: ${photo.season}`);
    }
    lines.push("");
  }

  if (manifest.photos.length > 50) {
    lines.push(`(${manifest.photos.length - 50} additional photos not shown — use the most relevant from above)`);
    lines.push("");
  }

  lines.push("AUTO-SELECT INSTRUCTIONS:");
  lines.push("- You have access to the full photo library above. Select the most relevant photos for this article.");
  lines.push("- Choose 1 hero image and appropriate inline images based on article type:");
  lines.push("  Hub: 5-8 images total | Spoke: 3-5 images total | News: 1-3 images total");
  lines.push("- Match photos to sections by relevance: vineyard photos near vineyard discussion, winemaking photos near process descriptions, etc.");
  lines.push("- Use Photo IDs in your ImagePlacement nodes. Set photoId to the selected photo's ID.");
  lines.push("- Set cloudinaryPublicId to null (populated on finalization).");
  lines.push("- Use the photo's CDN URL or Drive URL as the src value.");
  lines.push("- If no suitable photo exists for a section, omit the image node — do NOT hallucinate photo IDs.");
  lines.push("- NEVER use the same photo more than once in an article. Each Photo ID must appear at most once across heroImage and all section images. No duplicates.");
  lines.push("- Hero photo: if a heroPhotoId is pre-assigned above, use it. Otherwise, select the most impactful/relevant photo.");
  lines.push("");
  lines.push("SEO DYNAMIC METADATA — CRITICAL:");
  lines.push("- Do NOT copy the library's base alt-text or description verbatim into your ImagePlacement nodes.");
  lines.push("- REWRITE each selected photo's alt text to incorporate THIS article's target SEO keywords and context.");
  lines.push("- Example: Library base alt = \"Grape clusters on vines at Bajo vineyard\"");
  lines.push("  Article keyword = \"organic winemaking Bhutan\"");
  lines.push("  Rewritten alt = \"Organic grape clusters ripening on sustainably managed vines at Bajo vineyard in Bhutan\"");
  lines.push("- The same applies to captions: rewrite them to reinforce the article's SEO focus, not the generic library description.");
  lines.push("- Alt text rules still apply: 10-25 words, factual (describe what is VISIBLE), include location if identifiable.");
  lines.push("- Captions should add editorial context that supports the article's narrative and SEO targets.");
  lines.push('- Decorative images: alt=""');

  const content = lines.join("\n");

  return {
    name: "Photo Manifest",
    content,
    tokenEstimate: Math.ceil(content.length / 4),
  };
}
