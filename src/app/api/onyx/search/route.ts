import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { searchOnyx } from "@/lib/onyx";
import { z } from "zod";

const SearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  filters: z
    .object({
      sourceType: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = SearchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { query, filters } = parsed.data;

    const result = await searchOnyx(query, filters ? { sourceType: filters.sourceType } : undefined);

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
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }
    if (message === "ONYX_UNAVAILABLE") {
      return NextResponse.json(
        { success: false, error: { code: "ONYX_UNAVAILABLE", message: "Knowledge base unavailable" } },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
