import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { checkOnyxHealth } from "@/lib/onyx";

export async function GET() {
  try {
    await requireRole("admin", "editor", "viewer");

    const health = await checkOnyxHealth();

    return NextResponse.json({ success: true, data: health });
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
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
