# Guide 3 Exploration Report: Onyx RAG Integration

> Generated: 2026-03-02
> Status: Ready for guide build
> Prerequisites: Guide 1 (Foundation) complete, Guide 2 (Content Map) complete

---

## 1. Guide 3 Scope and Objectives

**What it builds:** The connection between the Next.js app and the Onyx CE instance for Knowledge Base retrieval.

**Why it exists:** The orchestration layer (Guide 5) needs KB context to populate Layer 4 of the system prompt. This guide builds the retrieval layer.

**File ownership** (must not create/modify files outside these paths):
- `src/app/api/onyx/` — API route handlers
- `src/lib/onyx/` — client library, query builder, context assembler, health checker
- `scripts/test-guide-3.ts` — integration test script

**Downstream dependency:** Guide 5 (Orchestration Layer + Claude API) depends on Guide 3.

---

## 2. Deliverables

### Files to Create
| File | Purpose |
|------|---------|
| `src/lib/onyx/client.ts` | Replace stub with full HTTP client (timeout + retry + exponential backoff) |
| `src/lib/onyx/query-builder.ts` | Build multiple focused queries per article brief |
| `src/lib/onyx/context-assembler.ts` | Format OnyxSearchResult[] into prompt-ready string for Layer 4 |
| `src/lib/onyx/health-checker.ts` | Check Onyx responsiveness, return OnyxHealthStatus |
| `src/app/api/onyx/search/route.ts` | POST — KB query endpoint |
| `src/app/api/onyx/health/route.ts` | GET — Onyx status endpoint |
| `scripts/test-guide-3.ts` | Integration test script |

### Pre-existing Types (DO NOT redefine — already in `src/types/onyx.ts`)
```typescript
export interface OnyxSearchResult {
  documentId: string;
  content: string;
  sourceDocument: string; // Filename or document title
  score: number;
  metadata: Record<string, unknown>;
}

export interface OnyxContext {
  query: string;
  results: OnyxSearchResult[];
  totalResults: number;
  searchTimeMs: number;
}

export interface OnyxHealthStatus {
  healthy: boolean;
  indexedDocuments: number | null;
  lastIndexTime: string | null;
  responseTimeMs: number;
}
```

### Pre-existing Error Code (in `src/types/api.ts`)
`ONYX_UNAVAILABLE` — already registered in the `ErrorCode` union type.

---

## 3. Onyx CE Live Instance — Verified State

### Connectivity Results
| Check | Result |
|-------|--------|
| Base URL reachable | `https://rmoss-onyx.xyz` — HTTP 200 in ~102ms |
| Health endpoint | `GET /api/health` → `{"success":true,"message":"ok","data":null}` |
| Authentication | `Authorization: Bearer {ONYX_API_KEY}` works. `X-API-Key` does NOT work (403). |
| API key role | `basic` — NOT admin/curator. Some admin endpoints return 403. |
| Embedding model | nomic-embed-text-v1 (768 dims) — configured and working |
| Google Drive connector | Exists (id=6, source=google_drive) — connected to BWC KB folder |
| Indexed sources | `["google_drive"]` |
| Document sets | `[]` (none defined) |
| Version | Onyx v2.12.1 |

### RESOLVED: LLM Provider Now Configured
Claude LLM has been enabled in the Onyx admin UI. The `/api/chat/send-chat-message` endpoint now returns full answers with retrieved documents and citations. Response time is 18-35s for chat-with-LLM responses.

**Note for Guide 3:** We still prefer `skip_gen_ai_answer_generation: true` for the client library — we only need the retrieved document chunks, not Onyx's synthesized answer. Guide 5 uses Claude directly for synthesis. Using `skip_gen_ai` is faster (~5s vs 18-35s) and avoids double-LLM overhead.

### RESOLVED: API Key Elevated to Admin
The API key now has admin role. `POST /api/admin/search` returns HTTP 200 with ranked document results (16 docs for "Bajo vineyard elevation" query, top score 6.42, ~2.6s response time). `POST /api/manage/admin/connector/indexing-status` also works — reports 33 documents indexed, last successful index run 2026-03-02.

