# Guide 3: Onyx RAG Integration — API Client, Search, Health Monitoring

**Guide type:** Implementation guide for Claude Code agent execution
**Depends on:** Guide 1 (Foundation), Guide 2 (Content Map)
**Downstream:** Guide 5 (Orchestration Layer + Claude API) consumes the Onyx context assembler
**Estimated scope:** 7 files created/replaced, 1 file modified, 1 test script

---

## A. Objective

Build the retrieval layer that connects the Next.js app to the Onyx CE knowledge base instance at `rmoss-onyx.xyz`. The layer must:

1. Execute structured multi-query searches against the Onyx admin search API
2. Assemble retrieved document chunks into a formatted context string for Layer 4 of the system prompt
3. Expose REST endpoints for health monitoring and ad-hoc search
4. Handle Onyx unavailability gracefully — generation proceeds without KB context, never hard-fails

---

## B. Scope

### In Scope
- Full HTTP client with retry + exponential backoff + configurable timeout
- Admin search endpoint (`POST /api/admin/search` on Onyx) as primary retrieval path
- Query builder that generates 3–5 focused queries from an article brief
- Context assembler that formats results for prompt injection
- Health monitoring endpoint
- Search API endpoint
- Integration test script
- Env var updates to `src/lib/env.ts`

### Out of Scope
- Chat-based retrieval (Approach B from exploration — defer unless admin search proves insufficient)
- Document set creation in Onyx admin UI
- Prompt assembly (Guide 5)
- UI components consuming these endpoints (Guide 6+)

---

## C. Depends On

| Dependency | What It Provides | Verified |
|---|---|---|
| Guide 1 | Auth helpers (`requireRole`), type files (`src/types/onyx.ts`, `src/types/api.ts`), env accessor (`src/lib/env.ts`), retry pattern (`src/lib/db/retry.ts`) | Types and auth confirmed in codebase |
| Guide 2 | Content map entries with `mainEntity`, `supportingEntities`, `targetKeywords` fields (used by query builder) | 39 rows seeded, all have keywords and mainEntity |
| Onyx CE | Live at `rmoss-onyx.xyz`, admin API key configured, 33 docs indexed from Google Drive | Verified — admin search returns results in ~2.6s |

---

## D. Shared Contracts Referenced

### Types (DO NOT redefine — already in `src/types/onyx.ts`)
```typescript
interface OnyxSearchResult {
  documentId: string;
  content: string;
  sourceDocument: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface OnyxContext {
  query: string;
  results: OnyxSearchResult[];
  totalResults: number;
  searchTimeMs: number;
}

interface OnyxHealthStatus {
  healthy: boolean;
  indexedDocuments: number | null;
  lastIndexTime: string | null;
  responseTimeMs: number;
}
```

### Error Code (already in `src/types/api.ts`)
`ONYX_UNAVAILABLE` — registered in the `ErrorCode` union type.

### API Response Format (from `src/types/api.ts`)
```typescript
{ success: true, data: T }           // Success
{ success: false, error: { code, message } }  // Error
```

---

## E. Existing Constraints to Preserve

1. **Do not modify `src/types/onyx.ts`** — types are shared contracts from Guide 1
2. **Do not modify `src/types/api.ts`** — error codes are shared contracts from Guide 1
3. **Follow the API route handler pattern** from `src/app/api/content-map/route.ts` exactly (auth → logic → standard error cascade)
4. **Follow the retry pattern** from `src/lib/db/retry.ts` (same structure, HTTP-specific retryable conditions)
5. **File ownership**: only create/modify files under `src/app/api/onyx/`, `src/lib/onyx/`, and `scripts/test-guide-3.ts`. The only exception is `src/lib/env.ts` (adding 3 missing env vars)

---

## F. Files Created / Modified

