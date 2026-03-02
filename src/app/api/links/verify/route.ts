import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const VerifyRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50),
});

interface LinkCheckResult {
  url: string;
  status: number;
  ok: boolean;
  redirectUrl?: string;
  error?: string;
}

const LINK_CHECK_TIMEOUT_MS = 5000;
const MAX_CONCURRENT = 20;

async function checkLink(url: string): Promise<LinkCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "BWC-Content-Engine-LinkChecker/1.0",
      },
    });

    const result: LinkCheckResult = {
      url,
      status: response.status,
      ok: response.ok,
    };

    // Check if there was a redirect
    if (response.url !== url) {
      result.redirectUrl = response.url;
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      url,
      status: 0,
      ok: false,
      error: message.includes("AbortError") || message.includes("abort")
        ? "Timeout"
        : message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = VerifyRequestSchema.safeParse(body);

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

    const { urls } = parsed.data;

    // Process in batches to respect concurrency limit
    const results: LinkCheckResult[] = [];
    for (let i = 0; i < urls.length; i += MAX_CONCURRENT) {
      const batch = urls.slice(i, i + MAX_CONCURRENT);
      const batchResults = await Promise.allSettled(batch.map(checkLink));
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            url: batch[batchResults.indexOf(result)] || "unknown",
            status: 0,
            ok: false,
            error: result.reason?.message || "Check failed",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          ok: results.filter((r) => r.ok).length,
          broken: results.filter((r) => !r.ok).length,
        },
      },
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
