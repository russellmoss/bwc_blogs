import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { runGscQuerySync } from "@/lib/gsc/query-sync";

export async function POST() {
  try {
    await requireRole("admin", "editor");

    const result = await runGscQuerySync();
    return NextResponse.json({ success: true, data: result });
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
      { success: false, error: { code: "GSC_QUERY_SYNC_FAILED", message } },
      { status: 500 }
    );
  }
}
