# Custom RAG Connector — Replace Onyx CE

## Overview

Replaces Onyx CE (running on a $24/mo DigitalOcean droplet) with a custom RAG pipeline using:
- **Neon Postgres + pgvector** for vector storage and cosine similarity search
- **Google Vertex AI text-embedding-004** for embeddings (768 dimensions)
- **Google Drive Changes API** for incremental sync
- **GitHub Actions cron** (every 30 min) for scheduled syncs

Indexes ~200 markdown files from a Google Drive folder. Saves $24/mo, eliminates a separate server, and tightens integration with the existing Neon database.

## Architecture

```
GitHub Actions (*/30 cron)  ──POST──>  /api/rag/sync
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
                                    └─────┬──────┘
                                          │
                                    ┌─────▼──────┐
                                    │  Neon PG    │  pgvector cosine similarity
                                    │  + pgvector │
                                    └─────┬──────┘
                                          │
              getRagProvider() ◄───────────┘
                    │
       ┌────────────┼────────────┐
       │            │            │
   OnyxProvider  CustomProvider  BothProvider
       │            │            │
       └────────────┼────────────┘
                    │
         layer-kb-context.ts  (single integration point)
```

## Environment Variables

| Var | Purpose |
|---|---|
| `RAG_PROVIDER` | `onyx` (default) → `both` → `custom` |
| `GOOGLE_DRIVE_DOCS_FOLDER_ID` | Drive folder with markdown docs |
| `GOOGLE_DRIVE_DOCS_FOLDER_URL` | Human-readable Drive folder URL |
| `VERTEX_AI_LOCATION` | GCP region for embeddings (default: `us-central1`) |

Reuses `GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY` for both Drive API access and Vertex AI embeddings.

## Database Models

### RagDocument
Tracks each Drive file indexed. Keyed by `driveFileId` (unique). Stores filename, Drive metadata, and MD5 hash for change detection.

### RagChunk
Each document is split into overlapping chunks (~500 tokens, ~100 token overlap). Each chunk stores its embedding as a `vector(768)` column with an HNSW index for fast cosine similarity search.

### RagSyncState
Single-row table storing the Drive Changes API `startPageToken` for incremental sync.

## Provider Abstraction

The `getRagProvider()` factory returns one of three providers based on `RAG_PROVIDER` env var:

- **`onyx`** (default): Wraps existing Onyx functions. Zero behavior change.
- **`custom`**: Uses pgvector for search. Returns `OnyxSearchResult`/`OnyxContext` types so downstream code (context-assembler, citation matcher) works unchanged.
- **`both`**: Runs both providers, uses custom results, logs comparison metrics. For A/B validation before cutover.

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/rag/sync` | POST | CRON_SECRET | Incremental sync from Drive |
| `/api/rag/health` | GET | CRON_SECRET | Health check: doc count, sync status |
| `/api/rag/compare` | POST | CRON_SECRET | A/B comparison for test queries |

## Sync Pipeline

1. **GitHub Actions cron** fires every 30 min → POST `/api/rag/sync`
2. Route fetches changes since last `startPageToken` via Drive Changes API
3. For each changed file:
   - Download markdown content
   - Delete old chunks for that document
   - Split into overlapping chunks via recursive markdown splitter
   - Embed each chunk via Vertex AI text-embedding-004
   - Store chunks with embeddings in `rag_chunks` table
4. Update `startPageToken` in `rag_sync_state`

## Initial Bulk Load

Run `scripts/rag-bulk-index.ts` locally (not on Vercel) to index all ~200 files:
```bash
npx tsx scripts/rag-bulk-index.ts
```

## Migration Path

1. Deploy with `RAG_PROVIDER=onyx` — identical behavior to pre-change
2. Run bulk index script locally
3. Switch to `RAG_PROVIDER=both` — generates articles using custom results, logs comparison
4. Validate quality, then switch to `RAG_PROVIDER=custom`
5. Decommission Onyx CE droplet ($24/mo saved)

## Files

### New Files
- `src/types/rag.ts` — RagProvider interface, types
- `src/lib/rag/drive-auth.ts` — Google auth (Drive + Vertex AI)
- `src/lib/rag/chunker.ts` — Recursive markdown splitter
- `src/lib/rag/embedder.ts` — Vertex AI text-embedding-004 client
- `src/lib/rag/search.ts` — pgvector cosine similarity → OnyxSearchResult
- `src/lib/rag/drive-sync.ts` — Incremental sync via Changes API
- `src/lib/rag/provider.ts` — Factory: getRagProvider()
- `src/lib/rag/onyx-provider.ts` — Wraps existing Onyx functions
- `src/lib/rag/custom-provider.ts` — pgvector-based provider
- `src/lib/rag/both-provider.ts` — A/B comparison mode
- `src/lib/rag/index.ts` — Barrel exports
- `src/app/api/rag/sync/route.ts` — POST sync endpoint
- `src/app/api/rag/health/route.ts` — GET health endpoint
- `src/app/api/rag/compare/route.ts` — POST A/B comparison endpoint
- `.github/workflows/rag-sync.yml` — Cron every 30 min + manual trigger
- `scripts/rag-bulk-index.ts` — One-time initial index

### Modified Files
- `prisma/schema.prisma` — Add RagDocument, RagChunk, RagSyncState models
- `src/lib/env.ts` — Add RAG_PROVIDER, GOOGLE_DRIVE_DOCS_FOLDER_ID, VERTEX_AI_LOCATION
- `.env.example` — Add new vars
- `src/types/api.ts` — Add RAG_SYNC_FAILED error code
- `src/types/index.ts` — Re-export rag types
- `src/lib/prompt-assembly/layer-kb-context.ts` — Use getRagProvider() instead of direct Onyx calls
