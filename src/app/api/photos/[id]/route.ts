import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const UpdatePhotoSchema = z.object({
  description: z.string().optional(),
  altText: z.string().optional(),
  category: z.string().optional(),
  classification: z.enum(["informative", "decorative"]).optional(),
  vineyardName: z.string().nullable().optional(),
  season: z.string().nullable().optional(),
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

// GET /api/photos/[id] — Get a single photo with article assignments
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor", "viewer");
    const { id } = await params;

    const photo = await prisma.photo.findUnique({
      where: { id: parseInt(id, 10) },
      select: {
        ...photoSelect,
        articlePhotos: {
          select: {
            position: true,
            article: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!photo) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Photo not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: photo });
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

// PATCH /api/photos/[id] — Update photo metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor");
    const { id } = await params;

    const body = await request.json();
    const parsed = UpdatePhotoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const existing = await prisma.photo.findUnique({
      where: { id: parseInt(id, 10) },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Photo not found" } },
        { status: 404 }
      );
    }

    const photo = await prisma.photo.update({
      where: { id: parseInt(id, 10) },
      data: parsed.data,
      select: photoSelect,
    });

    return NextResponse.json({ success: true, data: photo });
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
