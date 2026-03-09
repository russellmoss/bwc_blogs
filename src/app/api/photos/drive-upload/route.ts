import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getClaudeClient, getModelId } from "@/lib/claude/client";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export const maxDuration = 60; // seconds — AI describe needs time

/**
 * Run AI Vision describe on a photo URL.
 * Returns { altText, description, suggestedCategory } or null on failure.
 */
async function aiDescribe(imageUrl: string): Promise<{
  altText: string;
  description: string;
  suggestedCategory: string;
} | null> {
  try {
    const client = getClaudeClient();
    const response = await client.messages.create({
      model: getModelId(),
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            {
              type: "text",
              text: `You are an image analyst for Bhutan Wine Company's blog content engine.
Analyze this photo and return a JSON object with exactly these fields:

{
  "altText": "10-25 word descriptive alt text for SEO. Be specific about vineyard locations, grape varieties, wine processes, or cultural elements visible.",
  "description": "1-2 sentence description of the image content for content writers.",
  "suggestedCategory": "vineyard|winemaking|culture|team|food|landscape"
}

Rules:
- Alt text must describe what is VISIBLE, not assumed
- For atmospheric/decorative shots, note that in the description
- Return ONLY the JSON object`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const result = JSON.parse(jsonText);
    return {
      altText: result.altText || "",
      description: result.description || "",
      suggestedCategory: result.suggestedCategory || "uncategorized",
    };
  } catch (e) {
    console.error("[photo-upload] AI describe failed:", e);
    return null;
  }
}

/**
 * POST /api/photos/drive-upload
 *
 * Accepts two modes:
 * 1. JSON body with Cloudinary result (client-side upload — used on Vercel)
 *    { cloudinaryPublicId, cloudinaryUrl, width, height, filename, category?, vineyardName?, season? }
 * 2. FormData with file (server-side upload — works locally, limited to 4.5MB on Vercel)
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const contentType = request.headers.get("content-type") || "";

    let cloudinaryPublicId: string;
    let cloudinaryUrl: string;
    let width: number;
    let height: number;
    let filename: string;
    let category: string | null = null;
    let vineyardName: string | null = null;
    let season: string | null = null;

    if (contentType.includes("application/json")) {
      // Mode 1: Client already uploaded to Cloudinary — just catalog
      const body = await request.json();
      cloudinaryPublicId = body.cloudinaryPublicId;
      cloudinaryUrl = body.cloudinaryUrl;
      width = body.width;
      height = body.height;
      filename = body.filename;
      category = body.category || null;
      vineyardName = body.vineyardName || null;
      season = body.season || null;

      if (!cloudinaryPublicId || !cloudinaryUrl || !filename) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "cloudinaryPublicId, cloudinaryUrl, and filename are required" } },
          { status: 400 }
        );
      }
    } else {
      // Mode 2: FormData — upload file through server to Cloudinary
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      category = (formData.get("category") as string) || null;
      vineyardName = (formData.get("vineyardName") as string) || null;
      season = (formData.get("season") as string) || null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "file is required" } },
          { status: 400 }
        );
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "Only JPEG, PNG, WebP files are allowed" } },
          { status: 400 }
        );
      }

      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "File must be under 20MB" } },
          { status: 400 }
        );
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const publicId = `${baseName}_${Date.now()}`;

      console.log("[photo-upload] Uploading %s (%d bytes) to Cloudinary...", file.name, file.size);

      const cloudinaryResult = await uploadToCloudinary(fileBuffer, {
        publicId,
        folder: "blog",
      });

      cloudinaryPublicId = cloudinaryResult.publicId;
      cloudinaryUrl = cloudinaryResult.secureUrl;
      width = cloudinaryResult.width;
      height = cloudinaryResult.height;
      filename = file.name;

      console.log("[photo-upload] Cloudinary upload complete: %s", cloudinaryPublicId);
    }

    // Create Photo record
    const photo = await prisma.photo.create({
      data: {
        cloudinaryPublicId,
        cloudinaryUrl,
        filename,
        category,
        vineyardName,
        season,
        classification: "informative",
        widthPx: width || null,
        heightPx: height || null,
        uploadedToCdn: true,
      },
    });

    // Auto-run AI Vision describe
    console.log("[photo-upload] Running AI Vision describe...");
    const aiResult = await aiDescribe(cloudinaryUrl);

    let updatedPhoto = photo;
    if (aiResult) {
      updatedPhoto = await prisma.photo.update({
        where: { id: photo.id },
        data: {
          altText: aiResult.altText,
          description: aiResult.description,
          category: aiResult.suggestedCategory || category,
        },
      });
      console.log("[photo-upload] AI describe saved — category: %s", aiResult.suggestedCategory);
    } else {
      console.log("[photo-upload] AI describe skipped — photo saved without AI metadata");
    }

    return NextResponse.json({ success: true, data: updatedPhoto }, { status: 201 });
  } catch (error) {
    console.error("[photo-upload] Error:", error);
    const message = error instanceof Error ? error.message : String(error);

    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