| File | Action | Purpose |
|---|---|---|
| `src/lib/env.ts` | **MODIFY** | Add `ONYX_BASE_URL`, `ONYX_INDEX_NAME`, `ONYX_SEARCH_TIMEOUT_MS` |
| `src/lib/onyx/client.ts` | **REPLACE** | Full HTTP client with retry, timeout, exponential backoff |
| `src/lib/onyx/query-builder.ts` | **CREATE** | Generate focused queries from article brief metadata |
| `src/lib/onyx/context-assembler.ts` | **CREATE** | Format OnyxSearchResult[] into Layer 4 prompt string |
| `src/lib/onyx/health-checker.ts` | **CREATE** | Check Onyx health + indexing status |
| `src/lib/onyx/index.ts` | **CREATE** | Barrel re-export for clean imports |
| `src/app/api/onyx/health/route.ts` | **CREATE** | GET endpoint for Onyx health status |
| `src/app/api/onyx/search/route.ts` | **CREATE** | POST endpoint for KB search |
| `scripts/test-guide-3.ts` | **CREATE** | Integration test hitting real Onyx endpoint |

---

## G. Technical Design

### G1. Onyx Client (`src/lib/onyx/client.ts`)

The client wraps HTTP calls to the Onyx CE instance with retry logic and timeout management.

**Primary endpoint:** `POST /api/admin/search`
- Request: `{ "query": "string", "filters": {} }`
- Response: `{ "documents": SearchDoc[] }`
- Auth: `Authorization: Bearer {ONYX_API_KEY}`
- Typical response time: ~2.6s

**SearchDoc → OnyxSearchResult mapping:**
```
document_id        → documentId
blurb              → content
semantic_identifier → sourceDocument
score              → score (default 0 if null)
metadata + source_type + match_highlights → metadata
```

**Retry logic:**
- Max 3 retries (4 total attempts)
- Base delay: 500ms, exponential: 500ms → 1s → 2s
- Retryable conditions: timeout, ECONNRESET, ECONNREFUSED, ETIMEDOUT, HTTP 502, 503, 504
- Non-retryable: HTTP 400, 401, 403, 404

**Timeout:**
- Configurable via `ONYX_SEARCH_TIMEOUT_MS` env var (default: 10000ms)
- Uses `AbortController` with `setTimeout`

**Graceful degradation:**
- Client methods return `null` (not throw) when Onyx is unreachable after all retries
- Callers (Guide 5 orchestration) check for null and proceed without KB context
- A separate `searchOrThrow` variant is available for the API route handler which needs to surface the error

### G2. Query Builder (`src/lib/onyx/query-builder.ts`)

Accepts an article brief and generates 3–5 focused search queries.

**Input shape** (subset of content map entry):
```typescript
interface ArticleBrief {
  title: string;
  mainEntity: string;
  supportingEntities: string[];
  targetKeywords: string[];
}
```

**Query generation strategy:**
1. **Primary entity query**: "What are the key facts about {mainEntity}?" — Always generated
2. **Keyword-entity cross query**: "{targetKeywords[0]} {mainEntity}" — Always generated (combines top keyword with main entity)
3. **Supporting entity queries**: One query per supporting entity (up to 2): "What is the relationship between {mainEntity} and {supportingEntity}?"
4. **Brand context query**: "Bhutan Wine Company {mainEntity}" — Always generated to anchor brand context

Cap at 5 queries maximum. Dedup any identical queries.

### G3. Context Assembler (`src/lib/onyx/context-assembler.ts`)

Takes an array of `OnyxContext` results (one per query) and produces a single formatted string for Layer 4 of the system prompt.

**Output format:**
```
=== Knowledge Base Context ===
[Retrieved from BWC internal knowledge base. Use these facts to ground the article.]

--- Source: Vineyard Master Data.gsheet (Relevance: 0.89) ---
The Bajo vineyard sits at 1,200m elevation with sandy loam soil...

--- Source: 2024 Vintage Portfolio.gdoc (Relevance: 0.82) ---
The 2024 Merlot from Bajo shows exceptional...

[X unique sources retrieved, Y total passages]
```

**Deduplication:** Results from multiple queries are deduplicated by `documentId + content` hash. Same document chunk appearing across queries is included only once, keeping the highest score.

**Truncation:** Total context string is capped at 8000 characters to leave room for other prompt layers. Results are included in descending score order until the cap is reached.

**Empty result:** If all queries return zero results, return:
```
=== Knowledge Base Context ===
[No relevant knowledge base content found. Generate article using general knowledge and provided instructions.]
```

### G4. Health Checker (`src/lib/onyx/health-checker.ts`)

Checks two things:
1. **Onyx API health** — `GET {ONYX_BASE_URL}/api/health`
2. **Indexing status** — `POST {ONYX_BASE_URL}/api/manage/admin/connector/indexing-status` (returns doc count and last index time)

