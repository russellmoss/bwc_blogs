import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { validateCanonicalDocument } from "@/lib/article-schema";
import { repairCanonicalDocument } from "@/lib/article-schema";
import { z } from "zod";

const ValidateRequestSchema = z.object({
  document: z.record(z.string(), z.unknown()),
  repair: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = ValidateRequestSchema.safeParse(body);

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

    const { document, repair } = parsed.data;

    if (repair) {
      try {
        const repairResult = repairCanonicalDocument(document);
        const postValidation = validateCanonicalDocument(repairResult.repaired);
        return NextResponse.json({
          success: true,
          data: {
            ...postValidation,
            repaired: repairResult.repaired,
            changes: repairResult.changes,
            validBeforeRepair: repairResult.valid,
          },
        });
      } catch {
        return NextResponse.json({
          success: true,
          data: {
            valid: false,
            errors: [{ path: "", message: "Document too broken to repair" }],
            warnings: [],
          },
        });
      }
    }

    const result = validateCanonicalDocument(document);
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
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
