import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getClaudeClient, getModelId } from "@/lib/claude/client";
import { z } from "zod";

const DescribeSchema = z.object({
  photoId: z.number().int().positive(),
});

// POST /api/photos/describe — AI Vision analysis for alt-text generation
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const parsed = DescribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "photoId required", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    // Fetch the photo record
    const photo = await prisma.photo.findUnique({ where: { id: parsed.data.photoId } });
    if (!photo) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Photo not found" } },
        { status: 404 }
      );
    }

    // Get the image URL — prefer Cloudinary (if uploaded), fall back to Drive thumbnail
    const imageUrl = photo.cloudinaryUrl
      || `https://drive.google.com/thumbnail?id=${photo.driveFileId}&sz=w800`;

    // Call Claude with vision
    const client = getClaudeClient();
    const response = await client.messages.create({
      model: getModelId(),
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
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
- Include location names only if identifiable from the image
- For atmospheric/decorative shots, note that in the description
- Return ONLY the JSON object`,
            },
          ],
        },
      ],
    });

    // Parse the JSON response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { success: false, error: { code: "GENERATION_FAILED", message: "No text response from Claude" } },
        { status: 500 }
      );
    }

    // Extract JSON from response (handle possible markdown fences)
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const result = JSON.parse(jsonText);

    return NextResponse.json({
      success: true,
      data: {
        altText: result.altText || "",
        description: result.description || "",
        suggestedCategory: result.suggestedCategory || "uncategorized",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI describe failed";
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
      { success: false, error: { code: "GENERATION_FAILED", message } },
      { status: 500 }
    );
  }
}
