import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { generateBackfillReport, activateLinks } from "@/lib/finalization";
import { z } from "zod";

const PublishSchema = z.object({
  publishedUrl: z.string().url(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor");
    const { id } = await params;
    const articleId = parseInt(id, 10);

    const body = await request.json();
    const parsed = PublishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "publishedUrl is required and must be a valid URL" } },
        { status: 400 }
      );
    }

    // Verify article exists and is finalized
    const article = await prisma.contentMap.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Article not found" } },
        { status: 404 }
      );
    }

    if (article.status !== "finalized" && article.status !== "published") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Article must be finalized before publishing" } },
        { status: 400 }
      );
    }

    // Update content_map
    const publishedDate = new Date();
    await prisma.contentMap.update({
      where: { id: articleId },
      data: {
        status: "published",
        publishedDate,
        publishedUrl: parsed.data.publishedUrl,
      },
    });

    // Activate internal links
    const activatedLinks = await activateLinks(articleId);

    // Generate backfill report
    const backfillReport = await generateBackfillReport(articleId);

    return NextResponse.json({
      success: true,
      data: {
        status: "published",
        publishedDate: publishedDate.toISOString(),
        activatedLinks,
        backfillReport,
      },
    });
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
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
