import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const UpdateContentMapSchema = z.object({
  hubName: z.string().min(1).optional(),
  articleType: z.enum(["hub", "spoke", "news"]).optional(),
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  mainEntity: z.string().min(1).optional(),
  supportingEntities: z.array(z.string()).optional(),
  targetKeywords: z.array(z.string()).optional(),
  searchVolumeEst: z.number().int().nullable().optional(),
  keywordDifficulty: z.string().nullable().optional(),
  targetAudience: z.string().nullable().optional(),
  status: z
    .enum(["planned", "drafting", "finalized", "published", "needs_update"])
    .optional(),
  scheduledDate: z.string().datetime().nullable().optional(),
  publishedDate: z.string().datetime().nullable().optional(),
  publishedUrl: z.string().url().nullable().optional(),
  parentHubId: z.number().int().nullable().optional(),
  contentNotes: z.string().nullable().optional(),
  suggestedExternalLinks: z.array(z.string()).optional(),
  internalLinksTo: z.array(z.string()).optional(),
  wordCount: z.number().int().nullable().optional(),
  qaScore: z.string().nullable().optional(),
  authorName: z.string().nullable().optional(),
  source: z.enum(["engine", "external"]).optional(),
});

const contentMapSelect = {
  id: true,
  hubName: true,
  articleType: true,
  title: true,
  slug: true,
  mainEntity: true,
  supportingEntities: true,
  targetKeywords: true,
  searchVolumeEst: true,
  keywordDifficulty: true,
  targetAudience: true,
  status: true,
  scheduledDate: true,
  publishedDate: true,
  publishedUrl: true,
  parentHubId: true,
  contentNotes: true,
  suggestedExternalLinks: true,
  internalLinksTo: true,
  wordCount: true,
  qaScore: true,
  authorName: true,
  source: true,
  createdAt: true,
  updatedAt: true,
};

// GET /api/content-map/[id] — Get a single content map entry
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor", "viewer");
    const { id } = await params;

    const entry = await prisma.contentMap.findUnique({
      where: { id: parseInt(id, 10) },
      select: contentMapSelect,
    });

    if (!entry) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Content map entry not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: entry });
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

// PATCH /api/content-map/[id] — Update a content map entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor");
    const { id } = await params;

    const body = await request.json();
    const parsed = UpdateContentMapSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    // Check slug uniqueness if slug is being updated
    if (parsed.data.slug) {
      const existing = await prisma.contentMap.findUnique({
        where: { slug: parsed.data.slug },
        select: { id: true },
      });
      if (existing && existing.id !== parseInt(id, 10)) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "Slug already in use" } },
          { status: 409 }
        );
      }
    }

    const entry = await prisma.contentMap.update({
      where: { id: parseInt(id, 10) },
      data: parsed.data,
      select: contentMapSelect,
    });

    return NextResponse.json({ success: true, data: entry });
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

// DELETE /api/content-map/[id] — Delete a content map entry
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin");
    const { id } = await params;

    const entry = await prisma.contentMap.findUnique({
      where: { id: parseInt(id, 10) },
      select: { id: true },
    });

    if (!entry) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Content map entry not found" } },
        { status: 404 }
      );
    }

    await prisma.contentMap.delete({
      where: { id: parseInt(id, 10) },
    });

    return NextResponse.json({ success: true, data: { id: entry.id, deleted: true } });
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
