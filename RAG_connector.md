# Custom RAG Connector — Replaced Onyx CE

## Overview

Replaced Onyx CE (was running on a $24/mo DigitalOcean droplet) with a custom RAG pipeline using:
- **Neon Postgres + pgvector** for vector storage and cosine similarity search
- **Google Vertex AI text-embedding-004** for embeddings (768 dimensions)
- **Google Drive Changes API** for incremental sync
- **GitHub Actions cron** (every 30 min) for scheduled syncs
- **UI sync button** on the Settings page for manual on-demand sync

Indexes 33 files (679 chunks) from a Google Drive folder containing markdown docs and Google Docs. Saves $24/mo, eliminates a separate server, and tightens integration with the existing Neon database.

## Architecture

```
GitHub Actions (*/30 cron)  ──POST──>  /api/rag/sync  <──POST──  Settings UI button
                                          │
                              Google Drive Changes API
                              (incremental: only changed files)
                                          │
                                    ┌─────▼──────┐
                                    │  Chunker    │  (~500 tok, ~100 overlap)
                                    └─────┬──────┘
                                          │
                                    ┌─────▼──────┐
                                    │  Embedder   │  Vertex AI text-embedding-004
                                    │             │  (batch size 80, retry on 429/5xx)
                                    └─────┬──────┘
                                          │
                                    ┌─────▼──────┐
                                    │  Neon PG    │  pgvector cosine similarity
                                    │  + pgvector │  HNSW index, min similarity 0.3
                                    └─────┬──────┘
                                          │
              getRagProvider() ◄───────────┘
                    │
         layer-kb-context.ts  (single integration point)
                    │
         context-assembler.ts  (unchanged)
                    │
         prompt assembly → article generation → citations
```

## Current Status

- **`RAG_PROVIDER=custom`** is the default and is active on both Vercel production and local dev
- Onyx CE is decommissioned — the droplet can be shut down
- The provider abstraction (onyx/custom/both) remains in code but `custom` is the only active provider

## Environment Variables

| Var | Default | Purpose |
|---|---|---|
| `RAG_PROVIDER` | `custom` | Which provider to use (`custom`, `onyx`, or `both`) |
| `GOOGLE_DRIVE_DOCS_FOLDER_ID` | — | Drive folder containing markdown docs |
| `GOOGLE_DRIVE_DOCS_FOLDER_URL` | — | Human-readable Drive folder URL |
| `VERTEX_AI_LOCATION` | `us-central1` | GCP region for Vertex AI embeddings |

Reuses `GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY` for both Drive API access and Vertex AI embeddings. No new API keys needed.

## Database Models

### RagDocument
Tracks each Drive file indexed. Keyed by `driveFileId` (unique). Stores filename, MIME type, `md5Checksum` for change detection (set last in transaction for crash safety), `driveModifiedAt` as fallback for Google Docs that lack md5.

### RagChunk
Each document is split into overlapping chunks (~500 tokens, ~100 token overlap). Each chunk stores its content, heading context, token count, and embedding as a `vector(768)` column with an HNSW index for fast cosine similarity search. Cascade-deletes when parent document is removed.

