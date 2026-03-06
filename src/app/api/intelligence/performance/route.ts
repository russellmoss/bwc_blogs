import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "editor", "viewer");

    const { searchParams } = new URL(request.url);

    // Support both ?days=N and ?start=YYYY-MM-DD&end=YYYY-MM-DD
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const typesParam = searchParams.get("types"); // e.g. "blog,static"

    let since: Date;
    let until: Date | undefined;

    if (startParam && endParam) {
      since = new Date(startParam);
      until = new Date(endParam);
      until.setDate(until.getDate() + 1);
    } else {
      const days = parseInt(searchParams.get("days") ?? "90", 10);
      since = new Date();
      since.setDate(since.getDate() - days);
    }

    const dateFilter: { gte: Date; lte?: Date } = { gte: since };
    if (until) dateFilter.lte = until;

    // Fetch all day-level rows in range
    const rows = await prisma.articlePerformance.findMany({
      where: { date: dateFilter },
      include: {
        contentMap: {
          select: {
            id: true,
            title: true,
            slug: true,
            publishedUrl: true,
            hubName: true,
            articleType: true,
            status: true,
            targetKeywords: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Aggregate per page across the date range
    const pageMap = new Map<string, {
      id: number;
      contentMapId: number | null;
      page: string;
      clicks: number;
      impressions: number;
      positionSum: number;
      dayCount: number;
      date: string;
      syncedAt: string;
      contentMap: typeof rows[0]["contentMap"];
    }>();

    for (const row of rows) {
      const existing = pageMap.get(row.page);
      if (existing) {
        existing.clicks += row.clicks;
        existing.impressions += row.impressions;
        existing.positionSum += row.position;
        existing.dayCount += 1;
      } else {
        pageMap.set(row.page, {
          id: row.id,
          contentMapId: row.contentMapId,
          page: row.page,
          clicks: row.clicks,
          impressions: row.impressions,
          positionSum: row.position,
          dayCount: 1,
          date: row.date.toISOString(),
          syncedAt: row.syncedAt.toISOString(),
          contentMap: row.contentMap,
        });
      }
    }

    const aggregated = Array.from(pageMap.values()).map((p) => ({
      id: p.id,
      contentMapId: p.contentMapId,
      page: p.page,
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: p.impressions > 0 ? p.clicks / p.impressions : 0,
      position: p.dayCount > 0 ? p.positionSum / p.dayCount : 0,
      date: p.date,
      syncedAt: p.syncedAt,
      contentMap: p.contentMap,
    }));

    // Filter by page type if specified
    const allowedTypes = typesParam
      ? new Set(typesParam.split(",").filter(Boolean))
      : null;

    const filtered = allowedTypes
      ? aggregated.filter((row) => {
          const path = row.page.replace(/https?:\/\/[^/]+/, "");
          let type: string = "static";
          if (path.startsWith("/blog/") || path.startsWith("/post/")) type = "blog";
          else if (path.startsWith("/product-page/") || path.startsWith("/category/")) type = "product";
          return allowedTypes.has(type);
        })
      : aggregated;

    // Sort by impressions descending
    filtered.sort((a, b) => b.impressions - a.impressions);

    return NextResponse.json({ success: true, data: filtered });
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
