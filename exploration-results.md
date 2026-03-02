# Exploration Results — Guide 5: Orchestration Layer + Claude API

**Generated:** 2026-03-02
**Target:** Guide 5 — the core generation engine
**Previous guides completed:** 1, 2, 3, 4

---

## 1. Current Build State

### Guides Completed
| Guide | Title | Status |
|---|---|---|
| 1 | Foundation — DB, Auth, Types, agent-guard | ✅ Complete |
| 2 | Content Map — CSV Import, CRUD API, Seed Data | ✅ Complete |
| 3 | Onyx RAG Integration | ✅ Complete |
| 4 | Canonical Article Schema + Article Renderer | ✅ Complete |

### Inventory Summary
| Category | Count | Details |
|---|---|---|
| Prisma models | 8 | User, ContentMap, ArticleDocument, ArticleHtml, InternalLink, Photo, ArticlePhoto, Lead, LeadEvent |
| API routes | 11 | health, auth, users (2), content-map (3), onyx (2), articles (2) |
| TypeScript type files | 10 | auth, article, renderer, qa, onyx, claude, photo, content-map, api, next-auth.d.ts |
| Library modules | 6 dirs | db, auth, env, content-map, onyx, article-schema, renderer |
| UI components | 0 | No components yet (Guide 6 scope) |
| Database rows | content_map: 39 (8 hubs, 31 spokes, all parentHubId wired), internal_links: 10 (core pages), users: 1, article_documents: 0, article_html: 0 |

### Build Health
- `npm run build`: ✅ **Passes with zero errors** — all 13 routes + pages compile
- All 11 API routes render as dynamic (ƒ) in the build output
- Static pages: `/`, `/_not-found`, `/login`

---

## 2. Next Guide Target

### Guide 5: Orchestration Layer + Claude API — ⚡ CRITICAL

**From orchestration doc §7 (line 770):**

> The core generation engine — the 7-layer system prompt assembly, Claude API streaming calls, structured output parsing, web search tool integration, and post-generation validation.

**Depends on:** Guides 1, 2, 3, 4 (all complete)

**Files to Create (from §5E):**
```
src/lib/prompt-assembly/        ← 7-layer system prompt builders
src/lib/orchestration/          ← Generation orchestrator, conversation manager, streaming parser
src/lib/claude/                 ← Full Anthropic SDK client (replaces current stub)
src/app/api/articles/generate/  ← POST: streaming generation endpoint
  route.ts
src/app/api/links/verify/       ← POST: batch link verification
  route.ts
scripts/test-guide-5.ts         ← Integration test
```

**None of these directories exist yet** — confirmed via filesystem check.

**Architecture doc references:**
- §3D: The Orchestration Layer (line 989) — full orchestration flow
- §3E: Generation Output (line 1097) — Canonical Article Document lifecycle
- §3J: Web Search Integration (line 1870) — web_search tool config
- 7-Layer System Prompt diagram (line 1000-1070)

---

## 3. Dependencies Satisfied

### 3A. TypeScript Types — All Present ✅

**`src/types/claude.ts`** — Already defines:
```typescript
interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface PromptLayer {
  name: string;
  content: string;
  tokenEstimate: number;
}

interface GenerationRequest {
  articleId: number;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  currentDocument: CanonicalArticleDocument | null;
}

interface GenerationResponse {
  document: CanonicalArticleDocument;
  conversationReply: string;
  tokensUsed: { input: number; output: number; };
  webSearchResults: WebSearchResult[];
}

interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
}
```

**`src/types/api.ts`** — Provides:
- `ApiSuccess<T>`, `ApiError`, `ApiResponse<T>` response wrappers
- `ErrorCode` union (includes `GENERATION_FAILED`, `ONYX_UNAVAILABLE`, `LINK_VERIFICATION_FAILED`)
- `ValidationResult` with `valid`, `errors[]`, `warnings[]`

**`src/types/article.ts`** — Complete `CanonicalArticleDocument` with all sub-types:
- `ArticleSection`, all 7 `ContentNode` variants, `ImagePlacement`, `InternalLinkRef`, `ExternalLinkRef`, `FAQItem`, `SchemaFlags`, `AuthorInfo`, `CaptureType`, `TrustTier`

**`src/types/onyx.ts`** — `OnyxSearchResult`, `OnyxContext`, `OnyxHealthStatus`

