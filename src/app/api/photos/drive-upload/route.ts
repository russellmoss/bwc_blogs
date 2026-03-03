import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getClaudeClient, getModelId } from "@/lib/claude/client";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

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

// POST /api/photos/drive-upload — Upload file from UI directly to Cloudinary, catalog, AI describe
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || null;
    const vineyardName = (formData.get("vineyardName") as string) || null;
    const season = (formData.get("season") as string) || null;

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

    // 1. Upload directly to Cloudinary
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const publicId = `${baseName}_${Date.now()}`;

    console.log("[photo-upload] Uploading %s (%d bytes) to Cloudinary...", file.name, file.size);

    const cloudinaryResult = await uploadToCloudinary(fileBuffer, {
      publicId,
      folder: "blog",
    });

    console.log("[photo-upload] Cloudinary upload complete: %s", cloudinaryResult.publicId);

    // 2. Create Photo record
    const photo = await prisma.photo.create({
      data: {
        driveFileId: null,
        driveUrl: null,
        cloudinaryPublicId: cloudinaryResult.publicId,
        cloudinaryUrl: cloudinaryResult.secureUrl,
        filename: file.name,
        category,
        vineyardName,
        season,
        classification: "informative",
        widthPx: cloudinaryResult.width,
        heightPx: cloudinaryResult.height,
        uploadedToCdn: true,
      },
    });

    // 3. Auto-run AI Vision describe — non-blocking failure
    console.log("[photo-upload] Running AI Vision describe...");
    const aiResult = await aiDescribe(cloudinaryResult.secureUrl);

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
