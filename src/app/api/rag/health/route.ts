import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRagProvider } from "@/lib/rag";
import type { RagHealthResponse } from "@/types/rag";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  try {
    const provider = getRagProvider();

    const [documentCount, chunkCount, syncState] = await Promise.all([
      prisma.ragDocument.count(),
      prisma.ragChunk.count(),
      prisma.ragSyncState.findUnique({ where: { id: 1 } }),
    ]);

    const health = await provider.health();

    const data: RagHealthResponse = {
      provider: provider.type,
      healthy: health.healthy,
      documentCount,
      chunkCount,
      lastSyncAt: syncState?.lastSyncAt?.toISOString() ?? null,
      lastSyncPageToken: syncState?.startPageToken ?? null,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