**`src/types/renderer.ts`** — `RendererInput`, `RendererOutput`, `HtmlOverride`

**`src/types/content-map.ts`** — `ContentMapEntry`, `InternalLinkEntry`, `ArticleType`, `ArticleStatus`

**`src/types/photo.ts`** — `Photo`, `PhotoManifest`, `CloudinaryTransform`

### 3B. Library Modules — All Dependencies Present ✅

**Onyx client (`src/lib/onyx/`)** — Guide 5 Layer 4 needs:
- `searchOnyxMulti(queries, filters)` → parallel multi-query with graceful fallback
- `buildSearchQueries(brief: ArticleBrief)` → generates 1-5 Onyx queries from article metadata
- `assembleOnyxContext(contexts: OnyxContext[])` → formats results into prompt-ready string (8000 char cap, dedup, score-ranked)
- All exported from `src/lib/onyx/index.ts`

**Article schema (`src/lib/article-schema/`)** — Guide 5 post-generation pipeline needs:
- `validateCanonicalDocument(doc: unknown)` → Zod + SOP checks → `ValidationResult`
- `repairCanonicalDocument(doc: unknown)` → auto-fix missing fields, dedup IDs, clamp heading levels → `{ repaired, changes, valid }`
- `CanonicalArticleDocumentSchema` → Zod schema for `safeParse`
- All exported from `src/lib/article-schema/index.ts`

**Renderer (`src/lib/renderer/`)** — Guide 5 calls after validation:
- `renderArticle(input: RendererInput)` → `RendererOutput` (pure function, no DB/API calls)
- Renderer internally calls `repairCanonicalDocument` before rendering
- Also exports: `buildCloudinaryUrl`, `buildSchemaJson`, `BWC_STYLESHEET`, `GOOGLE_FONTS_HTML`, `STYLE_BLOCK`, `TEMPLATE_VERSION`

**Database (`src/lib/db/`)** — Guide 5 needs for Layers 3 and 5:
- `prisma` singleton from `src/lib/db/index.ts`
- `retryDatabaseOperation()` from `src/lib/db/retry.ts`
- Prisma models: `contentMap`, `internalLink` for article brief + link graph queries

**Auth (`src/lib/auth/session.ts`)** — Guide 5 routes need:
- `requireRole("admin", "editor")` for POST endpoints

### 3C. Database Tables — All Present ✅

**`content_map`** — 39 rows (8 hubs + 31 spokes, 0 news), with `parentHubId` FK relationships verified correct
- Hub breakdown: Complete Guide to Bhutan Wine (6 spokes), Emerging Wine Regions (4), High-Altitude Viticulture (3), Sustainable Winemaking (4), Luxury Travel in Bhutan (5), Story of Wine in Bhutan (4), Wine Tourism Beyond Europe (2), Bhutan Exclusive Travel (3)
- All entries have status `"planned"`, slug populated
- Fields used by Guide 5 Layer 3 (Article Brief): `title`, `articleType`, `hubName`, `mainEntity`, `supportingEntities`, `targetKeywords`, `contentNotes`, `parentHubId`, `slug`, `publishedUrl`, `status`

**`internal_links`** — 10 rows (all `linkType = 'to-core-page'`)
- Core BWC pages: grapes-vineyards, our-wine, first-release, visit-us, about-us, in-the-news, gallery, inquiry, contact-us, 2023-first-barrel
- Guide 5 Layer 5 needs these + any published article URLs from content_map

**`article_documents`** — 0 rows (empty, will be written by Guide 11)

**`article_html`** — 0 rows (empty, will be written by Guide 11)

### 3D. Environment Variables ✅

All Guide 5 env vars present in `.env.example`:
- `ANTHROPIC_API_KEY=sk-ant-...`
- `ANTHROPIC_MODEL=claude-sonnet-4-5-20250929`
- `ANTHROPIC_SMALL_MODEL=claude-sonnet-4-5-20250929`
- `ANTHROPIC_MAX_OUTPUT_TOKENS=16384`
- `ENABLE_WEB_SEARCH=true`
- Onyx vars: `ONYX_BASE_URL`, `ONYX_API_URL`, `ONYX_API_KEY`, `ONYX_INDEX_NAME`, `ONYX_SEARCH_TIMEOUT_MS`

