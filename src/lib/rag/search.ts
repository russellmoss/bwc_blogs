import { prisma } from "@/lib/db";
import { embedQuery } from "./embedder";
import type { OnyxSearchResult, OnyxContext } from "@/types/onyx";

const DEFAULT_TOP_K = 10;
const MIN_SIMILARITY = 0.3;

interface ChunkRow {
  id: number;
  content: string;
  heading_context: string | null;
  token_count: number;
  document_id: number;
  filename: string;
  drive_file_id: string;
  similarity: number;
}

/**
 * Search for chunks similar to the query using pgvector cosine similarity.
 * Returns results in OnyxSearchResult format for compatibility.
 */
export async function searchCustomRag(
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<OnyxContext> {
  const startTime = Date.now();
  const db = prisma;

  // Embed the query
  const queryEmbedding = await embedQuery(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // Cosine similarity search via pgvector
  const rows = await db.$queryRawUnsafe<ChunkRow[]>(
    `SELECT
       c.id,
       c.content,
       c.heading_context,
       c.token_count,
       c.document_id,
       d.filename,
       d.drive_file_id,
       1 - (c.embedding <=> $1::vector) AS similarity
     FROM rag_chunks c
     JOIN rag_documents d ON d.id = c.document_id
     WHERE c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    embeddingStr,
    topK
  );

  // Filter by minimum similarity and map to OnyxSearchResult
  const results: OnyxSearchResult[] = rows
    .filter((row) => row.similarity >= MIN_SIMILARITY)
    .map((row) => ({
      documentId: String(row.document_id),
      content: row.content,
      sourceDocument: row.filename,
      score: row.similarity,
      link: `https://drive.google.com/file/d/${row.drive_file_id}/view`,
      metadata: {
        chunkId: row.id,
        headingContext: row.heading_context,
        tokenCount: row.token_count,
        provider: "custom",
      },
    }));

  const searchTimeMs = Date.now() - startTime;
  console.log(`[rag-search] query="${query.slice(0, 60)}" results=${results.length} timeMs=${searchTimeMs}`);

  return {
    query,
    results,
    totalResults: results.length,
    searchTimeMs,
  };
}

/**
 * Search with multiple queries in parallel.
 */
export async function searchCustomRagMulti(
  queries: string[]
): Promise<OnyxContext[]> {
  const results = await Promise.allSettled(
    queries.map((q) => searchCustomRag(q))
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<OnyxContext> => r.status === "fulfilled"
    )
    .map((r) => r.value);
}
