import { NextRequest, NextResponse } from "next/server";
import { runGscQuerySync } from "@/lib/gsc/query-sync";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  try {
    const result = await runGscQuerySync();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: { code: "GSC_QUERY_SYNC_FAILED", message } },
      { status: 500 }
    );
  }
}