### 3E. Static Prompt Documents ✅

Layer 1 and 2a source documents exist:
- `docs/BWC Master Content Engine SOP.md` — 48,402 bytes (Layer 1)
- `docs/Bhutan Wine Company — Brand Style Guide for HTML Blog Posts (3).md` — 29,486 bytes (Layer 2a)
- Compiled Template reference available via `src/lib/renderer/compiled-template.ts` (Layer 2b)

---

## 4. Dependencies Missing or Need Extending

### 4A. Types That Need Extension

**`src/types/claude.ts`** — Current types are close but need additions for:

1. **`GenerateArticleRequest` vs `GenerationRequest`**: The orchestration doc §5B calls it `GenerateArticleRequest` with `photoManifest: PhotoManifest | null` field. The current `GenerationRequest` is missing `photoManifest`. Guide 5 should extend or rename.

2. **Streaming types**: No streaming-specific types exist yet. Guide 5 needs:
   - `StreamingGenerationEvent` — discriminated union for SSE events (e.g., `{type: "chunk", data: ...}`, `{type: "section_complete", ...}`, `{type: "done", document: ...}`, `{type: "error", ...}`)
   - Or a simpler approach that streams the JSON chunks directly

3. **`GenerationResponse`** — Current type includes `html: string` in the orchestration doc's `GenerateArticleResponse` (§5B line 369-373) but the actual `GenerationResponse` in `claude.ts` does NOT include `html`. The orchestration doc shows:
   ```typescript
   interface GenerateArticleResponse {
     document: CanonicalArticleDocument;
     html: string;
     validationResult: ValidationResult;
     conversationReply: string;
   }
   ```
   Current `GenerationResponse` has `tokensUsed` and `webSearchResults` instead.

   **Decision needed:** Should the API return `html` (run renderer server-side) or let the client call `/api/articles/render` separately? The architecture doc suggests the orchestration layer renders server-side.

### 4B. Modules That Don't Exist Yet

All Guide 5 directories are **completely absent**:
- `src/lib/prompt-assembly/` — needs: layer builders for all 7 layers, main assembler
- `src/lib/orchestration/` — needs: orchestrator, conversation manager, streaming JSON parser
- `src/lib/claude/` — needs: full Anthropic SDK client replacing the 4-line stub
- `src/app/api/articles/generate/route.ts` — needs: POST streaming endpoint
- `src/app/api/links/verify/route.ts` — needs: POST batch link verification

### 4C. The Claude Client Stub

**Current state** (`src/lib/claude/client.ts`):
```typescript
export const claudeConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
};
```

This is a **4-line config object**. Guide 5 must replace it with a full Anthropic SDK integration:
- `@anthropic-ai/sdk` package installation
- Streaming message creation
- `web_search` tool configuration
- Structured JSON output parsing
- Token usage tracking
- Error handling with retries

### 4D. Missing `env.ts` Entries

`src/lib/env.ts` does NOT expose:
- `ANTHROPIC_SMALL_MODEL`
- `ANTHROPIC_MAX_OUTPUT_TOKENS`
- `ENABLE_WEB_SEARCH`

Guide 5 needs to extend `env.ts` to include these.

---

## 5. Established Patterns to Follow

### 5A. API Route Handler Pattern

**Canonical example** — `src/app/api/onyx/search/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { searchOnyx } from "@/lib/onyx";
import { z } from "zod";

const SearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  filters: z.object({ sourceType: z.array(z.string()).optional() }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const parsed = SearchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    const result = await searchOnyx(parsed.data.query, ...);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // Error code matching chain:
    if (message === "AUTH_REQUIRED") → 401
    if (message === "AUTH_FORBIDDEN") → 403
    if (message === "ONYX_UNAVAILABLE") → 503
    // fallback:
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
```

**Pattern rules:**
1. Imports: `NextRequest`, `NextResponse`, `requireRole`, service module, `z`
2. Zod schema defined at module level (not inline)
3. Auth check first: `await requireRole("admin", "editor")`
4. Parse body → `safeParse` → return 400 on failure
5. Call service → return `{ success: true, data }`
6. Catch block: string-match `error.message` against known error codes
7. Response format: `{ success: true/false, data/error: { code, message } }`

### 5B. Error Handling Pattern

