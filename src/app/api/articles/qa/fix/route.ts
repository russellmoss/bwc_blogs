import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { getClaudeClient, getModelId } from "@/lib/claude/client";
import { CanonicalArticleDocumentSchema } from "@/lib/article-schema/schema";
import { runQAChecks } from "@/lib/qa";
import { getFixEntry, getFixTier } from "@/lib/qa/fix-registry";
import { CheerioDomAdapter } from "@/lib/qa/cheerio-adapter";
import { buildPatchPrompt } from "@/lib/qa/patch-prompt";
import { mergePartialDocument, parsePartialJson } from "@/lib/qa/merge-partial";
import { renderArticle } from "@/lib/renderer";
import { TEMPLATE_VERSION } from "@/lib/renderer/compiled-template";
import { setByPath } from "@/lib/undo-redo/undo-manager";
import type { CanonicalArticleDocument } from "@/types/article";
import type { ApiResponse } from "@/types/api";
import type { QAScore } from "@/types/qa";

/** Coerce string photoIds/dimensions to numbers in all ImagePlacement nodes */
function coerceImageFields(doc: Record<string, unknown>): void {
  const coerce = (p: Record<string, unknown>) => {
    if (typeof p.photoId === "string") {
      const n = parseInt(p.photoId as string, 10);
      p.photoId = isNaN(n) ? null : n;
    }
    if (typeof p.width === "string") {
      const n = parseInt(p.width as string, 10);
      p.width = isNaN(n) ? null : n;
    }
    if (typeof p.height === "string") {
      const n = parseInt(p.height as string, 10);
      p.height = isNaN(n) ? null : n;
    }
  };
  if (doc.heroImage && typeof doc.heroImage === "object") {
    coerce(doc.heroImage as Record<string, unknown>);
  }
  if (Array.isArray(doc.sections)) {
    for (const section of doc.sections as Record<string, unknown>[]) {
      if (Array.isArray(section.content)) {
        for (const node of section.content as Record<string, unknown>[]) {
          if (node.type === "image" && typeof node.placement === "object" && node.placement !== null) {
            coerce(node.placement as Record<string, unknown>);
          }
        }
      }
    }
  }
}

const FixRequestSchema = z.object({
  document: z.record(z.string(), z.unknown()),
  html: z.string().min(1),
  checkIds: z.array(z.string()).min(1).max(20),
  isImported: z.boolean().optional().default(false),
});

interface FixResponseData {
  document: CanonicalArticleDocument;
  html: string;
  qaScore: QAScore;
  appliedFixes: {
    tier1: string[];
    tier2: string[];
  };
  tier1Summary: string;
  claudeTokensUsed: number | null;
}

