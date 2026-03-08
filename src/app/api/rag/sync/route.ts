import { NextRequest, NextResponse } from "next/server";
import { runIncrementalSync } from "@/lib/rag";

export const maxDuration = 60; // seconds — sync may embed multiple files

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  try {
    const result = await runIncrementalSync();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: { code: "RAG_SYNC_FAILED", message } },
      { status: 500 }
    );
  }
}
