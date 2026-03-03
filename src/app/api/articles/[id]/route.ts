import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor", "viewer");
    const { id } = await params;
    const articleId = parseInt(id, 10);

    // Get content map entry
    const article = await prisma.contentMap.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Article not found" } },
        { status: 404 }
      );
    }

    // Get latest finalized document (if any)
    const latestDoc = await prisma.articleDocument.findFirst({
      where: { articleId },
      orderBy: { version: "desc" },
    });

    // Get matching HTML record (stores the actual rendered/imported HTML)
    let storedHtml: string | null = null;
    if (latestDoc) {
      const htmlRecord = await prisma.articleHtml.findFirst({
        where: { articleId, documentVersion: latestDoc.version },
        select: { htmlContent: true },
      });
      storedHtml = htmlRecord?.htmlContent ?? null;
    }

    // Get version count
    const versionCount = await prisma.articleDocument.count({
      where: { articleId },
    });

    return NextResponse.json({
      success: true,
      data: {
        article,
        latestDocument: latestDoc
          ? {
              version: latestDoc.version,
              canonicalDoc: latestDoc.canonicalDoc,
              htmlOverrides: latestDoc.htmlOverrides,
              htmlContent: storedHtml,
              finalizedAt: latestDoc.finalizedAt.toISOString(),
              finalizedBy: latestDoc.finalizedBy,
              notes: latestDoc.notes,
            }
          : null,
        versionCount,
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
