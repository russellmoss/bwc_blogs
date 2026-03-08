import { NextRequest, NextResponse } from "next/server";
import { OnyxProvider } from "@/lib/rag";
import { CustomProvider } from "@/lib/rag";
import type { RagCompareResult } from "@/types/rag";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const queries: string[] = body.queries ?? [];

    if (queries.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "queries array required" } },
        { status: 400 }
      );
    }

    const onyx = new OnyxProvider();
    const custom = new CustomProvider();

    const results: RagCompareResult[] = [];

    for (const query of queries) {
      const [onyxResult, customResult] = await Promise.allSettled([
        onyx.search(query),
        custom.search(query),
      ]);

      const onyxCtx = onyxResult.status === "fulfilled" ? onyxResult.value : null;
      const customCtx = customResult.status === "fulfilled" ? customResult.value : null;

      results.push({
        query,
        onyx: onyxCtx ? {
          resultCount: onyxCtx.totalResults,
          topScore: onyxCtx.results[0]?.score ?? 0,
          searchTimeMs: onyxCtx.searchTimeMs,
          topSources: onyxCtx.results.slice(0, 3).map((r) => r.sourceDocument),
        } : null,
        custom: customCtx ? {
          resultCount: customCtx.totalResults,
          topScore: customCtx.results[0]?.score ?? 0,
          searchTimeMs: customCtx.searchTimeMs,
          topSources: customCtx.results.slice(0, 3).map((r) => r.sourceDocument),
        } : null,
      });
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
