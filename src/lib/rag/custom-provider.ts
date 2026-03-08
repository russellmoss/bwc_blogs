import { prisma } from "@/lib/db";
import { searchCustomRag, searchCustomRagMulti } from "./search";
import type { OnyxContext, OnyxHealthStatus } from "@/types/onyx";
import type { RagProvider } from "@/types/rag";

export class CustomProvider implements RagProvider {
  readonly type = "custom" as const;

  async search(query: string): Promise<OnyxContext> {
    return searchCustomRag(query);
  }

  async searchMulti(queries: string[]): Promise<OnyxContext[]> {
    return searchCustomRagMulti(queries);
  }

  async health(): Promise<OnyxHealthStatus> {
    const startTime = Date.now();
    const db = prisma;

    try {
      const [docCount, , syncState] = await Promise.all([
        db.ragDocument.count(),
        db.ragChunk.count(),
        db.ragSyncState.findUnique({ where: { id: 1 } }),
      ]);

      return {
        healthy: docCount > 0,
        indexedDocuments: docCount,
        lastIndexTime: syncState?.lastSyncAt?.toISOString() ?? null,
        responseTimeMs: Date.now() - startTime,
      };
    } catch {
      return {
        healthy: false,
        indexedDocuments: null,
        lastIndexTime: null,
        responseTimeMs: Date.now() - startTime,
      };
    }
  }
}
