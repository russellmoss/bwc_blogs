import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { generateArticle } from "@/lib/orchestration";
import type { StreamEvent, GenerateArticleRequest } from "@/types/claude";
import { z } from "zod";

const GenerateRequestSchema = z.object({
  articleId: z.number().int().positive(),
  userMessage: z.string().min(1).max(10000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      timestamp: z.string(),
    })
  ).default([]),
  currentDocument: z.record(z.string(), z.unknown()).nullable().default(null),
  photoManifest: z.object({
    photos: z.array(z.record(z.string(), z.unknown())),
    heroPhotoId: z.number().nullable(),
    totalAvailable: z.number(),
  }).nullable().default(null),
});

function encodeSSE(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = GenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const generateRequest: GenerateArticleRequest = {
      articleId: parsed.data.articleId,
      userMessage: parsed.data.userMessage,
      conversationHistory: parsed.data.conversationHistory,
      currentDocument: parsed.data.currentDocument as GenerateArticleRequest["currentDocument"],
      photoManifest: parsed.data.photoManifest as GenerateArticleRequest["photoManifest"],
    };

    // Create a ReadableStream that emits SSE events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          await generateArticle(generateRequest, (event: StreamEvent) => {
            controller.enqueue(encoder.encode(encodeSSE(event)));
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          const errorEvent: StreamEvent = {
            type: "error",
            data: { code: message === "GENERATION_FAILED" ? "GENERATION_FAILED" : "INTERNAL_ERROR", message },
          };
          controller.enqueue(encoder.encode(encodeSSE(errorEvent)));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return new Response(
        JSON.stringify({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return new Response(
        JSON.stringify({ success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required" } }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
