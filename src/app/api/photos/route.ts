import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const CatalogPhotoSchema = z.object({
  driveFileId: z.string().min(1),
  driveUrl: z.string().url(),
  filename: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),
  altText: z.string().optional(),
  classification: z.enum(["informative", "decorative"]).default("informative"),
  vineyardName: z.string().optional(),
  season: z.string().optional(),
});

const photoSelect = {
  id: true,
  driveFileId: true,
  driveUrl: true,
  cloudinaryPublicId: true,
  cloudinaryUrl: true,
  filename: true,
  category: true,
  description: true,
  altText: true,
  classification: true,
  vineyardName: true,
  season: true,
  widthPx: true,
  heightPx: true,
  uploadedToCdn: true,
  createdAt: true,
};

// GET /api/photos — List all photos (with optional filters)
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "editor", "viewer");
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const uploaded = url.searchParams.get("uploaded");

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (uploaded === "true") where.uploadedToCdn = true;
    if (uploaded === "false") where.uploadedToCdn = false;

    const photos = await prisma.photo.findMany({
      where,
      select: photoSelect,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: photos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
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

// POST /api/photos — Catalog a new photo from Drive
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const parsed = CatalogPhotoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    // Check for duplicate Drive file ID
    const existing = await prisma.photo.findUnique({
      where: { driveFileId: parsed.data.driveFileId },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Photo with this Drive file ID already cataloged" } },
        { status: 409 }
      );
    }

    const photo = await prisma.photo.create({
      data: parsed.data,
      select: photoSelect,
    });

    return NextResponse.json({ success: true, data: photo }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
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
