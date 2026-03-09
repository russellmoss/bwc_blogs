import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { AggregatedQueryRow } from "@/types/intelligence";

const QueryParamsSchema = z.object({
  page: z.string().optional(),
  contentMapId: z.coerce.number().int().optional(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(20),
  groupBy: z.enum(["query", "query_page"]).optional().default("query_page"),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = QueryParamsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid parameters", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { page, contentMapId, start, end, limit, groupBy } = parsed.data;

    const where: Record<string, unknown> = {};
    if (page) where.page = page;
    if (contentMapId) where.contentMapId = contentMapId;
    if (start || end) {
      where.date = {
        ...(start ? { gte: new Date(start) } : {}),
        ...(end ? { lte: new Date(end) } : {}),
      };
    }

    if (groupBy === "query") {
      // Site-wide: aggregate by query only (across all pages)
      const grouped = await prisma.articleQueryPerformance.groupBy({
        by: ["query"],
        where,
        _sum: { clicks: true, impressions: true },
        _avg: { ctr: true, position: true },
        _count: { page: true },
        orderBy: { _sum: { impressions: "desc" } },
        take: limit,
      });

      const data: AggregatedQueryRow[] = grouped.map((row) => ({
        query: row.query,
        page: `${row._count.page} page${row._count.page === 1 ? "" : "s"}`,
        totalClicks: row._sum.clicks ?? 0,
        totalImpressions: row._sum.impressions ?? 0,
        avgCtr: row._avg.ctr ?? 0,
        avgPosition: row._avg.position ?? 0,
      }));

      return NextResponse.json({ success: true, data });
    }

    const grouped = await prisma.articleQueryPerformance.groupBy({
      by: ["query", "page"],
      where,
      _sum: { clicks: true, impressions: true },
      _avg: { ctr: true, position: true },
      orderBy: { _sum: { impressions: "desc" } },
      take: limit,
    });

    const data: AggregatedQueryRow[] = grouped.map((row) => ({
      query: row.query,
      page: row.page,
      totalClicks: row._sum.clicks ?? 0,
      totalImpressions: row._sum.impressions ?? 0,
      avgCtr: row._avg.ctr ?? 0,
      avgPosition: row._avg.position ?? 0,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "QUERY_PERFORMANCE_ERROR", message } },
      { status: 500 }
    );
  }
}