Errors are thrown as plain `Error` objects with the error code as the message:
```typescript
throw new Error("ONYX_UNAVAILABLE");
throw new Error("AUTH_REQUIRED");
throw new Error("RENDER_ERROR");
```

Route handlers catch and match with `if (message === "CODE")`.

Error codes from `src/types/api.ts`:
`AUTH_REQUIRED`, `AUTH_FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `GENERATION_FAILED`, `ONYX_UNAVAILABLE`, `RENDER_ERROR`, `QA_GATE_FAILED`, `CLOUDINARY_ERROR`, `LINK_VERIFICATION_FAILED`, `INTERNAL_ERROR`

### 5C. External Service Call Pattern

**Canonical example** — `src/lib/onyx/client.ts`:
- `fetchWithRetry(url, options, timeoutMs)` — AbortController timeout + exponential backoff
- Constants: `MAX_RETRIES = 3`, `BASE_DELAY_MS = 500`
- Retryable: connection errors + 502/503/504
- Non-retryable: 400/401/403/404
- Response mapping function: snake_case → camelCase
- Safe variant: `searchOnyxSafe()` → returns null on failure
- Multi variant: `searchOnyxMulti()` → Promise.allSettled for parallel queries

### 5D. Zod Validation Pattern

**Schema validation** — `src/lib/article-schema/validate.ts`:
```typescript
const parsed = CanonicalArticleDocumentSchema.safeParse(doc);
if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    errors.push({ path: issue.path.join("."), message: issue.message });
  }
  return { valid: false, errors, warnings };
}
```

**Request validation** (routes): `parsed.error.flatten()` for details.

### 5E. Module Export Structure

All `src/lib/*/` modules use barrel exports via `index.ts`:
```typescript
// src/lib/onyx/index.ts
export { searchOnyx, searchOnyxSafe, searchOnyxMulti, getOnyxConfig } from './client';
export type { OnyxSearchFilters } from './client';
export { buildSearchQueries } from './query-builder';
export type { ArticleBrief } from './query-builder';
export { assembleOnyxContext } from './context-assembler';
export { checkOnyxHealth } from './health-checker';
```

File naming: kebab-case. Function exports: named (no default exports).

### 5F. Database Query Pattern

Direct Prisma calls in routes (no abstraction layer):
```typescript
const entries = await prisma.contentMap.findMany({
  select: contentMapSelect,
  orderBy: { createdAt: "desc" },
});
```

`retryDatabaseOperation()` available in `src/lib/db/retry.ts` for cold-start resilience.

### 5G. Import Conventions

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { searchOnyx } from "@/lib/onyx";
import { renderArticle } from "@/lib/renderer";
import { validateCanonicalDocument, repairCanonicalDocument } from "@/lib/article-schema";
import type { CanonicalArticleDocument } from "@/types/article";
import type { ValidationResult } from "@/types/api";
import { z } from "zod";
```

- `@/` path alias for all internal imports
- `type` keyword for type-only imports
- Third-party imports last

### 5H. Streaming Pattern — NONE EXISTS YET

**No existing route uses streaming.** Guide 5 will introduce the first streaming endpoint. The pattern must be established here. Based on the architecture doc, the approach is:
- Server-Sent Events (SSE) or `ReadableStream` from the Next.js route
- Claude SDK streams the response
- Orchestration layer parses partial JSON as it arrives
- Incremental chunks sent to the client

---

## 6. Integration Readiness

| Service | Status | Notes |
|---|---|---|
| **Neon Postgres** | ✅ Verified LIVE | 39 content_map rows (8 hubs, 31 spokes, all parentHubId wired), 10 internal_links, 1 user. All 9 schema models present. |
| **Onyx CE** | ✅ Verified LIVE | Health: HTTP 200 in 105ms. **33 documents indexed**, last index: 2026-03-02T13:24Z. Search: HTTP 200 in 90-468ms for "Bajo vineyard" — returns documents with relevance scores (top: 0.953), source attribution (`google_drive`), match highlights ("Bajo vineyard is completely flat, at around 4,000 feet in elevation"). Correct endpoint: `/api/admin/search`. |
| **Claude API** | ✅ Verified LIVE | Basic completion: HTTP 200 in 1.67s, model `claude-sonnet-4-5-20250929` confirmed accessible. Streaming: SSE events firing correctly (`message_start`, `content_block_start`, `content_block_delta`). Web search tool: working, returned bhutanwine.com URL from test search. `@anthropic-ai/sdk` still needs to be installed as a package dependency. |
| **Cloudinary** | ✅ Verified LIVE | API credentials valid. CDN delivery with transforms (`w_800,f_auto,q_auto`): HTTP 200 in 146ms. Guide 5 doesn't upload images but renderer uses `buildCloudinaryUrl()`. |
| **Vercel Deployment** | ✅ Verified LIVE | `bwc-content-engine.vercel.app/api/health` → HTTP 200 in 293-378ms. |

### Known Quirks

1. **Onyx response time**: 4GB DigitalOcean droplet — search takes ~150-470ms. Client has 10s timeout + 3 retries with backoff. Note: `/api/direct-qa` returns 404 — correct endpoint per client.ts is `/api/admin/search`.
2. **Claude streaming format**: Confirmed working via live test. SSE events: `message_start` → `content_block_start` → `content_block_delta` (repeated) → `content_block_stop` → `message_stop`. Guide 5 must parse these into partial JSON.
3. **web_search tool**: Confirmed working in live test — returned real URLs. Architecture doc specifies `type: "web_search_20250305"`. Use latest SDK tool type.
4. **ANTHROPIC_MAX_OUTPUT_TOKENS**: `.env.example` documents `16384`. A full hub article CanonicalArticleDocument (2500+ words) in JSON will be ~20K-30K characters, which fits within this limit.
5. **Model ID format**: `.env` may have `claude-sonnet-4-5` (no date suffix) while API tests used `claude-sonnet-4-5-20250929`. Verify the generation pipeline resolves the correct model ID.

---

## 7. Risks and Blockers

### BLOCKER: .env ANTHROPIC_MAX_OUTPUT_TOKENS Mismatch ❌

**CRITICAL:** `.env` has `ANTHROPIC_MAX_OUTPUT_TOKENS="4096"` but `.env.example` documents `16384`. Hub articles (2500+ words as structured JSON) will exceed 4096 output tokens. **Must update `.env` to `16384` before Guide 5 generation runs.**

### Risk 1: Streaming JSON Parsing Complexity ⚠️

Claude will stream a CanonicalArticleDocument as JSON text. Partial JSON is inherently invalid until complete. Options:
- **Option A**: Stream the full response, parse JSON only when complete. Simple but no live preview.
- **Option B**: Use a streaming JSON parser (e.g., `partial-json` or custom) to extract sections as they complete. Complex but enables incremental rendering.
- **Option C**: Instruct Claude to output sections delimited by markers, parse each section individually. Middle ground.

**Recommendation**: Start with Option A for Guide 5 (get the pipeline working), then optimize for streaming preview in Guide 6 when the UI exists.

### Risk 2: Token Budget for 7-Layer System Prompt ⚠️

Layer sizes (estimated):
- Layer 1 (SOP): ~48KB → ~12,000 tokens
- Layer 2a (Brand Style Guide): ~29KB → ~7,000 tokens
- Layer 2b (Compiled Template reference): ~5KB → ~1,200 tokens
- Layer 3 (Article Brief): ~500 bytes → ~125 tokens
- Layer 4 (KB Context): ~8KB cap → ~2,000 tokens
- Layer 5 (Link Graph): ~2KB → ~500 tokens
- Layer 6 (Photo Manifest): ~1KB → ~250 tokens
- **Total system prompt: ~23,000 tokens**

With `claude-sonnet-4-5` (200K context), this leaves ~160K for conversation history + output. Manageable but Layer 1 and 2a are large. Consider whether the full SOP text is needed every call or if a condensed version suffices.

### Risk 3: web_search Tool Type Version

Architecture doc references `web_search_20250305`. The Anthropic API may have updated this tool type. Guide 5 should use the latest SDK's tool type and verify it works.

### Risk 4: No Streaming Pattern Precedent

Guide 5 establishes the streaming pattern for the entire project. Guide 6 (UI) will consume this stream. The SSE format and event types chosen here will be locked in. Must design carefully.

### Risk 5: Middleware Deprecation Warning (Non-blocking)

Next.js 16.1.6 shows: `middleware` file convention deprecated — rename to `proxy` before Guide 6. Non-blocking for Guide 5 but will become an error in future Next.js versions.

### Risk 6: Prisma Config Deprecation (Non-blocking)

Prisma `package.json#prisma` config is deprecated — should migrate to `prisma.config.ts` before Prisma 7. Non-blocking for Guide 5.

---

## 8. Deviations from Plan

### 8A. Type Naming Discrepancy

Orchestration doc §5B calls them:
- `GenerateArticleRequest` (with `photoManifest` field)
- `GenerateArticleResponse` (with `html` and `validationResult` fields)

Actual types in `src/types/claude.ts`:
- `GenerationRequest` (no `photoManifest`)
- `GenerationResponse` (has `tokensUsed` and `webSearchResults` instead of `html` and `validationResult`)

**Resolution**: Guide 5 should extend the existing types to match the orchestration doc's contract, or define route-specific request/response types that bridge the gap.

### 8B. `env.ts` Incomplete

`src/lib/env.ts` doesn't expose `ANTHROPIC_SMALL_MODEL`, `ANTHROPIC_MAX_OUTPUT_TOKENS`, or `ENABLE_WEB_SEARCH`. Guide 5 must extend this file.

### 8C. Claude Client Is a Stub

The orchestration doc assumes `src/lib/claude/client.ts` has a working SDK client. In reality it's a 4-line config object. Guide 5 must build the full client from scratch, installing `@anthropic-ai/sdk`.

### 8D. Internal Links Table — Limited Data

The `internal_links` table has only 10 rows (core pages). No article-to-article links exist yet because no articles have been published. Guide 5's Layer 5 link graph builder must handle:
1. Core page links (from `internal_links` where `linkType = 'to-core-page'`)
2. Published article links (from `content_map` where `status = 'published'` and `publishedUrl IS NOT NULL`)
3. Hub-spoke relationships (from `content_map` parent/child relations)

Currently #2 will return 0 results (no published articles), which is correct.

---

## Appendix A: Complete File Inventory for Guide 5

### Files to CREATE:
```
src/lib/prompt-assembly/
  index.ts              ← barrel exports
  layer-sop.ts          ← Layer 1: Load SOP document
  layer-style-guide.ts  ← Layer 2a: Load Brand Style Guide
  layer-template.ts     ← Layer 2b: Compiled Template component reference
  layer-brief.ts        ← Layer 3: Article Brief from content_map
  layer-kb-context.ts   ← Layer 4: Onyx KB context
  layer-link-graph.ts   ← Layer 5: Internal link graph from DB
  layer-photo-manifest.ts ← Layer 6: Photo manifest
  assembler.ts          ← Combine all layers into system prompt

src/lib/orchestration/
  index.ts              ← barrel exports
  orchestrator.ts       ← Main generation orchestrator
  conversation.ts       ← Conversation history manager
  streaming-parser.ts   ← Parse streaming JSON from Claude
  post-processing.ts    ← Validation + repair + link check pipeline

src/lib/claude/
  client.ts             ← REPLACE stub with full Anthropic SDK client
  streaming.ts          ← Streaming response handler
  tools.ts              ← web_search tool configuration
  index.ts              ← barrel exports

src/app/api/articles/generate/
  route.ts              ← POST: streaming generation endpoint

src/app/api/links/verify/
  route.ts              ← POST: batch link verification

scripts/test-guide-5.ts ← Integration test
```

### Files to MODIFY:
```
src/lib/env.ts          ← Add ANTHROPIC_SMALL_MODEL, ANTHROPIC_MAX_OUTPUT_TOKENS, ENABLE_WEB_SEARCH
src/types/claude.ts     ← Extend GenerationRequest/Response, add streaming event types
.env.example            ← Verify all Guide 5 vars are documented
package.json            ← Add @anthropic-ai/sdk dependency
```

### Files to READ (not modify):
```
docs/BWC Master Content Engine SOP.md                           ← Layer 1 content
docs/Bhutan Wine Company — Brand Style Guide for HTML Blog Posts (3).md  ← Layer 2a content
src/lib/renderer/compiled-template.ts                           ← Layer 2b reference
src/lib/onyx/                                                   ← Layer 4 integration
src/lib/article-schema/                                         ← Post-generation validation
src/lib/renderer/                                               ← Post-validation rendering
prisma/schema.prisma                                            ← Layer 3 & 5 DB queries
```