Returns an `OnyxHealthStatus` object. If Onyx is unreachable, returns `{ healthy: false, indexedDocuments: null, lastIndexTime: null, responseTimeMs: -1 }`.

### G5. API Routes

**`GET /api/onyx/health`** — Returns Onyx health status. Auth: admin/editor/viewer.

**`POST /api/onyx/search`** — Accepts `{ query: string, filters?: { sourceType?: string[] } }`. Auth: admin/editor. Returns `OnyxContext`.

Both routes follow the exact error handling pattern from `src/app/api/content-map/route.ts`:
- AUTH_REQUIRED → 401
- AUTH_FORBIDDEN → 403
- ONYX_UNAVAILABLE → 503
- INTERNAL_ERROR → 500

---

## H. Step-by-Step Execution Plan

### Phase 1: Environment Setup

#### Step 1.1 — Add missing env vars to `src/lib/env.ts`

Add three entries to the `env` object:

```typescript
ONYX_BASE_URL: optionalEnv('ONYX_BASE_URL', ''),
ONYX_INDEX_NAME: optionalEnv('ONYX_INDEX_NAME', 'default'),
ONYX_SEARCH_TIMEOUT_MS: optionalEnv('ONYX_SEARCH_TIMEOUT_MS', '10000'),
```

Place them immediately after the existing `ONYX_API_KEY` line.

**Verify:** `npx tsc --noEmit` passes. The env object now exports these three additional keys.

---

### Phase 2: Onyx Client Library

#### Step 2.1 — Replace `src/lib/onyx/client.ts` with full HTTP client

Replace the entire stub file with the production client. The module must export:

```typescript
// Configuration
export function getOnyxConfig(): { baseUrl: string; apiKey: string; timeoutMs: number }

// Low-level: single query, throws on failure
export async function searchOnyx(query: string, filters?: OnyxSearchFilters): Promise<OnyxContext>

// Low-level: single query, returns null on failure (graceful)
export async function searchOnyxSafe(query: string, filters?: OnyxSearchFilters): Promise<OnyxContext | null>

// High-level: multiple queries, returns all results (graceful — partial failures OK)
export async function searchOnyxMulti(queries: string[], filters?: OnyxSearchFilters): Promise<OnyxContext[]>

// Filter type
export interface OnyxSearchFilters {
  sourceType?: string[];
  documentSet?: string[];
  timeCutoff?: string;
}
```

**Implementation details:**

1. `getOnyxConfig()` reads from `env` (the centralized env accessor), not `process.env` directly.

2. Internal `fetchWithRetry` function:
   - Uses `AbortController` + `setTimeout` for timeout enforcement
   - Clears timeout in `finally` block to prevent memory leaks
   - Retries on: timeout (AbortError), ECONNRESET, ECONNREFUSED, ETIMEDOUT, HTTP 502/503/504
   - Does NOT retry on: HTTP 400/401/403/404 (these are definitive errors)
   - 3 retries max, base delay 500ms, exponential backoff: `baseDelay * 2^attempt`
   - Logs retry attempts with `console.warn` for observability

3. `searchOnyx(query, filters?)`:
   - Calls `POST {baseUrl}/api/admin/search` with `Authorization: Bearer {apiKey}`
   - Request body: `{ query, filters: { source_type: filters?.sourceType ?? null, document_set: filters?.documentSet ?? null, time_cutoff: filters?.timeCutoff ?? null } }`
   - Maps the Onyx `SearchDoc[]` response to `OnyxSearchResult[]`
   - Records `searchTimeMs` as wall-clock time of the entire request (including retries)
   - Throws an Error with message `"ONYX_UNAVAILABLE"` on failure (for API route handlers to catch)

4. `searchOnyxSafe(query, filters?)`:
   - Wraps `searchOnyx` in try/catch
   - Returns `null` on any error (for orchestration layer — never hard-fails generation)
   - Logs the error with `console.error`

5. `searchOnyxMulti(queries, filters?)`:
   - Runs all queries in parallel with `Promise.allSettled`
   - Collects fulfilled results, ignores rejected ones
   - Returns the array of successful `OnyxContext` objects (may be empty)
   - This is the primary function Guide 5 will call

