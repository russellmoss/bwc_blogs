import { OnyxProvider } from "./onyx-provider";
import { CustomProvider } from "./custom-provider";
import type { OnyxContext, OnyxHealthStatus } from "@/types/onyx";
import type { RagProvider } from "@/types/rag";

/**
 * A/B comparison provider: runs both Onyx and Custom in parallel.
 * Returns custom results (for validation), logs comparison metrics.
 */
export class BothProvider implements RagProvider {
  readonly type = "both" as const;
  private onyx = new OnyxProvider();
  private custom = new CustomProvider();

  async search(query: string): Promise<OnyxContext> {
    const [onyxResult, customResult] = await Promise.allSettled([
      this.onyx.search(query),
      this.custom.search(query),
    ]);

    this.logComparison(
      query,
      onyxResult.status === "fulfilled" ? onyxResult.value : null,
      customResult.status === "fulfilled" ? customResult.value : null
    );

    // Return custom results (what we're validating)
    if (customResult.status === "fulfilled") return customResult.value;
    // Fallback to onyx if custom fails
    if (onyxResult.status === "fulfilled") return onyxResult.value;
    throw new Error("Both RAG providers failed");
  }

  async searchMulti(queries: string[]): Promise<OnyxContext[]> {
    const [onyxResults, customResults] = await Promise.allSettled([
      this.onyx.searchMulti(queries),
      this.custom.searchMulti(queries),
    ]);

    const onyxContexts = onyxResults.status === "fulfilled" ? onyxResults.value : [];
    const customContexts = customResults.status === "fulfilled" ? customResults.value : [];

    // Log per-query comparison
    for (let i = 0; i < queries.length; i++) {
      this.logComparison(
        queries[i],
        onyxContexts[i] ?? null,
        customContexts[i] ?? null
      );
    }

    // Return custom results, falling back to onyx
    return customContexts.length > 0 ? customContexts : onyxContexts;
  }

  async health(): Promise<OnyxHealthStatus> {
    const [onyxHealth, customHealth] = await Promise.allSettled([
      this.onyx.health(),
      this.custom.health(),
    ]);

    // Return custom health, supplemented with onyx info
    if (customHealth.status === "fulfilled") return customHealth.value;
    if (onyxHealth.status === "fulfilled") return onyxHealth.value;
    return {
      healthy: false,
      indexedDocuments: null,
      lastIndexTime: null,
      responseTimeMs: -1,
    };
  }

  private logComparison(
    query: string,
    onyx: OnyxContext | null,
    custom: OnyxContext | null
  ): void {
    const onyxTop = onyx?.results[0];
    const customTop = custom?.results[0];

    console.log("[rag-compare]", JSON.stringify({
      query: query.slice(0, 80),
      onyx: onyx ? {
        count: onyx.totalResults,
        topScore: onyxTop?.score ?? 0,
        topSource: onyxTop?.sourceDocument ?? null,
        timeMs: onyx.searchTimeMs,
      } : null,
      custom: custom ? {
        count: custom.totalResults,
        topScore: customTop?.score ?? 0,
        topSource: customTop?.sourceDocument ?? null,
        timeMs: custom.searchTimeMs,
      } : null,
    }));
  }
}
