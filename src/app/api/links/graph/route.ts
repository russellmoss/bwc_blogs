import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

// GET /api/links/graph — Link graph data for dashboard
export async function GET() {
  try {
    await requireRole("admin", "editor", "viewer");

    const [articles, links] = await Promise.all([
      prisma.contentMap.findMany({
        select: {
          id: true,
          title: true,
          articleType: true,
          hubName: true,
          status: true,
          slug: true,
        },
        orderBy: { id: "asc" },
      }),
      prisma.internalLink.findMany({
        select: {
          id: true,
          sourceArticleId: true,
          targetArticleId: true,
          targetCorePage: true,
          linkType: true,
          isActive: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        nodes: articles,
        edges: links,
        summary: {
          totalArticles: articles.length,
          totalLinks: links.length,
          activeLinks: links.filter((l) => l.isActive).length,
        },
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
