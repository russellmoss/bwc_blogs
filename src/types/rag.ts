import type { OnyxContext, OnyxHealthStatus } from "./onyx";

// Provider identifier
export type RagProviderType = "onyx" | "custom" | "both";

// Unified provider interface — all providers return Onyx-compatible types
// so downstream code (context-assembler, citation matcher, CitationView) works unchanged
export interface RagProvider {
  readonly type: RagProviderType;

  /** Search with a single query */
  search(query: string): Promise<OnyxContext>;

  /** Search with multiple queries in parallel (graceful — skips failed queries) */
  searchMulti(queries: string[]): Promise<OnyxContext[]>;

  /** Health check */
  health(): Promise<OnyxHealthStatus>;
}

// Chunk metadata stored alongside embeddings
export interface RagChunkData {
  id: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  headingContext: string | null;
}

// Drive sync result
export interface RagSyncResult {
  filesProcessed: number;
  filesDeleted: number;
  chunksCreated: number;
  errors: string[];
  durationMs: number;
}

// Health response for custom RAG
export interface RagHealthResponse {
  provider: RagProviderType;
  healthy: boolean;
  documentCount: number;
  chunkCount: number;
  lastSyncAt: string | null;
  lastSyncPageToken: string | null;
}

// Compare response for A/B testing
export interface RagCompareResult {
  query: string;
  onyx: {
    resultCount: number;
    topScore: number;
    searchTimeMs: number;
    topSources: string[];
  } | null;
  custom: {
    resultCount: number;
    topScore: number;
    searchTimeMs: number;
    topSources: string[];
  } | null;
}
