import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { KeywordRankEntry } from "@/types/intelligence";

const ParamsSchema = z.object({
  contentMapId: z.coerce.number().int(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = ParamsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "contentMapId is required" } },
        { status: 400 }
      );
    }

    const { contentMapId } = parsed.data;

    // Get target keywords from content map
    const contentMap = await prisma.contentMap.findUnique({
      where: { id: contentMapId },
      select: { targetKeywords: true },
    });

    if (!contentMap) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Content map entry not found" } },
        { status: 404 }
      );
    }

    const targetKeywords = new Set(contentMap.targetKeywords.map((k) => k.toLowerCase()));

    // Date boundaries: last 28d and prior 28d
    const now = new Date();
    now.setDate(now.getDate() - 3); // GSC 3-day lag
    const last28Start = new Date(now);
    last28Start.setDate(last28Start.getDate() - 28);
    const prior28Start = new Date(last28Start);
    prior28Start.setDate(prior28Start.getDate() - 28);

    // Fetch all query data for this content map entry
    const allQueryData = await prisma.articleQueryPerformance.findMany({
      where: {
        contentMapId,
        date: { gte: prior28Start },
      },
      select: { query: true, clicks: true, impressions: true, position: true, date: true },
    });

    // Aggregate by query into two periods
    const queryStats = new Map<string, {
      last28: { impressions: number; clicks: number; positions: number[]; };
      prior28: { impressions: number; clicks: number; positions: number[]; };
    }>();

    for (const row of allQueryData) {
      const q = row.query.toLowerCase();
      if (!queryStats.has(q)) {
        queryStats.set(q, {
          last28: { impressions: 0, clicks: 0, positions: [] },
          prior28: { impressions: 0, clicks: 0, positions: [] },
        });
      }
      const stats = queryStats.get(q)!;
      const rowDate = new Date(row.date);
      const period = rowDate >= last28Start ? "last28" : "prior28";
      stats[period].impressions += row.impressions;
      stats[period].clicks += row.clicks;
      stats[period].positions.push(row.position);
    }

    // Build keyword rank entries
    const entries: KeywordRankEntry[] = [];

    // Process target keywords first
    for (const keyword of targetKeywords) {
      const stats = queryStats.get(keyword);
      if (!stats) {
        entries.push({ keyword, isTarget: true, impressions: 0, clicks: 0, avgPosition: 0, trend: "no_data" });
        continue;
      }
      const avgPos = stats.last28.positions.length > 0
        ? stats.last28.positions.reduce((a, b) => a + b, 0) / stats.last28.positions.length
        : 0;
      const priorAvgPos = stats.prior28.positions.length > 0
        ? stats.prior28.positions.reduce((a, b) => a + b, 0) / stats.prior28.positions.length
        : 0;

      let trend: KeywordRankEntry["trend"] = "no_data";
      if (stats.last28.positions.length > 0 && stats.prior28.positions.length > 0) {
        const diff = priorAvgPos - avgPos; // positive = improving (lower position is better)
        trend = diff > 2 ? "improving" : diff < -2 ? "declining" : "stable";
      } else if (stats.last28.positions.length > 0) {
        trend = "stable";
      }

      entries.push({
        keyword,
        isTarget: true,
        impressions: stats.last28.impressions,
        clicks: stats.last28.clicks,
        avgPosition: Math.round(avgPos * 10) / 10,
        trend,
      });
    }

    // Add top 5 non-target queries by impressions
    const nonTargetEntries = [...queryStats.entries()]
      .filter(([q]) => !targetKeywords.has(q))
      .sort((a, b) => b[1].last28.impressions - a[1].last28.impressions)
      .slice(0, 5);

    for (const [query, stats] of nonTargetEntries) {
      const avgPos = stats.last28.positions.length > 0
        ? stats.last28.positions.reduce((a, b) => a + b, 0) / stats.last28.positions.length
        : 0;
      const priorAvgPos = stats.prior28.positions.length > 0
        ? stats.prior28.positions.reduce((a, b) => a + b, 0) / stats.prior28.positions.length
        : 0;

      let trend: KeywordRankEntry["trend"] = "no_data";
      if (stats.last28.positions.length > 0 && stats.prior28.positions.length > 0) {
        const diff = priorAvgPos - avgPos;
        trend = diff > 2 ? "improving" : diff < -2 ? "declining" : "stable";
      } else if (stats.last28.positions.length > 0) {
        trend = "stable";
      }

      entries.push({
        keyword: query,
        isTarget: false,
        impressions: stats.last28.impressions,
        clicks: stats.last28.clicks,
        avgPosition: Math.round(avgPos * 10) / 10,
        trend,
      });
    }

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "KEYWORD_RANKS_ERROR", message } },
      { status: 500 }
    );
  }
}
