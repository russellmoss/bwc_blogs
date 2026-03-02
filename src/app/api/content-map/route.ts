import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const CreateContentMapSchema = z.object({
  hubName: z.string().min(1),
  articleType: z.enum(["hub", "spoke", "news"]),
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  mainEntity: z.string().min(1),
  supportingEntities: z.array(z.string()).default([]),
  targetKeywords: z.array(z.string()).default([]),
  searchVolumeEst: z.number().int().optional(),
  keywordDifficulty: z.string().optional(),
  targetAudience: z.string().optional(),
  status: z
    .enum(["planned", "drafting", "finalized", "published", "needs_update"])
    .default("planned"),
  parentHubId: z.number().int().optional(),
  contentNotes: z.string().optional(),
  suggestedExternalLinks: z.array(z.string()).default([]),
  internalLinksTo: z.array(z.string()).default([]),
  source: z.enum(["engine", "external"]).default("engine"),
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

// GET /api/content-map — List all content map entries
export async function GET() {
  try {
    await requireRole("admin", "editor", "viewer");

    const entries = await prisma.contentMap.findMany({
      select: contentMapSelect,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: entries });
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

// POST /api/content-map — Create a new content map entry
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = CreateContentMapSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Generate slug from title if not provided
    if (!data.slug) {
      const { generateSlug, ensureUniqueSlug } = await import(
        "@/lib/content-map/slug"
      );
      data.slug = await ensureUniqueSlug(generateSlug(data.title), prisma);
    } else {
      // Check slug uniqueness
      const existing = await prisma.contentMap.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "Slug already in use" } },
          { status: 409 }
        );
      }
    }

    const entry = await prisma.contentMap.create({
      data: {
        hubName: data.hubName,
        articleType: data.articleType,
        title: data.title,
        slug: data.slug,
        mainEntity: data.mainEntity,
        supportingEntities: data.supportingEntities,
        targetKeywords: data.targetKeywords,
        searchVolumeEst: data.searchVolumeEst,
        keywordDifficulty: data.keywordDifficulty,
        targetAudience: data.targetAudience,
        status: data.status,
        parentHubId: data.parentHubId,
        contentNotes: data.contentNotes,
        suggestedExternalLinks: data.suggestedExternalLinks,
        internalLinksTo: data.internalLinksTo,
        source: data.source,
      },
      select: contentMapSelect,
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
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
