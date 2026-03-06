import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const AnalyzeBodySchema = z.object({
  days: z.number().int().min(1).max(90).optional().default(30),
});

const RecommendationSchema = z.object({
  contentMapId: z.number().nullable(),
  recommendationType: z.enum(["update", "new_spoke", "gap", "meta_rewrite", "title_update"]),
  title: z.string(),
  rationale: z.string(),
  suggestedPrompt: z.string(),
  priority: z.enum(["high", "medium", "low"]),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = AnalyzeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { days } = parsed.data;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Fetch performance data
    const performanceRows = await prisma.articlePerformance.findMany({
      where: { date: { gte: since } },
      include: {
        contentMap: {
          select: {
            id: true, title: true, slug: true, publishedUrl: true,
            hubName: true, articleType: true, status: true, targetKeywords: true,
          },
        },
      },
      orderBy: { impressions: "desc" },
      take: 20,
    });

    // Fetch all published content map entries
    const publishedArticles = await prisma.contentMap.findMany({
      where: { status: "published" },
      select: {
        id: true, title: true, slug: true, hubName: true,
        articleType: true, targetKeywords: true, publishedUrl: true,
      },
    });

    const systemPrompt = `You are an SEO content strategist for Bhutan Wine Company (bhutanwine.com), a pioneer wine producer in Bhutan. Analyze the provided performance data and content map to generate specific, actionable content recommendations.

Return ONLY a valid JSON array of recommendation objects. No preamble, no markdown fences.

Each object must have exactly these fields:
{
  "contentMapId": number | null,
  "recommendationType": "update" | "new_spoke" | "gap" | "meta_rewrite" | "title_update",
  "title": string (concise recommendation title),
  "rationale": string (1-2 sentences explaining why),
  "suggestedPrompt": string (the exact prompt to paste into the Composer chat),
  "priority": "high" | "medium" | "low"
}

Generate 5-10 recommendations. Prioritize:
1. Articles with position 4-10 and high impressions (meta/title optimization)
2. Target keywords with zero clicks (content gaps)
3. Spokes missing from high-performing hubs
4. Published articles needing content refresh (position declining)`;

    const userMessage = `<PERFORMANCE_DATA>
${JSON.stringify(performanceRows, null, 2)}
</PERFORMANCE_DATA>

<CONTENT_MAP>
${JSON.stringify(publishedArticles, null, 2)}
</CONTENT_MAP>`;

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    let rawText = textBlock?.type === "text" ? textBlock.text : "[]";

    // Strip markdown fences if present
    rawText = rawText.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "");

    // Extract JSON array
    const startIdx = rawText.indexOf("[");
    const endIdx = rawText.lastIndexOf("]");
    if (startIdx === -1 || endIdx === -1) {
      return NextResponse.json(
        { success: false, error: { code: "INTELLIGENCE_ERROR", message: "Claude did not return a valid JSON array" } },
        { status: 500 }
      );
    }
    rawText = rawText.slice(startIdx, endIdx + 1);

    let rawRecs: unknown[];
    try {
      rawRecs = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INTELLIGENCE_ERROR", message: "Failed to parse Claude response as JSON" } },
        { status: 500 }
      );
    }

    // Validate each recommendation
    const validRecs = rawRecs
      .map((r) => RecommendationSchema.safeParse(r))
      .filter((r) => r.success)
      .map((r) => r.data!);

    // Clear existing pending recommendations and insert new ones
    await prisma.contentRecommendation.deleteMany({ where: { status: "pending" } });

    const created = await Promise.all(
      validRecs.map((rec) =>
        prisma.contentRecommendation.create({
          data: {
            contentMapId: rec.contentMapId,
            recommendationType: rec.recommendationType,
            title: rec.title,
            rationale: rec.rationale,
            suggestedPrompt: rec.suggestedPrompt,
            priority: rec.priority,
            status: "pending",
          },
          include: {
            contentMap: {
              select: {
                id: true, title: true, slug: true,
                hubName: true, articleType: true, status: true,
              },
            },
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      data: { recommendations: created, generatedAt: new Date().toISOString() },
    });
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
      { success: false, error: { code: "INTELLIGENCE_ERROR", message } },
      { status: 500 }
    );
  }
}
