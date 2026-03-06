import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export interface TimeseriesPoint {
  date: string;
  clicks: number;
  impressions: number;
}

function classifyPageType(page: string): "blog" | "product" | "static" {
  const path = page.replace(/https?:\/\/[^/]+/, "");
  if (path.startsWith("/blog/") || path.startsWith("/post/")) return "blog";
  if (path.startsWith("/product-page/") || path.startsWith("/category/")) return "product";
  return "static";
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "editor", "viewer");

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const typesParam = searchParams.get("types"); // e.g. "blog,static"

    if (!startParam || !endParam) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "start and end params required" } },
        { status: 400 }
      );
    }

    const since = new Date(startParam);
    const until = new Date(endParam);
    until.setDate(until.getDate() + 1);

    const allowedTypes = typesParam
      ? new Set(typesParam.split(",").filter(Boolean))
      : null; // null = all types

    const rows = await prisma.articlePerformance.findMany({
      where: { date: { gte: since, lte: until } },
      select: { date: true, page: true, clicks: true, impressions: true },
      orderBy: { date: "asc" },
    });

    // Aggregate per date, filtering by page type if specified
    const dateMap = new Map<string, { clicks: number; impressions: number }>();
    for (const row of rows) {
      if (allowedTypes && !allowedTypes.has(classifyPageType(row.page))) continue;
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