**Verify:** `npx tsc --noEmit` passes.

#### Step 2.2 — Create `src/lib/onyx/query-builder.ts`

```typescript
export interface ArticleBrief {
  title: string;
  mainEntity: string;
  supportingEntities: string[];
  targetKeywords: string[];
}

export function buildSearchQueries(brief: ArticleBrief): string[]
```

**Implementation:**

1. Start with empty array
2. Push primary entity query: `"What are the key facts about {mainEntity}?"`
3. Push keyword cross query: `"{targetKeywords[0]} {mainEntity}"` (only if targetKeywords is non-empty)
4. Push up to 2 supporting entity queries: `"What is the relationship between {mainEntity} and {supportingEntity}?"`
5. Push brand context query: `"Bhutan Wine Company {mainEntity}"`
6. Deduplicate (case-insensitive)
7. Cap at 5 queries
8. Return the array

Edge cases:
- If `mainEntity` is empty, return `[brief.title]` as the single fallback query
- If all arrays are empty, return `[brief.title]` as the single fallback query

**Verify:** `npx tsc --noEmit` passes.

#### Step 2.3 — Create `src/lib/onyx/context-assembler.ts`

```typescript
export function assembleOnyxContext(contexts: OnyxContext[]): string
```

**Implementation:**

1. Flatten all `OnyxSearchResult[]` from all `OnyxContext` objects into one array
2. Deduplicate by `documentId + content` (use a Set of `${documentId}::${content}` keys). Keep the entry with the highest score on collision.
3. Sort by score descending
4. Build the output string:
   - Header: `=== Knowledge Base Context ===\n[Retrieved from BWC internal knowledge base. Use these facts to ground the article.]\n`
   - For each result (in score order):
     - `\n--- Source: {sourceDocument} (Relevance: {score.toFixed(2)}) ---\n{content}\n`
   - Footer: `\n[{uniqueSources} unique sources retrieved, {totalPassages} total passages]`
5. Enforce 8000-character cap: after adding each result, check total length. Stop when the next result would exceed the cap.
6. If zero results after dedup, return the "no content found" message:
   ```
   === Knowledge Base Context ===
   [No relevant knowledge base content found. Generate article using general knowledge and provided instructions.]
   ```

**Verify:** `npx tsc --noEmit` passes.

#### Step 2.4 — Create `src/lib/onyx/health-checker.ts`

```typescript
export async function checkOnyxHealth(): Promise<OnyxHealthStatus>
```

**Implementation:**

1. Record start time
2. Try `GET {baseUrl}/api/health` with a 5-second timeout (no retry — health checks should be fast)
   - Auth header: `Authorization: Bearer {apiKey}`
3. If healthy, try `POST {baseUrl}/api/manage/admin/connector/indexing-status` with 5-second timeout
   - Parse response for indexed document count and last successful index time
   - The response is an array of connector statuses. Iterate to find the one with `connector.source = "google_drive"`. Extract `doc_count` and `last_success` from the latest `index_attempt`.
4. Record end time, calculate `responseTimeMs`
5. Return `OnyxHealthStatus` object
6. On any error, return `{ healthy: false, indexedDocuments: null, lastIndexTime: null, responseTimeMs: -1 }`

**Verify:** `npx tsc --noEmit` passes.

#### Step 2.5 — Create `src/lib/onyx/index.ts` barrel export

```typescript
export { searchOnyx, searchOnyxSafe, searchOnyxMulti, getOnyxConfig } from './client';
export type { OnyxSearchFilters } from './client';
export { buildSearchQueries } from './query-builder';
export type { ArticleBrief } from './query-builder';
export { assembleOnyxContext } from './context-assembler';
export { checkOnyxHealth } from './health-checker';
```

**Verify:** `npx tsc --noEmit` passes.

---

### Phase 3: API Routes

#### Step 3.1 — Create `src/app/api/onyx/health/route.ts`

**Method:** GET
**Auth:** `requireRole("admin", "editor", "viewer")`
**Logic:** Call `checkOnyxHealth()`, return result
**Response:** `{ success: true, data: OnyxHealthStatus }`

