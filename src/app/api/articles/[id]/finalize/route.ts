import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { promotePendingPhotos, commitFinalization } from "@/lib/finalization";
import { logActivity } from "@/lib/activity/log";
import type { CanonicalArticleDocument } from "@/types/article";
import type { HtmlOverride, RendererOutput } from "@/types/renderer";
import { z } from "zod";

const FinalizeSchema = z.object({
  document: z.record(z.string(), z.any()),
  html: z.string().min(1),
  htmlOverrides: z.array(z.object({
    path: z.string(),
    html: z.string(),
    reason: z.string(),
  })).nullable().default(null),
  notes: z.string().optional(),
  skipRender: z.boolean().optional().default(false),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("admin", "editor");
    const { id } = await params;
    const articleId = parseInt(id, 10);

    const body = await request.json();
    const parsed = FinalizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const document = parsed.data.document as unknown as CanonicalArticleDocument;
    const htmlOverrides = parsed.data.htmlOverrides as HtmlOverride[] | null;

    // Step 1: Promote photos to CDN (harmless no-op for imports)
    const { updatedDocument, photosUploaded } = await promotePendingPhotos(document);

    // Step 2: Build pre-rendered output for import mode (skip re-render)
    let preRenderedOutput: RendererOutput | undefined;
    if (parsed.data.skipRender) {
      // For imported HTML, use the submitted HTML directly
      const htmlContent = parsed.data.html;
      preRenderedOutput = {
        html: htmlContent,
        metaTitle: String(updatedDocument.metaTitle || ""),
        metaDescription: String(updatedDocument.metaDescription || ""),
        schemaJson: "",
        wordCount: htmlContent.split(/\s+/).filter(Boolean).length,
      };
    }

    // Step 3: Commit (includes final render + QA gate + atomic DB write)
    const result = await commitFinalization(
      articleId,
      updatedDocument,
      htmlOverrides,
      user.email,
      parsed.data.notes,
      preRenderedOutput
    );

    // Log finalization
    const articleMeta = await prisma.contentMap.findUnique({
      where: { id: articleId },
      select: { title: true, articleType: true },
    });
    logActivity({
      userId: parseInt(user.id, 10),
      userEmail: user.email,
      userName: user.name,
      action: "ARTICLE_FINALIZED",
      metadata: {
        articleId,
        articleTitle: articleMeta?.title ?? "",
        articleType: articleMeta?.articleType ?? "",
        version: result.documentVersion,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        documentVersion: result.documentVersion,
        htmlVersion: result.htmlVersion,
        qaScore: result.qaScore,
        cdnPhotosUploaded: photosUploaded,
        finalHtml: result.rendererOutput.html,
        metaTitle: result.rendererOutput.metaTitle,
        metaDescription: result.rendererOutput.metaDescription,
        wordCount: result.rendererOutput.wordCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.startsWith("QA_GATE_FAILED")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "QA_GATE_FAILED",
            message,
            details: (error as any).qaScore || null,
          },
        },
        { status: 422 }
      );
    }
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
    if (message.startsWith("CLOUDINARY_ERROR")) {
      return NextResponse.json(
        { success: false, error: { code: "CLOUDINARY_ERROR", message } },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "FINALIZATION_FAILED", message } },
      { status: 500 }
    );
  }
}