export async function POST(request: Request) {
  try {
    // 1. Auth check — this endpoint costs money
    await requireRole("admin", "editor");

    // 2. Parse and validate request
    const body = await request.json();
    const parsed = FixRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parsed.error.flatten(),
          },
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // 3. Coerce string photoIds/dimensions to numbers before Zod validation
    coerceImageFields(parsed.data.document as Record<string, unknown>);

    // 4. Validate the document
    const docParsed = CanonicalArticleDocumentSchema.safeParse(parsed.data.document);
    if (!docParsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid document structure",
            details: docParsed.error.issues,
          },
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    let doc = docParsed.data as CanonicalArticleDocument;
    const { checkIds, isImported } = parsed.data;

    // 4. Split into tiers
    const tier1Ids = checkIds.filter((id) => getFixTier(id) === 1);
    const tier2Ids = checkIds.filter((id) => getFixTier(id) === 2);

    // 5. Apply Tier 1 fixes (deterministic)
    const tier1Applied: string[] = [];
    const tier1Summaries: string[] = [];

    for (const checkId of tier1Ids) {
      const entry = getFixEntry(checkId);
      if (!entry?.fix) continue;
      const result = entry.fix(doc);
      if (!result) continue;

      for (const mutation of result.mutations) {
        doc = setByPath(doc, mutation.cadPath, mutation.value);
      }
      tier1Applied.push(checkId);
      tier1Summaries.push(result.summary);
    }

    // 6. Apply Tier 2 fixes (Claude API)
    let claudeTokensUsed: number | null = null;

    if (tier2Ids.length > 0) {
      // Run a quick QA to get current result messages for context
      const preDom = new CheerioDomAdapter(parsed.data.html);
      const preQaScore = runQAChecks(doc, parsed.data.html, preDom, { isImported });

      // Build prompt
      const { system, user } = buildPatchPrompt(doc, tier2Ids, preQaScore);

      // Call Claude — use 16384 tokens to handle full sections array rewrites
      const client = getClaudeClient();
      const response = await client.messages.create({
        model: getModelId(),
        max_tokens: 16384,
        system,
        messages: [{ role: "user", content: user }],
      });

      claudeTokensUsed = response.usage?.output_tokens ?? null;
      const stopReason = response.stop_reason;

      // Extract text from response
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => ("text" in b ? (b as { text: string }).text : ""))
        .join("");

      console.log("[qa-fix] Claude response length:", text.length,
        "tokens used:", claudeTokensUsed, "stop:", stopReason);

      // Detect truncation — if Claude hit max_tokens, the JSON is likely incomplete
      if (stopReason === "max_tokens") {
        console.error("[qa-fix] Response TRUNCATED at max_tokens — JSON will be incomplete");
      }

      // Parse partial JSON
      const partial = parsePartialJson(text);
      if (!partial) {
        console.error("[qa-fix] Failed to parse Claude response as JSON. First 500 chars:", text.slice(0, 500));
      } else {
        console.log("[qa-fix] Parsed patch keys:", Object.keys(partial));
        const mergeResult = mergePartialDocument(doc, partial);
        if (mergeResult.merged) {
          console.log("[qa-fix] Merge succeeded");
          doc = mergeResult.document;
        } else {
          console.error("[qa-fix] Merge FAILED:", mergeResult.error);
        }
      }
    }

    // 6b. Coerce any string photoIds introduced by Claude's patch
    coerceImageFields(doc as unknown as Record<string, unknown>);

    // 7. Re-render HTML (for imports, keep the original HTML — don't re-render from synthetic doc)
    let finalHtml: string;
    if (isImported) {
      finalHtml = parsed.data.html;
    } else {
      const rendered = renderArticle({
        document: doc,
        htmlOverrides: null,
        templateVersion: TEMPLATE_VERSION,
      });
      finalHtml = rendered.html;
    }

    // 8. Re-run QA
    const dom = new CheerioDomAdapter(finalHtml);
    const qaScore = runQAChecks(doc, finalHtml, dom, { isImported });

    const failedChecks = qaScore.results.filter((r) => !r.passed).map((r) => `${r.check.id}: ${r.message}`);
    console.log("[qa-fix] Post-fix QA:", qaScore.total, "/", qaScore.possible,
      "fails:", qaScore.failCount, "warns:", qaScore.warnCount);
    if (failedChecks.length > 0) {
      console.log("[qa-fix] Remaining failures:", failedChecks);
    }

    // 9. Return result
    return NextResponse.json({
      success: true,
      data: {
        document: doc,
        html: finalHtml,
        qaScore,
        appliedFixes: {
          tier1: tier1Applied,
          tier2: tier2Ids,
        },
        tier1Summary: tier1Summaries.join("; ") || "None",
        claudeTokensUsed,
      },
    } as ApiResponse<FixResponseData>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_REQUIRED", message: "Authentication required" },
        } as ApiResponse<never>,
        { status: 401 }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_FORBIDDEN", message: "Admin or editor role required" },
        } as ApiResponse<never>,
        { status: 403 }
      );
    }
    // Handle Prisma/Neon connection errors
    if (
      message.includes("Connection") ||
      message.includes("connection") ||
      error instanceof Error && "code" in error && ["P2024", "P1017", "P1001", "P1002"].includes((error as any).code)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Database connection lost. Please retry." },
        } as ApiResponse<never>,
        { status: 503 }
      );
    }
    if (message === "GENERATION_FAILED") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "GENERATION_FAILED", message: "Claude API key not configured" },
        } as ApiResponse<never>,
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: message,
        },
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}
