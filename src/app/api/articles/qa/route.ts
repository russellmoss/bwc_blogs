import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types/api";
import type { QAScore } from "@/types/qa";
import type { CanonicalArticleDocument } from "@/types/article";
import { CanonicalArticleDocumentSchema } from "@/lib/article-schema/schema";
import { runQAChecks } from "@/lib/qa";
import { CheerioDomAdapter } from "@/lib/qa/cheerio-adapter";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body
    if (!body.document || !body.html) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body must include 'document' and 'html' fields",
          },
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // Validate the document structure
    const parsed = CanonicalArticleDocumentSchema.safeParse(body.document);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid document structure",
            details: parsed.error.issues,
          },
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    const doc = parsed.data as CanonicalArticleDocument;
    const html = body.html as string;

    // Run QA checks with cheerio adapter
    const dom = new CheerioDomAdapter(html);
    const qaScore = runQAChecks(doc, html, dom);

    // Check if gate enforcement is requested
    const url = new URL(request.url);
    const gateMode = url.searchParams.get("gate") === "true";

    if (gateMode && !qaScore.canFinalize) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "QA_GATE_FAILED",
            message: `Article has ${qaScore.failCount} FAIL-level issue(s) that block finalization`,
            details: qaScore,
          },
        } as ApiResponse<never>,
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: qaScore,
    } as ApiResponse<QAScore>);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "QA check failed",
        },
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}