Follow the exact error handling pattern from `src/app/api/content-map/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { checkOnyxHealth } from "@/lib/onyx";

export async function GET() {
  try {
    await requireRole("admin", "editor", "viewer");

    const health = await checkOnyxHealth();

    return NextResponse.json({ success: true, data: health });
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

**Verify:** `npx tsc --noEmit` passes.

#### Step 3.2 — Create `src/app/api/onyx/search/route.ts`

**Method:** POST
**Auth:** `requireRole("admin", "editor")`
**Validation:** Zod schema for request body:
```typescript
const SearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  filters: z.object({
    sourceType: z.array(z.string()).optional(),
  }).optional(),
});
```

**Logic:**
1. Parse and validate request body
2. Call `searchOnyx(query, filters)` — uses the throwing variant since this is an API endpoint that should surface errors
3. Return the `OnyxContext` result

**Error handling (in addition to standard auth cascade):**
```typescript
if (message === "ONYX_UNAVAILABLE") {
  return NextResponse.json(
    { success: false, error: { code: "ONYX_UNAVAILABLE", message: "Knowledge base unavailable" } },
    { status: 503 }
  );
}
```

**Verify:** `npx tsc --noEmit` passes.

---

### Phase 4: Integration Test

#### Step 4.1 — Create `scripts/test-guide-3.ts`

Follow the test script pattern from `scripts/test-guide-2.ts` but without Prisma (this is a stateless retrieval layer).

```typescript
// Run with: npx tsx scripts/test-guide-3.ts
```

**Test sections:**

1. **Onyx connectivity**
   - Import `getOnyxConfig` from `@/lib/onyx`
   - Verify `baseUrl` is non-empty and not `localhost`
   - Verify `apiKey` is non-empty

2. **Health check**
   - Import `checkOnyxHealth` from `@/lib/onyx`
   - Call it, verify `healthy === true`
   - Verify `indexedDocuments` is a positive number
   - Verify `responseTimeMs` is positive

3. **Admin search**
   - Import `searchOnyx` from `@/lib/onyx`
   - Search for `"Bajo vineyard elevation"`
   - Verify results array is non-empty
   - Verify first result has `documentId`, `content`, `sourceDocument`, and `score`
   - Verify `searchTimeMs` is positive

4. **Query builder**
   - Import `buildSearchQueries` from `@/lib/onyx`
   - Pass a sample brief: `{ title: "Bajo Vineyards", mainEntity: "Bajo vineyard", supportingEntities: ["Merlot", "terroir"], targetKeywords: ["Bhutan wine", "high altitude vineyard"] }`
   - Verify returns 3–5 queries
   - Verify no duplicates

5. **Context assembly**
   - Import `assembleOnyxContext` from `@/lib/onyx`
   - Import `searchOnyxMulti` from `@/lib/onyx`
   - Use `buildSearchQueries` to generate queries from the sample brief
   - Run `searchOnyxMulti` with those queries
   - Run `assembleOnyxContext` on the results
   - Verify output starts with `=== Knowledge Base Context ===`
   - Verify output length is ≤ 8000 characters
   - Verify output contains at least one `--- Source:` block

6. **API endpoints (if dev server running)**
   - `GET /api/onyx/health` — verify responds with 200 or 401
   - `POST /api/onyx/search` with `{ query: "Bajo vineyard" }` — verify responds with 200 or 401

**Summary format:**
```
=== Guide 3 Integration Tests ===
...
=== Results: X passed, Y failed ===
```

Exit code 1 if any test fails.

**IMPORTANT:** The test script must handle the `@/` path alias. Since `tsx` doesn't resolve Next.js path aliases by default, use relative imports from the scripts directory:
```typescript
import { searchOnyx, searchOnyxSafe, searchOnyxMulti, getOnyxConfig } from '../src/lib/onyx';
import { buildSearchQueries } from '../src/lib/onyx';
import { assembleOnyxContext } from '../src/lib/onyx';
import { checkOnyxHealth } from '../src/lib/onyx';
```

Alternatively, if the project already uses `tsconfig.json` path aliases with `tsx`, check how `scripts/test-guide-2.ts` handles imports. If it uses `@/` imports through Prisma's generated client, the test script for Guide 3 should match that pattern. If `@/` aliases don't resolve in tsx scripts, use relative paths.

**Verify:** `npx tsx scripts/test-guide-3.ts` passes (requires Onyx to be reachable and `.env.local` to have correct `ONYX_BASE_URL`).

---

### Phase 5: Validation Gates

#### Step 5.1 — Lint and Type Check

```bash
npx tsc --noEmit          # Zero type errors
npx next lint              # Zero lint errors
```

Fix any issues before proceeding.

#### Step 5.2 — Integration Test

```bash
npx tsx scripts/test-guide-3.ts
```

All tests must pass. If Onyx is unreachable, investigate — the test requires a live Onyx connection.

#### Step 5.3 — Documentation Sync

```bash
npx agent-guard sync
```

This auto-updates `docs/ARCHITECTURE.md` and regenerates `docs/_generated/api-routes.md` (new routes added).

#### Step 5.4 — Human Gate

Stop and tell the user:

> **Guide 3 complete. Please verify:**
> 1. Run `npm run dev`
> 2. Visit the health endpoint: `GET /api/onyx/health` — should return healthy status with indexed document count
> 3. Test the search endpoint: `POST /api/onyx/search` with body `{ "query": "Bajo vineyard elevation" }` — should return results with source attribution from Google Drive documents
> 4. Check that results contain actual BWC vineyard data (not generic responses)

---

## I. Gate Checks

### Gate 1: Lint & Type Check
```bash
npx tsc --noEmit          # Zero type errors
npx next lint              # Zero lint errors
```

### Gate 2: Integration Test
```bash
npx tsx scripts/test-guide-3.ts
```
Expected: All checks pass — health returns healthy, search returns results with source attribution, context assembly produces formatted output.

### Gate 3: Human Checkpoint
- `GET /api/onyx/health` returns `{ success: true, data: { healthy: true, indexedDocuments: 33, ... } }`
- `POST /api/onyx/search` with `{ "query": "Bajo vineyard elevation" }` returns results with BWC-specific vineyard data
- Search results include `sourceDocument` values that reference Google Drive documents

---

## J. Acceptance Criteria

1. **`src/lib/onyx/client.ts`** exports `searchOnyx`, `searchOnyxSafe`, `searchOnyxMulti`, and `getOnyxConfig`
2. **Retry logic** retries up to 3 times with exponential backoff (500ms, 1s, 2s) on timeout/connection/502/503/504 errors
3. **Timeout** is configurable via `ONYX_SEARCH_TIMEOUT_MS` env var, defaults to 10000ms
4. **`searchOnyxSafe`** returns `null` (not throws) when Onyx is unreachable
5. **`searchOnyxMulti`** runs queries in parallel and returns successful results (ignores failures)
6. **Query builder** generates 3–5 focused queries from an article brief
7. **Context assembler** produces a formatted string ≤ 8000 chars, deduplicates across queries, sorts by score
8. **Health endpoint** (`GET /api/onyx/health`) returns `OnyxHealthStatus` with indexed doc count
9. **Search endpoint** (`POST /api/onyx/search`) accepts `{ query, filters? }` and returns `OnyxContext`
10. **Both API routes** follow the exact error handling pattern from content-map routes
11. **Integration test** passes with all checks green
12. **Zero type errors** from `npx tsc --noEmit`
13. **Zero lint errors** from `npx next lint`

---

## K. Risks and Failure Modes

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Onyx droplet unresponsive (4GB RAM, cold start) | Medium | Search returns no results | 10s default timeout + 3 retries with backoff. Admin search has no cold-start issue (unlike chat endpoint). |
| Admin search returns empty results for valid queries | Low | Context assembly produces empty output | The "no content found" fallback message tells Claude to use general knowledge. Not a hard failure. |
| API key loses admin role | Low | 403 from admin search endpoint | Health checker reports unhealthy. Test script catches this. Fallback: could switch to chat-based retrieval (not implemented in this guide). |
| `.env.local` still has `localhost:8080` as ONYX_BASE_URL | High | All Onyx calls fail locally | Test script checks that baseUrl is not localhost. Fix `.env.local` before running tests. |
| Onyx response format changes in future versions | Low | Mapping breaks silently | Type-safe mapping with explicit field access. Health check verifies connectivity on every deploy. |
| Multiple queries produce duplicate chunks | Medium | Bloated context string | Deduplication by documentId + content hash in context assembler. |
| Context string exceeds prompt token budget | Low | Prompt too long for Claude | Hard cap at 8000 characters in context assembler. |
