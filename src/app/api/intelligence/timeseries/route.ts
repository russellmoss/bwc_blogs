import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export interface TimeseriesPoint {
  date: string;
  clicks: number;
  impressions: number;
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "editor", "viewer");

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (!startParam || !endParam) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "start and end params required" } },
        { status: 400 }
      );
    }

    const since = new Date(startParam);
    const until = new Date(endParam);
    until.setDate(until.getDate() + 1);

    const rows = await prisma.articlePerformance.findMany({
      where: { date: { gte: since, lte: until } },
      select: { date: true, clicks: true, impressions: true },
      orderBy: { date: "asc" },
    });

    // Aggregate per date (sum across all pages for each day)
    const dateMap = new Map<string, { clicks: number; impressions: number }>();
    for (const row of rows) {
      const key = row.date.toISOString().split("T")[0];
      const existing = dateMap.get(key);
      if (existing) {
        existing.clicks += row.clicks;
        existing.impressions += row.impressions;
      } else {
        dateMap.set(key, { clicks: row.clicks, impressions: row.impressions });
      }
    }

    const timeseries: TimeseriesPoint[] = Array.from(dateMap.entries())
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ success: true, data: timeseries });
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
