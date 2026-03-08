import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRagProvider } from "@/lib/rag";
import { getCurrentUser } from "@/lib/auth/session";
import type { RagHealthResponse } from "@/types/rag";

export async function GET(request: NextRequest) {
  // Accept either CRON_SECRET or session auth
  const authHeader = request.headers.get("authorization");
  const hasCronAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const user = !hasCronAuth ? await getCurrentUser() : null;
  if (!hasCronAuth && !user) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
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
