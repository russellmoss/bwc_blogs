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

    const versions = await prisma.articleDocument.findMany({
      where: { articleId },
      orderBy: { version: "desc" },
      select: {
        version: true,
        finalizedAt: true,
        finalizedBy: true,
        notes: true,
      },
    });

    // Enrich with HTML metadata
    const htmlVersions = await prisma.articleHtml.findMany({
      where: { articleId },
      select: {
        version: true,
        qaScore: true,
        qaFailures: true,
      },
    });

    const htmlMap = new Map(htmlVersions.map((h) => [h.version, h]));

    const enriched = versions.map((v) => {
      const html = htmlMap.get(v.version);
      return {
        version: v.version,
        finalizedAt: v.finalizedAt.toISOString(),
        finalizedBy: v.finalizedBy,
        notes: v.notes,
        qaScore: html?.qaScore || null,
        qaFailures: html?.qaFailures ?? 0,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
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