### Environment Variable Issue
`.env.local` has `ONYX_BASE_URL=http://localhost:8080` — must be corrected to `https://rmoss-onyx.xyz`. The `.env.example` already has the correct value.

---

## 4. Onyx API Contract (from OpenAPI spec)

### Strategy: Two API Approaches Available

**Approach A: Admin search (RECOMMENDED — NOW AVAILABLE)**
`POST /api/admin/search` — simple request/response, ~2.6s, returns ranked `SearchDoc[]` directly. No chat session management needed. Requires admin API key (now configured).

**Approach B: Chat-based retrieval (FALLBACK)**
Uses the chat session flow with `skip_gen_ai_answer_generation: true`. Streaming NDJSON, ~5s, more complex parsing. Use if admin search is insufficient or if we need Onyx's auto-generated sub-queries.

### Approach A: Chat-Based Retrieval Flow

#### Step 1: Create Chat Session
```
POST /api/chat/create-chat-session
Authorization: Bearer {ONYX_API_KEY}
Body: { "persona_id": 0 }
Response: { "chat_session_id": "uuid-string" }
```

#### Step 2: Send Message (with retrieval, skip LLM)
```
POST /api/chat/send-message
Authorization: Bearer {ONYX_API_KEY}
Body: {
  "chat_session_id": "uuid-from-step-1",
  "parent_message_id": null,
  "message": "What is the elevation of Bajo vineyard?",
  "search_doc_ids": null,
  "retrieval_options": {
    "run_search": "always",
    "real_time": true,
    "filters": null,
    "dedupe_docs": true
  },
  "skip_gen_ai_answer_generation": true
}
```

Response is a **streaming NDJSON** response. Each line is a JSON object. Document results appear as `SearchDoc` objects in the stream.

#### Alternative: Non-streaming endpoint
```
POST /api/chat/send-chat-message
Authorization: Bearer {ONYX_API_KEY}
Body: {
  "message": "What is the elevation of Bajo vineyard?",
  "chat_session_id": null,
  "chat_session_info": { "persona_id": 0 },
  "stream": false,
  "include_citations": true
}
```
Returns `ChatFullResponse`:
```typescript
{
  answer: string;
  answer_citationless: string;
  top_documents: SearchDoc[];
  citation_info: CitationInfo[];
  message_id: number;
  chat_session_id: string | null;
  error_msg: string | null;
}
```

### SearchDoc Schema (what Onyx returns per document chunk)
```typescript
interface OnyxSearchDoc {
  document_id: string;       // → maps to OnyxSearchResult.documentId
  chunk_ind: number;
  semantic_identifier: string; // → maps to OnyxSearchResult.sourceDocument
  link: string | null;
  blurb: string;              // → maps to OnyxSearchResult.content
  source_type: string;        // e.g., "google_drive"
  boost: number;
  hidden: boolean;
  metadata: Record<string, string | string[]>;
  score: number | null;       // → maps to OnyxSearchResult.score
  is_relevant: boolean | null;
  relevance_explanation: string | null;
  match_highlights: string[];
  updated_at: string | null;  // ISO datetime
  primary_owners: string[] | null;
  secondary_owners: string[] | null;
  is_internet: boolean;       // default false
}
```

### BaseFilters Schema
```typescript
interface BaseFilters {
  source_type?: string[] | null;  // e.g., ["google_drive"]
  document_set?: string[] | null;
  time_cutoff?: string | null;    // ISO datetime
  tags?: Tag[] | null;
}
```

### RetrievalDetails Schema
```typescript
interface RetrievalDetails {
  chunks_above?: number | null;
  chunks_below?: number | null;
  full_doc?: boolean;            // default false
  run_search?: "always" | "never" | "auto";  // default "auto"
  real_time?: boolean;           // default true
  filters?: BaseFilters | null;
  enable_auto_detect_filters?: boolean | null;
  offset?: number | null;
  limit?: number | null;
  dedupe_docs?: boolean;         // default false
}
```

---

