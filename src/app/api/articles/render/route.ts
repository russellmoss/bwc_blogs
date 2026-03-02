import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { renderArticle } from "@/lib/renderer";
import { z } from "zod";

const RenderRequestSchema = z.object({
  document: z.record(z.string(), z.unknown()),
  htmlOverrides: z
    .array(
      z.object({
        path: z.string(),
        html: z.string(),
        reason: z.string(),
      })
    )
    .nullable()
    .default(null),
  templateVersion: z.string().default("1.0"),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = RenderRequestSchema.safeParse(body);

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

    const result = renderArticle({
      document: parsed.data.document as never,
      htmlOverrides: parsed.data.htmlOverrides,
      templateVersion: parsed.data.templateVersion,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_REQUIRED", message: "Authentication required" },
        },
        { status: 401 }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_FORBIDDEN", message: "Admin access required" },
        },
        { status: 403 }
      );
    }
    if (message === "RENDER_ERROR") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RENDER_ERROR", message: "Article rendering failed" },
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