### RagSyncState
Single-row table (id=1) storing the Drive Changes API `startPageToken` for incremental sync, last sync timestamp, and last sync result JSON.

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/rag/sync` | POST | CRON_SECRET or session | Incremental sync from Drive |
| `/api/rag/health` | GET | CRON_SECRET or session | Health check: doc/chunk count, sync status |
| `/api/rag/compare` | POST | CRON_SECRET | A/B comparison for test queries |

The sync and health routes accept both `Authorization: Bearer <CRON_SECRET>` (for GitHub Actions) and browser session auth (for the Settings page UI button).

## Sync Pipeline

1. **Trigger**: GitHub Actions cron (every 30 min), manual workflow dispatch, or Settings page "Sync Knowledge Base" button
2. Route calls `runIncrementalSync()` which fetches changes since last `startPageToken` via Drive Changes API
3. Resolves all subfolder IDs under the root docs folder (recursive BFS) so changes at any nesting depth are caught
4. For each changed file:
   - Skip if md5 hash matches (or `driveModifiedAt` hasn't changed for Google Docs)
   - Download content (Google Docs exported as plain text)
   - Embed all chunks via Vertex AI **before** opening the transaction
   - In a Prisma interactive transaction (30s timeout):
     - Upsert document record with md5 set to null
     - Delete old chunks
     - Insert new chunks with embeddings via raw SQL (`::vector` cast)
     - Set md5 checksum last (crash before this = next sync re-indexes)
5. Update `startPageToken` and sync result in `rag_sync_state`

## Search Pipeline

1. `layer-kb-context.ts` calls `getRagProvider().searchMulti(queries)` with queries built from the article brief
2. `CustomProvider` embeds each query via Vertex AI with `RETRIEVAL_QUERY` task type
3. pgvector cosine similarity search: `1 - (embedding <=> query::vector)` with min similarity 0.3, top 10 results
4. Results mapped to `OnyxSearchResult` format (documentId, content, sourceDocument, score, link, metadata)
5. `context-assembler.ts` deduplicates, applies trigram near-duplicate filter, caps at 8,000 chars
6. Surviving sources flow through to `CitationView` in the composer — source name, content snippet, Drive link, confidence score all preserved

## UI: Settings Page

The **Knowledge Base** section at the top of the Settings page (`/dashboard/settings`) shows:
- **Documents**: total indexed files (currently 33)
- **Chunks**: total chunks across all documents (currently 679)
- **Status**: healthy/unhealthy indicator
- **Last Sync**: timestamp of most recent sync
- **"Sync Knowledge Base" button**: triggers incremental sync, shows spinner while running, displays results (files updated, chunks created, duration, errors)

## Key Implementation Details

- **Batch size**: MAX_BATCH_SIZE=80 (reduced from Vertex AI's 250 limit to stay under the 20k token-per-request limit for large documents)
- **Truncation**: Individual texts truncated at 75,000 chars before embedding
- **Retry**: Embedding requests retry twice with exponential backoff on 429/5xx
- **Transaction safety**: md5 written last inside transaction — crash at any earlier point means next sync re-indexes the file
- **Shared Prisma client**: All RAG code uses `import { prisma } from "@/lib/db"` singleton
- **Auth middleware**: `src/proxy.ts` excludes `api/rag` and `api/cron` paths so CRON_SECRET-authed requests aren't redirected to login

## Initial Bulk Load

Run `scripts/rag-bulk-index.ts` locally (not on Vercel — avoids timeout) to index all files:
```bash
npx tsx scripts/rag-bulk-index.ts
```
Skips files whose md5 hasn't changed. Safe to re-run.

## Migration Path (Completed)

1. Deployed with `RAG_PROVIDER=onyx` — identical behavior to pre-change
2. Set up database: pgvector extension, 3 tables, HNSW index
3. Ran bulk index locally — 33/33 files, 679 chunks, 0 errors
4. Switched to `RAG_PROVIDER=both` — validated custom results (scores 0.77-0.79), Onyx returning null (droplet down)
5. Switched to `RAG_PROVIDER=custom` — cutover complete
6. Changed default from `onyx` to `custom` in env.ts and provider.ts
7. Onyx CE droplet ready to decommission ($24/mo saved)

## Files

### New Files
- `src/types/rag.ts` — RagProvider interface, types, RagHealthResponse
- `src/lib/rag/drive-auth.ts` — Google auth with cached client (drive.readonly + cloud-platform scopes)
- `src/lib/rag/chunker.ts` — Recursive markdown splitter with heading-aware splitting
- `src/lib/rag/embedder.ts` — Vertex AI text-embedding-004 client (batch size 80, retry, truncation)
- `src/lib/rag/search.ts` — pgvector cosine similarity search → OnyxSearchResult mapping
- `src/lib/rag/drive-sync.ts` — Incremental sync, recursive subfolder discovery, crash-safe indexing
- `src/lib/rag/provider.ts` — Factory: getRagProvider() with module-level cache
- `src/lib/rag/onyx-provider.ts` — Wraps existing Onyx functions (legacy, not active)
- `src/lib/rag/custom-provider.ts` — pgvector-based provider using shared prisma singleton
- `src/lib/rag/both-provider.ts` — A/B comparison mode (used during validation, not active)
- `src/lib/rag/index.ts` — Barrel exports
- `src/app/api/rag/sync/route.ts` — POST sync endpoint (CRON_SECRET + session auth, maxDuration=60)
- `src/app/api/rag/health/route.ts` — GET health endpoint (CRON_SECRET + session auth)
- `src/app/api/rag/compare/route.ts` — POST A/B comparison endpoint (CRON_SECRET auth)
- `.github/workflows/rag-sync.yml` — Cron every 30 min + manual dispatch
- `scripts/rag-bulk-index.ts` — One-time initial index (run locally)

### Modified Files
- `prisma/schema.prisma` — Added RagDocument, RagChunk, RagSyncState models
- `src/lib/env.ts` — Added RAG_PROVIDER (default: custom), GOOGLE_DRIVE_DOCS_FOLDER_ID, VERTEX_AI_LOCATION
- `.env.example` — Added new vars with custom as default
- `src/types/api.ts` — Added RAG_SYNC_FAILED error code
- `src/types/index.ts` — Re-export rag types
- `src/lib/prompt-assembly/layer-kb-context.ts` — Use `getRagProvider().searchMulti()` instead of direct `searchOnyxMulti()`
- `src/proxy.ts` — Added `api/rag` and `api/cron` to auth middleware exclusions
- `src/app/dashboard/settings/page.tsx` — Added Knowledge Base section with sync button and health stats