## 5. Established Codebase Patterns

### API Route Handler Pattern
From `src/app/api/content-map/route.ts` (canonical example):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";

export async function GET() {
  try {
    await requireRole("admin", "editor", "viewer");
    // ... business logic ...
    return NextResponse.json({ success: true, data: result });
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
```

**Guide 3 addition:** Add `ONYX_UNAVAILABLE` error handling at HTTP 503:
```typescript
if (message === "ONYX_UNAVAILABLE") {
  return NextResponse.json(
    { success: false, error: { code: "ONYX_UNAVAILABLE", message: "Knowledge base unavailable" } },
    { status: 503 }
  );
}
```

### Retry Pattern (model from `src/lib/db/retry.ts`)
```typescript
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = /* check error message patterns */;
      if (!isRetryable || attempt === maxRetries) throw lastError;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
```
Guide 3 should build `retryOnyxRequest` in `src/lib/onyx/client.ts` following this pattern, with HTTP-specific retryable conditions (timeout, ECONNRESET, 502, 503, 504).

### Environment Accessor Pattern (`src/lib/env.ts`)
Currently has `ONYX_API_URL` and `ONYX_API_KEY` but is missing `ONYX_BASE_URL`, `ONYX_INDEX_NAME`, and `ONYX_SEARCH_TIMEOUT_MS`. The existing stub in `src/lib/onyx/client.ts` reads `process.env` directly. Guide 3 should add missing vars to `env.ts`.

### Test Script Pattern (from `scripts/test-guide-2.ts`)
```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function test() {
  let passed = 0;
  let failed = 0;

  function check(name: string, result: boolean, detail?: string) {
    if (result) { console.log(`  PASS ${name}`); passed++; }
    else { console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
  }

  console.log("\n=== Guide N Integration Tests ===\n");
  // ... test sections ...
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

test();
```

Guide 3 test script won't need Prisma (stateless retrieval layer). It needs `fetch` calls to the Onyx API and optionally to the local dev server API routes.

---

## 6. Key Architectural Decisions

### 6A. Primary: Admin Search Endpoint
Now that the API key has admin role, `POST /api/admin/search` is the simplest and fastest path:
- **~2.6s response time** (vs 5s streaming or 18-35s with LLM)
- Simple request/response — no chat session management, no stream parsing
- Returns ranked `SearchDoc[]` directly with scores, blurbs, match highlights, and source attribution
- Request: `{ "query": "string", "filters": {} }`
- Response: `{ "documents": SearchDoc[] }`

### 6B. Fallback: Chat-based retrieval with `skip_gen_ai_answer_generation: true`
If admin search proves insufficient (e.g., we want Onyx's auto-generated sub-queries), the chat path is available:
- Create session → send message with `skip_gen_ai_answer_generation: true`
- Streaming NDJSON, ~5s for document results
- Onyx auto-generates multiple search queries (e.g., "Bajo vineyard elevation", "Bajo vineyard altitude", "Bajo vinedo elevacion")
- More complex to parse but richer retrieval behavior

### 6B-alt. NOT recommended: Full LLM chat
`POST /api/chat/send-chat-message` with LLM generation works but takes 18-35s and we don't need Onyx's answer — Guide 5 uses Claude directly for synthesis.

### 6C. Multiple Focused Queries
Per the spec: "Structured query strategy: multiple focused queries per article rather than one broad query." The query builder should accept an article brief (title, mainEntity, supportingEntities, targetKeywords) and generate 3-5 focused questions, e.g.:
- Factual data: "What is the elevation and soil type at {vineyard}?"
- Winemaker notes: "What are the winemaker's notes on {variety} from {vineyard}?"
- Press coverage: "What press coverage exists for {entity}?"
- Brand context: "What is the brand story related to {topic}?"

### 6D. Context Assembly for Layer 4
The context assembler takes `OnyxSearchResult[]` and formats them into a structured string for the system prompt:
```
=== Knowledge Base Context ===
Source: Vineyard Master Data.gsheet
Relevance: 0.89
> The Bajo vineyard sits at 1,200m elevation with sandy loam soil...

Source: 2024 Vintage Portfolio.gdoc
Relevance: 0.82
> The 2024 Merlot from Bajo shows exceptional...
```

### 6E. Chat Session Management
Each search operation creates a new chat session (stateless from our perspective). No session reuse across requests — keeps the client simple and avoids stale state.

---

## 7. Validation Gates

### Gate 1: Lint and Type Check
```bash
npx tsc --noEmit          # Zero type errors
npx next lint              # Zero lint errors
```

### Gate 2: Integration Test
`npx tsx scripts/test-guide-3.ts` must pass. Tests:
1. Onyx health endpoint returns healthy status
2. Search endpoint returns results for "Bajo vineyard elevation"
3. Results contain source attribution (sourceDocument field)
4. Response includes search timing (searchTimeMs)
5. API routes respond correctly (if dev server running)

### Gate 3: Human Checkpoint
- Onyx health endpoint returns status
- Search endpoint returns KB results for "Bajo vineyard elevation"
- Verify KB results contain actual vineyard data from Google Drive

---

## 8. Open Questions / Pre-Build Checklist

### Resolved
- [x] **LLM Provider**: Claude LLM enabled in Onyx admin UI. Chat endpoints now return full answers.
- [x] **API Key Role**: Elevated to admin. `POST /api/admin/search` now works (HTTP 200, ~2.6s).
- [x] **Indexing Status**: Google Drive connector active, 33 documents indexed, last run 2026-03-02.

### Must Resolve Before Building
- [ ] **Fix `.env.local`**: Change `ONYX_BASE_URL` from `http://localhost:8080` to `https://rmoss-onyx.xyz`

### Nice to Have
- [ ] Create a document set in Onyx to scope searches to KB folder only

---

## 9. Env Vars Summary

### Already in `.env.example` (no changes needed)
```
ONYX_BASE_URL=https://rmoss-onyx.xyz
ONYX_API_URL=https://rmoss-onyx.xyz/api
ONYX_API_KEY=your-onyx-api-key
ONYX_INDEX_NAME=default
ONYX_SEARCH_TIMEOUT_MS=10000
```

### Need to Add to `src/lib/env.ts`
```typescript
ONYX_BASE_URL: optionalEnv('ONYX_BASE_URL', ''),
ONYX_INDEX_NAME: optionalEnv('ONYX_INDEX_NAME', 'default'),
ONYX_SEARCH_TIMEOUT_MS: optionalEnv('ONYX_SEARCH_TIMEOUT_MS', '10000'),
```

---

## 10. Verified Timing Data

| Endpoint | Response Time | Notes |
|----------|--------------|-------|
| `GET /api/health` | ~100ms | Fast, reliable |
| `POST /api/admin/search` | ~2.6s | Primary search path |
| `POST /api/chat/create-chat-session` | 0.4s–55s | Cold start can be very slow |
| `POST /api/chat/send-message` (skip LLM) | ~5s first chunk | Streaming NDJSON |
| `POST /api/chat/send-chat-message` (with LLM) | 18–35s | Full body arrives after streaming completes |
| `POST /api/manage/admin/connector/indexing-status` | ~0.5s | Must use POST, not GET |

**Key finding:** Admin search (~2.6s) is 2-14x faster than chat-based approaches. Use it as the primary path.

---

## 11. Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Onyx slow/unresponsive (4GB droplet) | 15s timeout for admin search, 60s for chat endpoints; retry with exponential backoff (500ms, 1s, 2s) |
| Onyx cold start after idle (up to 55s for chat session creation) | Retry logic with generous timeouts; prefer admin search which has no cold-start issue |
| Double-LLM overhead | Use `skip_gen_ai_answer_generation: true` or admin search — only retrieve docs, don't ask Onyx to synthesize |
| Google Drive not yet indexed | Health endpoint reports indexedDocuments count (currently 33); test script checks this |
| Onyx completely down | Return `ONYX_UNAVAILABLE` error; Guide 5 handles graceful degradation (generate without KB context) |
