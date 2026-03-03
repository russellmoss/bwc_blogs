import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor", "viewer");
    const { id } = await params;
    const articleId = parseInt(id, 10);

    const url = new URL(request.url);
    const versionParam = url.searchParams.get("version");

    let htmlRow;
    if (versionParam) {
      htmlRow = await prisma.articleHtml.findUnique({
        where: {
          articleId_version: {
            articleId,
            version: parseInt(versionParam, 10),
          },
        },
      });
    } else {
      // Get latest version
      htmlRow = await prisma.articleHtml.findFirst({
        where: { articleId },
        orderBy: { version: "desc" },
      });
    }

    if (!htmlRow) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "No finalized HTML found for this article" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        articleId: htmlRow.articleId,
        version: htmlRow.version,
        documentVersion: htmlRow.documentVersion,
        htmlContent: htmlRow.htmlContent,
        metaTitle: htmlRow.metaTitle,
        metaDescription: htmlRow.metaDescription,
        schemaJson: htmlRow.schemaJson,
        qaScore: htmlRow.qaScore,
        qaFailures: htmlRow.qaFailures,
        finalizedAt: htmlRow.finalizedAt.toISOString(),
        finalizedBy: htmlRow.finalizedBy,
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
