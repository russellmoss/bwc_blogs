import { NextRequest, NextResponse } from "next/server";
import { runIncrementalSync } from "@/lib/rag";
import { getCurrentUser } from "@/lib/auth/session";

export const maxDuration = 60; // seconds — sync may embed multiple files

export async function POST(request: NextRequest) {
  // Accept either CRON_SECRET (for GitHub Actions) or session auth (for UI)
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
