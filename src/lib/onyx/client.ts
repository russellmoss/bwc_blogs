import { env } from "@/lib/env";
import type { OnyxSearchResult, OnyxContext } from "@/types/onyx";

// ── Filter type ──────────────────────────────────────────────────────
export interface OnyxSearchFilters {
  sourceType?: string[];
  documentSet?: string[];
  timeCutoff?: string;
}

// ── Configuration ────────────────────────────────────────────────────
export function getOnyxConfig() {
  return {
    baseUrl: env.ONYX_BASE_URL || env.ONYX_API_URL.replace(/\/api$/, ""),
    apiKey: env.ONYX_API_KEY,
    timeoutMs: parseInt(env.ONYX_SEARCH_TIMEOUT_MS, 10) || 10000,
  };
}

// ── Retry constants ──────────────────────────────────────────────────
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof TypeError) {
    const msg = String(error.message || "");
    return (
      msg.includes("ECONNRESET") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("fetch failed")
    );
  }
  return false;
}

function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function isNonRetryableStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 404;
}

// ── Internal fetch with retry + timeout ──────────────────────────────
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (isNonRetryableStatus(response.status)) {
        return response;
      }

      if (isRetryableStatus(response.status)) {
        lastError = new Error(`HTTP ${response.status}`);
        if (attempt === MAX_RETRIES) return response;
        // fall through to retry
      } else {
        return response;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isRetryableError(error) || attempt === MAX_RETRIES) {
        throw lastError;
      }
    } finally {
      clearTimeout(timer);
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt);
    console.warn(
      `[onyx-client] Retry ${attempt + 1}/${MAX_RETRIES} for ${url} after ${delay}ms`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw lastError ?? new Error("ONYX_UNAVAILABLE");
}

// ── Map Onyx SearchDoc to OnyxSearchResult ───────────────────────────
interface OnyxSearchDoc {
  document_id?: string;
  blurb?: string;
  semantic_identifier?: string;
  score?: number | null;
  source_type?: string;
  link?: string;
  match_highlights?: string[];
  metadata?: Record<string, unknown>;
}

function mapSearchDoc(doc: OnyxSearchDoc): OnyxSearchResult {
  return {
    documentId: doc.document_id ?? "",
    content: doc.blurb ?? "",
    sourceDocument: doc.semantic_identifier ?? "Unknown",
    score: doc.score ?? 0,
    link: doc.link ?? "",
    metadata: {
      ...doc.metadata,
      sourceType: doc.source_type,
      matchHighlights: doc.match_highlights,
    },
  };
}

// ── Public API: single query, throws on failure ──────────────────────
export async function searchOnyx(
  query: string,
  filters?: OnyxSearchFilters
): Promise<OnyxContext> {
  const config = getOnyxConfig();
  const url = `${config.baseUrl}/api/admin/search`;
  const startTime = Date.now();

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          query,
          filters: {
            source_type: filters?.sourceType ?? null,
            document_set: filters?.documentSet ?? null,
            time_cutoff: filters?.timeCutoff ?? null,
          },
        }),
      },
      config.timeoutMs
    );

    if (!response.ok) {
      throw new Error("ONYX_UNAVAILABLE");
    }

    const data = await response.json();
    const docs: OnyxSearchDoc[] = data.documents ?? data.top_documents ?? [];
    const results = docs.map(mapSearchDoc);

    return {
      query,
      results,
      totalResults: results.length,
      searchTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "ONYX_UNAVAILABLE") throw error;
    throw new Error("ONYX_UNAVAILABLE");
  }
}

// ── Public API: single query, returns null on failure (graceful) ─────
export async function searchOnyxSafe(
  query: string,
  filters?: OnyxSearchFilters
): Promise<OnyxContext | null> {
  try {
    return await searchOnyx(query, filters);
  } catch (error) {
    console.error("[onyx-client] searchOnyxSafe failed:", error);
    return null;
  }
}

// ── Public API: multiple queries in parallel (graceful) ──────────────
export async function searchOnyxMulti(
  queries: string[],
  filters?: OnyxSearchFilters
): Promise<OnyxContext[]> {
  const results = await Promise.allSettled(
    queries.map((q) => searchOnyx(q, filters))
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<OnyxContext> => r.status === "fulfilled"
    )
    .map((r) => r.value);
}
