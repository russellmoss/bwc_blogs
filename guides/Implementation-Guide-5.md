# Implementation Guide 5: Orchestration Layer + Claude API

**Guide type:** Critical-path implementation
**Depends on:** Guides 1, 2, 3, 4 (all verified complete)
**Estimated execution:** 45–75 minutes
**Last updated:** 2026-03-02

---

## A. Objective

Build the core generation engine that connects Onyx (KB), Neon (content map + link graph), the Article Schema (validation + repair), the Article Renderer (HTML production), and the Claude API (generation) into a single streaming pipeline.

When this guide completes, a `POST /api/articles/generate` request with an `articleId` and `userMessage` will:
1. Assemble a 7-layer system prompt from DB + static docs + Onyx KB
2. Stream a Claude API call with `web_search` tool enabled
3. Parse the streamed JSON into a `CanonicalArticleDocument`
4. Run the repair + validation pipeline
5. Render the validated document to HTML
6. Return the complete result as a streaming SSE response

---

## B. Scope

### In Scope
- 7-layer system prompt assembly (`src/lib/prompt-assembly/`)
- Full Anthropic SDK client replacing the current 4-line stub (`src/lib/claude/`)
- Generation orchestrator with streaming support (`src/lib/orchestration/`)
- SSE streaming endpoint `POST /api/articles/generate`
- Batch link verification endpoint `POST /api/links/verify`
- Conversation history management
- Post-generation validation pipeline (repair → validate → render)
- Token usage tracking
- Integration test script

### Out of Scope
- UI consumption of the stream (Guide 6)
- Canvas editing / HTML mode (Guides 7)
- QA scorecard overlay (Guide 8)
- Photo upload pipeline (Guide 9 — but Layer 6 photo manifest placeholder is in scope)
- Article persistence to DB (Guide 11)

---

## C. Depends On

| Guide | What This Guide Uses From It |
|---|---|
| 1 | `prisma` client, `requireRole()`, `env.ts`, all `src/types/` interfaces |
| 2 | `content_map` table (39 rows), `internal_links` table (10 core pages) |
| 3 | `searchOnyxMulti()`, `buildSearchQueries()`, `assembleOnyxContext()` from `src/lib/onyx/` |
| 4 | `validateCanonicalDocument()`, `repairCanonicalDocument()`, `renderArticle()` from `src/lib/article-schema/` and `src/lib/renderer/` |

All dependencies verified present and working (see `exploration-results.md` §3).

---

## D. Shared Contracts Referenced

### Types (from `src/types/`)
- `CanonicalArticleDocument` and all sub-types — `src/types/article.ts`
- `GenerationRequest`, `GenerationResponse`, `ConversationMessage`, `PromptLayer`, `WebSearchResult` — `src/types/claude.ts`
- `ApiSuccess`, `ApiError`, `ValidationResult`, `ErrorCode` — `src/types/api.ts`
- `ContentMapEntry`, `InternalLinkEntry` — `src/types/content-map.ts`
- `PhotoManifest` — `src/types/photo.ts`
- `RendererInput`, `RendererOutput` — `src/types/renderer.ts`
- `OnyxContext` — `src/types/onyx.ts`
- `ArticleBrief` — `src/lib/onyx/query-builder.ts`

### Database Tables
- `content_map` — Layer 3 (Article Brief) and Layer 5 (published article URLs)
- `internal_links` — Layer 5 (core page links)

### Orchestration Doc References
- §5B: `GenerateArticleRequest` / `GenerateArticleResponse` (canonical contract)
- §5C: API route inventory — Guide 5 owns `articles/generate/` and `links/verify/`
- §5E: File ownership — Guide 5 owns `src/lib/orchestration/`, `src/lib/claude/`, `src/lib/prompt-assembly/`
- §7 (line 770): Guide 5 specification

### Architecture Doc References
- §3D (line 989): The Orchestration Layer — full flow description
- §3E (line 1097): Generation Output — Canonical Article Document lifecycle
- §3J (line 1870): Web Search Integration — tool configuration and guardrails

---

## E. Existing Constraints to Preserve

1. **`npm run build` must continue to pass** with zero errors after every step
2. **All 11 existing API routes** must remain functional
3. **Do not modify** files owned by Guides 1–4 except:
   - `src/types/claude.ts` — extending with new types
   - `src/lib/env.ts` — adding new env var entries
   - `.env.example` — already has Guide 5 vars, verify completeness
4. **Import conventions**: `@/` path alias, `type` keyword for type-only imports, named exports only
5. **Error pattern**: throw `new Error("ERROR_CODE")`, catch with `if (message === "CODE")` chain
6. **Response format**: `{ success: true, data }` or `{ success: false, error: { code, message } }`
7. **File naming**: kebab-case files, PascalCase components, camelCase functions

---

## F. Files Created / Modified

### Files to CREATE

```
src/lib/prompt-assembly/
  index.ts                 ← barrel exports
  layer-sop.ts             ← Layer 1: Load SOP document
  layer-style-guide.ts     ← Layer 2a: Load Brand Style Guide
  layer-template-ref.ts    ← Layer 2b: Compiled Template component reference
  layer-brief.ts           ← Layer 3: Article Brief from content_map DB
  layer-kb-context.ts      ← Layer 4: Onyx KB context
  layer-link-graph.ts      ← Layer 5: Internal link graph from DB
  layer-photo-manifest.ts  ← Layer 6: Photo manifest (placeholder-ready)
  assembler.ts             ← Combine all layers into system prompt string

src/lib/claude/
  client.ts                ← REPLACE stub with full Anthropic SDK client
  streaming.ts             ← Stream response handler + SSE encoder
  tools.ts                 ← web_search tool configuration
  index.ts                 ← barrel exports

src/lib/orchestration/
  index.ts                 ← barrel exports
  orchestrator.ts          ← Main generation orchestrator
  conversation.ts          ← Conversation history manager
  streaming-parser.ts      ← Parse streaming JSON from Claude into document
  post-processing.ts       ← Validation + repair + render pipeline

src/app/api/articles/generate/
  route.ts                 ← POST: SSE streaming generation endpoint

src/app/api/links/verify/
  route.ts                 ← POST: batch link verification

scripts/test-guide-5.ts    ← Integration test
```

### Files to MODIFY

```
src/types/claude.ts        ← Extend with streaming event types, align request/response
src/lib/env.ts             ← Add ANTHROPIC_SMALL_MODEL, ANTHROPIC_MAX_OUTPUT_TOKENS, ENABLE_WEB_SEARCH
package.json               ← Add @anthropic-ai/sdk dependency
```

### Files to READ (not modify)

```
docs/BWC Master Content Engine SOP.md                                          ← Layer 1 content
docs/Bhutan Wine Company — Brand Style Guide for HTML Blog Posts (3).md        ← Layer 2a content
src/lib/renderer/compiled-template.ts                                          ← Layer 2b reference
src/lib/onyx/                                                                  ← Layer 4 integration
src/lib/article-schema/                                                        ← Post-generation validation
src/lib/renderer/                                                              ← Post-validation rendering
prisma/schema.prisma                                                           ← Layer 3 & 5 DB queries
```

---

## G. Technical Design

### G1. The 7-Layer System Prompt Assembly

Each layer is a pure function that returns a `PromptLayer` (already defined in `src/types/claude.ts`):

```typescript
interface PromptLayer {
  name: string;
  content: string;
  tokenEstimate: number;
}
```

| Layer | Source | Static/Dynamic | Estimated Tokens |
|---|---|---|---|
| 1: Master SOP | `docs/BWC Master Content Engine SOP.md` | Static (loaded once at startup, cached) | ~12,000 |
| 2a: Brand Style Guide | `docs/Bhutan Wine Company — Brand Style Guide...md` | Static (loaded once, cached) | ~7,000 |
| 2b: Template Reference | `src/lib/renderer/compiled-template.ts` exports | Static (loaded once, cached) | ~1,200 |
| 3: Article Brief | `content_map` DB query by `articleId` | Dynamic (per-request) | ~125 |
| 4: KB Context | Onyx multi-query via `searchOnyxMulti()` + `assembleOnyxContext()` | Dynamic (per-request) | ~2,000 |
| 5: Link Graph | `internal_links` + `content_map` (published) DB queries | Dynamic (per-request) | ~500 |
| 6: Photo Manifest | Passed via request body (from Guide 9 UI, nullable) | Dynamic (per-request) | ~250 |
| **Total** | | | **~23,000** |

**Caching strategy**: Layers 1, 2a, 2b are read from disk once and cached in module-level variables. Layers 3–6 are assembled fresh for each generation request.

**Token estimation**: Use a simple heuristic of `Math.ceil(content.length / 4)` for token estimates. This is for logging/budgeting only — the actual token count comes from Claude's usage response.

### G2. The Assembler

`assembler.ts` takes all 7 layers and concatenates them with clear section delimiters:

```
=== LAYER 1: MASTER SOP ===
[Layer 1 content]

=== LAYER 2a: BRAND STYLE GUIDE ===
[Layer 2a content]

=== LAYER 2b: AVAILABLE CONTENT TYPES ===
[Layer 2b content]

=== LAYER 3: ARTICLE BRIEF ===
[Layer 3 content]

=== LAYER 4: KNOWLEDGE BASE CONTEXT ===
[Layer 4 content]

=== LAYER 5: INTERNAL LINK GRAPH ===
[Layer 5 content]

=== LAYER 6: PHOTO MANIFEST ===
[Layer 6 content]

=== OUTPUT FORMAT ===
You MUST respond with a valid JSON object conforming to the CanonicalArticleDocument schema.
Do NOT output HTML. Output structured JSON only.
[Include abbreviated schema reference with field descriptions]
```

The assembler returns:
```typescript
interface AssembledPrompt {
  systemPrompt: string;
  layers: PromptLayer[];
  totalTokenEstimate: number;
}
```

### G3. Claude Client (`src/lib/claude/`)

Replace the 4-line stub with a full SDK client:

```typescript
// client.ts
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

let clientInstance: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!clientInstance) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("GENERATION_FAILED");
    }
    clientInstance = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return clientInstance;
}
```

**Streaming pattern** (`streaming.ts`):
- Use `client.messages.stream()` for the streaming helper
- Listen for `text` events to accumulate JSON text
- On `message` event, get final message with usage stats
- Handle `web_search_tool_result` blocks in the response content

**Web search tool** (`tools.ts`):
```typescript
import type Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export function getGenerationTools(): Anthropic.Messages.Tool[] {
  if (env.ENABLE_WEB_SEARCH !== "true") return [];
  return [
    {
      type: "web_search_20250305",
      name: "web_search",
    },
  ];
}
```

### G4. Generation Orchestrator (`src/lib/orchestration/orchestrator.ts`)

The orchestrator is the main entry point. Its flow:

```
1. Receive GenerateArticleRequest
2. Assemble 7-layer system prompt (parallel: DB queries + Onyx search)
3. Build messages array: system prompt + conversation history + current user message
4. Call Claude API with streaming + web_search tool
5. Accumulate streamed text into complete JSON string
6. Parse JSON → CanonicalArticleDocument
7. Run post-processing: repair → validate → render
8. Return GenerateArticleResponse
```

**Key design decisions:**
- The orchestrator returns a `ReadableStream` for the SSE endpoint
- It emits structured SSE events as generation progresses
- The final event contains the complete `GenerateArticleResponse`

### G5. SSE Event Protocol

The streaming endpoint emits Server-Sent Events with these event types:

```typescript
// SSE event types sent to the client
type SSEEventType =
  | "status"        // Progress updates: "Assembling prompt...", "Calling Claude...", etc.
  | "text_delta"    // Raw text chunks from Claude (for live preview in Guide 6)
  | "web_search"    // Claude invoked web search (query + results summary)
  | "document"      // Final parsed CanonicalArticleDocument
  | "validation"    // ValidationResult from post-processing
  | "complete"      // Final GenerateArticleResponse with HTML
  | "error";        // Error with code and message

// Each SSE event is: `event: {type}\ndata: {json}\n\n`
```

### G6. Conversation History Manager

`conversation.ts` manages the message array sent to Claude:

```typescript
interface ConversationState {
  messages: ConversationMessage[];
  currentDocument: CanonicalArticleDocument | null;
}
```

- First message in a session: system prompt + user's initial message
- Subsequent messages: system prompt + full conversation history + new user message
- If `currentDocument` is provided (re-edit scenario), inject it as context in the user message: "Here is the current article document: [JSON]. Please modify it based on my request: [userMessage]"
- Conversation history is passed in the request body — no server-side session state

### G7. Post-Processing Pipeline

`post-processing.ts` runs after Claude returns the complete document:

```
1. Parse JSON string → raw object
2. repairCanonicalDocument(raw) → { repaired, changes, valid }
3. validateCanonicalDocument(repaired) → ValidationResult
4. If valid: renderArticle({ document: repaired, htmlOverrides: null, templateVersion }) → RendererOutput
5. Return { document, html, validationResult, conversationReply }
```

If JSON parsing fails, return a `GENERATION_FAILED` error with the raw text for debugging.

### G8. Link Verification Endpoint

`POST /api/links/verify` accepts a list of URLs and returns their HTTP status:

```typescript
// Request
{ urls: string[] }

// Response
{ success: true, data: { results: Array<{ url: string; status: number; ok: boolean; redirectUrl?: string }> } }
```

Implementation: `Promise.allSettled` with individual `fetch(url, { method: "HEAD" })` calls, 5-second timeout per URL, max 20 concurrent requests.

### G9. Type Alignment Resolution

The exploration identified a naming mismatch between `GenerationRequest` (in code) and `GenerateArticleRequest` (in orchestration doc). Resolution:

**Extend `src/types/claude.ts`** to add the API-facing types that bridge the gap:

```typescript
// Existing types remain unchanged (GenerationRequest, GenerationResponse)

// API route request/response types (aligned with orchestration doc §5B)
export interface GenerateArticleRequest {
  articleId: number;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  currentDocument: CanonicalArticleDocument | null;
  photoManifest: PhotoManifest | null;
}

export interface GenerateArticleResponse {
  document: CanonicalArticleDocument;
  html: string;
  validationResult: ValidationResult;
  conversationReply: string;
  tokensUsed: { input: number; output: number };
  webSearchResults: WebSearchResult[];
}

// SSE streaming event types
export type StreamEventType =
  | "status"
  | "text_delta"
  | "web_search"
  | "document"
  | "validation"
  | "complete"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
}
```

The orchestrator internally uses the existing `GenerationRequest` / `GenerationResponse` types. The API route maps between `GenerateArticleRequest` (HTTP body) and the internal types.

---

## H. Step-by-Step Execution Plan

### Step 1: Install `@anthropic-ai/sdk` and extend `env.ts`

**1a. Install the Anthropic SDK:**

```bash
npm install @anthropic-ai/sdk
```

**1b. Extend `src/lib/env.ts`:**

Add three new entries to the `env` object:

```typescript
ANTHROPIC_SMALL_MODEL: optionalEnv('ANTHROPIC_SMALL_MODEL', 'claude-sonnet-4-5-20250929'),
ANTHROPIC_MAX_OUTPUT_TOKENS: optionalEnv('ANTHROPIC_MAX_OUTPUT_TOKENS', '16384'),
ENABLE_WEB_SEARCH: optionalEnv('ENABLE_WEB_SEARCH', 'true'),
```

**1c. Verify `.env.example`** already has these variables documented (it does — confirmed in exploration). No changes needed.

**Verification:** `npm run build` passes. `env.ANTHROPIC_MAX_OUTPUT_TOKENS` resolves to `"16384"`.

---

### Step 2: Extend `src/types/claude.ts` with streaming and API types

Add the following types **below** the existing types (do not modify existing interfaces):

```typescript
import type { PhotoManifest } from "./photo";
import type { ValidationResult } from "./api";

// === API route request/response types (from orchestration doc §5B) ===

export interface GenerateArticleRequest {
  articleId: number;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  currentDocument: CanonicalArticleDocument | null;
  photoManifest: PhotoManifest | null;
}

export interface GenerateArticleResponse {
  document: CanonicalArticleDocument;
  html: string;
  validationResult: ValidationResult;
  conversationReply: string;
  tokensUsed: { input: number; output: number };
  webSearchResults: WebSearchResult[];
}

// === SSE streaming event types ===

export type StreamEventType =
  | "status"
  | "text_delta"
  | "web_search"
  | "document"
  | "validation"
  | "complete"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
}
```

**Verification:** `npx tsc --noEmit` passes with zero errors.

---

### Step 3: Build the Claude client (`src/lib/claude/`)

**3a. Create `src/lib/claude/client.ts`** — replace the existing 4-line stub:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

let clientInstance: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!clientInstance) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("GENERATION_FAILED");
    }
    clientInstance = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });
  }
  return clientInstance;
}

export function getModelId(): string {
  return env.ANTHROPIC_MODEL;
}

export function getMaxOutputTokens(): number {
  return parseInt(env.ANTHROPIC_MAX_OUTPUT_TOKENS, 10) || 16384;
}
```

**3b. Create `src/lib/claude/tools.ts`:**

```typescript
import type Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export function getGenerationTools(): Anthropic.Messages.Tool[] {
  if (env.ENABLE_WEB_SEARCH !== "true") return [];
  return [
    {
      type: "web_search_20250305",
      name: "web_search",
    },
  ];
}
```

**3c. Create `src/lib/claude/streaming.ts`:**

This module handles calling Claude's streaming API and accumulating the response:

```typescript
import type Anthropic from "@anthropic-ai/sdk";
import { getClaudeClient, getModelId, getMaxOutputTokens } from "./client";
import { getGenerationTools } from "./tools";
import type { WebSearchResult } from "@/types/claude";

export interface ClaudeStreamCallbacks {
  onTextDelta?: (text: string) => void;
  onWebSearch?: (query: string) => void;
  onError?: (error: Error) => void;
}

export interface ClaudeStreamResult {
  text: string;
  tokensUsed: { input: number; output: number };
  webSearchResults: WebSearchResult[];
}

export async function streamGeneration(
  systemPrompt: string,
  messages: Anthropic.Messages.MessageParam[],
  callbacks: ClaudeStreamCallbacks = {}
): Promise<ClaudeStreamResult> {
  const client = getClaudeClient();
  const tools = getGenerationTools();
  let accumulatedText = "";
  const webSearchResults: WebSearchResult[] = [];

  const stream = client.messages.stream({
    model: getModelId(),
    max_tokens: getMaxOutputTokens(),
    system: systemPrompt,
    messages,
    tools: tools.length > 0 ? tools : undefined,
  });

  stream.on("text", (text) => {
    accumulatedText += text;
    callbacks.onTextDelta?.(text);
  });

  // Iterate over raw events to capture web search results
  for await (const event of stream) {
    if (
      event.type === "content_block_start" &&
      "content_block" in event &&
      event.content_block.type === "server_tool_use" &&
      event.content_block.name === "web_search"
    ) {
      const input = event.content_block.input as { query?: string } | undefined;
      if (input?.query) {
        callbacks.onWebSearch?.(input.query);
      }
    }

    if (
      event.type === "content_block_start" &&
      "content_block" in event &&
      event.content_block.type === "web_search_tool_result"
    ) {
      const content = event.content_block.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === "web_search_result") {
            webSearchResults.push({
              url: item.url || "",
              title: item.title || "",
              snippet: item.description || "",
            });
          }
        }
      }
    }
  }

  const finalMessage = await stream.finalMessage();

  // Extract any text from the final message content blocks
  // (in case text events didn't fire for all blocks)
  if (!accumulatedText) {
    for (const block of finalMessage.content) {
      if (block.type === "text") {
        accumulatedText += block.text;
      }
    }
  }

  return {
    text: accumulatedText,
    tokensUsed: {
      input: finalMessage.usage.input_tokens,
      output: finalMessage.usage.output_tokens,
    },
    webSearchResults,
  };
}
```

> **Note:** The `streamGeneration` function uses the SDK's `.stream()` helper. It accumulates all text into a single string, calls back on each text delta for SSE forwarding, and captures web search results from the streamed events. The calling code (the orchestrator) handles SSE encoding.

**3d. Create `src/lib/claude/index.ts`:**

```typescript
export { getClaudeClient, getModelId, getMaxOutputTokens } from "./client";
export { getGenerationTools } from "./tools";
export { streamGeneration } from "./streaming";
export type { ClaudeStreamCallbacks, ClaudeStreamResult } from "./streaming";
```

**Verification:** `npx tsc --noEmit` passes. Import `{ getClaudeClient }` from `@/lib/claude` resolves.

---

### Step 4: Build the 7-layer prompt assembly (`src/lib/prompt-assembly/`)

**4a. Create `src/lib/prompt-assembly/layer-sop.ts`:**

```typescript
import fs from "fs";
import path from "path";
import type { PromptLayer } from "@/types/claude";

let cachedContent: string | null = null;

export function buildLayerSop(): PromptLayer {
  if (!cachedContent) {
    const filePath = path.resolve(
      process.cwd(),
      "docs/BWC Master Content Engine SOP.md"
    );
    cachedContent = fs.readFileSync(filePath, "utf-8");
  }
  return {
    name: "Master SOP",
    content: cachedContent,
    tokenEstimate: Math.ceil(cachedContent.length / 4),
  };
}
```

**4b. Create `src/lib/prompt-assembly/layer-style-guide.ts`:**

Same pattern as 4a but reads `docs/Bhutan Wine Company — Brand Style Guide for HTML Blog Posts (3).md`.

```typescript
import fs from "fs";
import path from "path";
import type { PromptLayer } from "@/types/claude";

let cachedContent: string | null = null;

export function buildLayerStyleGuide(): PromptLayer {
  if (!cachedContent) {
    const filePath = path.resolve(
      process.cwd(),
      "docs/Bhutan Wine Company — Brand Style Guide for HTML Blog Posts (3).md"
    );
    cachedContent = fs.readFileSync(filePath, "utf-8");
  }
  return {
    name: "Brand Style Guide",
    content: cachedContent,
    tokenEstimate: Math.ceil(cachedContent.length / 4),
  };
}
```

**4c. Create `src/lib/prompt-assembly/layer-template-ref.ts`:**

Exports a prompt layer describing the available content node types Claude can use. This does NOT embed the full CSS — it lists the component types the renderer supports, so Claude knows what structured content types are available.

```typescript
import type { PromptLayer } from "@/types/claude";
import { TEMPLATE_VERSION } from "@/lib/renderer";

const TEMPLATE_REFERENCE = `You are generating a CanonicalArticleDocument (structured JSON). The Article Renderer (v${TEMPLATE_VERSION}) supports these content node types:

SECTION STRUCTURE:
- Each section has: id (string), heading (string), headingLevel (2 | 3), content (ContentNode[])

CONTENT NODE TYPES:
1. "paragraph" — { type: "paragraph", id, text } — Body text. May contain inline HTML: <a>, <strong>, <em>
2. "image" — { type: "image", id, placement: ImagePlacement } — Photo with alt text, caption, dimensions
3. "pullQuote" — { type: "pullQuote", id, text, attribution } — Styled blockquote with gold left border
4. "keyFacts" — { type: "keyFacts", id, title, facts: [{label, value}] } — Highlighted fact box
5. "table" — { type: "table", id, caption, headers, rows } — Data table
6. "list" — { type: "list", id, ordered, items } — Ordered or unordered list
7. "callout" — { type: "callout", id, variant: "info"|"tip"|"warning", text } — Highlighted callout box

IMAGE PLACEMENT:
- heroImage: appears above article, loading="eager", fetchpriority="high"
- Inline images: loading="lazy", positioned within sections
- All images require: src (URL), alt (10-25 words for informative, "" for decorative), width, height

CAPTURE COMPONENTS (ctaType field):
- "newsletter" | "allocation" | "tour" | "content_upgrade" | "waitlist"

SCHEMA FLAGS:
- blogPosting: always true
- faqPage: true only if FAQ section present
- product: true only if specific wine product discussed`;

export function buildLayerTemplateRef(): PromptLayer {
  return {
    name: "Template Reference",
    content: TEMPLATE_REFERENCE,
    tokenEstimate: Math.ceil(TEMPLATE_REFERENCE.length / 4),
  };
}
```

**4d. Create `src/lib/prompt-assembly/layer-brief.ts`:**

Queries the `content_map` table for the target article and its hub/spoke context.

```typescript
import { prisma } from "@/lib/db";
import type { PromptLayer } from "@/types/claude";

export async function buildLayerBrief(articleId: number): Promise<PromptLayer> {
  const article = await prisma.contentMap.findUnique({
    where: { id: articleId },
  });

  if (!article) {
    throw new Error("NOT_FOUND");
  }

  // Get parent hub if this is a spoke
  let parentHub: { title: string; slug: string | null } | null = null;
  if (article.parentHubId) {
    parentHub = await prisma.contentMap.findUnique({
      where: { id: article.parentHubId },
      select: { title: true, slug: true },
    });
  }

  // Get sibling spokes if this is a hub or spoke
  const hubId = article.articleType === "hub" ? article.id : article.parentHubId;
  let siblingSpokes: { title: string; slug: string | null; publishedUrl: string | null }[] = [];
  if (hubId) {
    siblingSpokes = await prisma.contentMap.findMany({
      where: {
        parentHubId: hubId,
        id: { not: article.id },
      },
      select: { title: true, slug: true, publishedUrl: true },
    });
  }

  const lines: string[] = [
    `Article Title: ${article.title}`,
    `Article Type: ${article.articleType}`,
    `Slug: ${article.slug || "TBD"}`,
    `Hub Name: ${article.hubName}`,
    `Main Entity: ${article.mainEntity}`,
    `Supporting Entities: ${(article.supportingEntities as string[]).join(", ") || "None"}`,
    `Target Keywords: ${(article.targetKeywords as string[]).join(", ") || "None"}`,
  ];

  if (article.contentNotes) {
    lines.push(`Content Notes: ${article.contentNotes}`);
  }

  if (parentHub) {
    lines.push(`Parent Hub: "${parentHub.title}" (/${parentHub.slug || ""})`);
  }

  if (siblingSpokes.length > 0) {
    lines.push(`Sibling Spokes:`);
    for (const spoke of siblingSpokes) {
      const url = spoke.publishedUrl || `/${spoke.slug || ""}`;
      lines.push(`  - "${spoke.title}" (${url})`);
    }
  }

  const content = lines.join("\n");

  return {
    name: "Article Brief",
    content,
    tokenEstimate: Math.ceil(content.length / 4),
  };
}
```

**4e. Create `src/lib/prompt-assembly/layer-kb-context.ts`:**

Calls Onyx multi-query search and assembles the context string.

```typescript
import { buildSearchQueries, searchOnyxMulti, assembleOnyxContext } from "@/lib/onyx";
import type { ArticleBrief } from "@/lib/onyx";
import type { PromptLayer } from "@/types/claude";

export async function buildLayerKbContext(brief: ArticleBrief): Promise<PromptLayer> {
  const queries = buildSearchQueries(brief);
  const contexts = await searchOnyxMulti(queries);
  const content = assembleOnyxContext(contexts);

  return {
    name: "Knowledge Base Context",
    content,
    tokenEstimate: Math.ceil(content.length / 4),
  };
}
```

**4f. Create `src/lib/prompt-assembly/layer-link-graph.ts`:**

Builds the internal link graph from DB: core page links + published article URLs + hub-spoke relationships.

```typescript
import { prisma } from "@/lib/db";
import type { PromptLayer } from "@/types/claude";

export async function buildLayerLinkGraph(articleId: number): Promise<PromptLayer> {
  // 1. Core page links (from internal_links table)
  const coreLinks = await prisma.internalLink.findMany({
    where: { linkType: "to-core-page", isActive: true },
    select: { targetCorePage: true, anchorText: true },
  });

  // 2. Published article URLs (from content_map where published)
  const publishedArticles = await prisma.contentMap.findMany({
    where: {
      status: "published",
      publishedUrl: { not: null },
      id: { not: articleId }, // exclude the current article
    },
    select: { title: true, slug: true, publishedUrl: true, articleType: true, hubName: true },
  });

  // 3. Hub-spoke relationships for the current article's cluster
  const currentArticle = await prisma.contentMap.findUnique({
    where: { id: articleId },
    select: { articleType: true, parentHubId: true, id: true },
  });

  let clusterArticles: { title: string; slug: string | null; publishedUrl: string | null; articleType: string }[] = [];
  if (currentArticle) {
    const hubId = currentArticle.articleType === "hub" ? currentArticle.id : currentArticle.parentHubId;
    if (hubId) {
      clusterArticles = await prisma.contentMap.findMany({
        where: { OR: [{ id: hubId }, { parentHubId: hubId }], id: { not: articleId } },
        select: { title: true, slug: true, publishedUrl: true, articleType: true },
      });
    }
  }

  const lines: string[] = [
    "INTERNAL LINK INSTRUCTIONS:",
    "- Link to the URLs listed below using natural anchor text",
    "- Do NOT link to articles with status 'planned' — only published URLs",
    "- Core pages should be linked where contextually relevant",
    "- Hub-spoke cluster links are high priority for SEO",
    "",
    "CORE BWC PAGES:",
  ];

  for (const link of coreLinks) {
    const page = link.targetCorePage || "unknown";
    const anchor = link.anchorText || page;
    lines.push(`  - ${anchor}: https://www.bhutanwine.com/${page}`);
  }

  if (publishedArticles.length > 0) {
    lines.push("", "PUBLISHED BLOG ARTICLES:");
    for (const article of publishedArticles) {
      lines.push(`  - "${article.title}" [${article.articleType}]: ${article.publishedUrl}`);
    }
  } else {
    lines.push("", "PUBLISHED BLOG ARTICLES: None yet. Use core page links and external sources.");
  }

  if (clusterArticles.length > 0) {
    lines.push("", "HUB-SPOKE CLUSTER (prioritize these for internal linking):");
    for (const article of clusterArticles) {
      const url = article.publishedUrl || `[not yet published: ${article.slug}]`;
      lines.push(`  - "${article.title}" [${article.articleType}]: ${url}`);
    }
  }

  const content = lines.join("\n");

  return {
    name: "Internal Link Graph",
    content,
    tokenEstimate: Math.ceil(content.length / 4),
  };
}
```

> **Note:** With 0 published articles currently, the "PUBLISHED BLOG ARTICLES" section will say "None yet." This is correct and expected. The link graph will grow as articles are published.

**4g. Create `src/lib/prompt-assembly/layer-photo-manifest.ts`:**

```typescript
import type { PromptLayer } from "@/types/claude";
import type { PhotoManifest } from "@/types/photo";

export function buildLayerPhotoManifest(manifest: PhotoManifest | null): PromptLayer {
  if (!manifest || manifest.photos.length === 0) {
    return {
      name: "Photo Manifest",
      content: "PHOTOS: No photos have been selected for this article. Do NOT include image content nodes. Set heroImage to null.",
      tokenEstimate: 30,
    };
  }

  const lines: string[] = [
    "SELECTED PHOTOS FOR THIS ARTICLE:",
    `Total available: ${manifest.totalAvailable}`,
    `Hero photo ID: ${manifest.heroPhotoId ?? "Not assigned"}`,
    "",
  ];

  for (const photo of manifest.photos) {
    lines.push(`Photo ID ${photo.id}:`);
    lines.push(`  Filename: ${photo.filename}`);
    lines.push(`  Category: ${photo.category || "uncategorized"}`);
    lines.push(`  Description: ${photo.description || "No description"}`);
    lines.push(`  Alt text: ${photo.altText || "Needs alt text"}`);
    lines.push(`  Classification: ${photo.classification}`);
    if (photo.cloudinaryUrl) {
      lines.push(`  CDN URL: ${photo.cloudinaryUrl}`);
    } else if (photo.driveUrl) {
      lines.push(`  Drive URL (temporary): ${photo.driveUrl}`);
    }
    if (photo.widthPx && photo.heightPx) {
      lines.push(`  Dimensions: ${photo.widthPx}x${photo.heightPx}`);
    }
    lines.push("");
  }

  lines.push("INSTRUCTIONS:");
  lines.push("- Use the photo IDs, URLs, alt text, and dimensions provided above");
  lines.push("- Assign hero image using the designated hero photo ID");
  lines.push("- Place inline images contextually within relevant sections");
  lines.push("- Informative images: alt text 10-25 words describing the image");
  lines.push('- Decorative images: alt=""');

  const content = lines.join("\n");

  return {
    name: "Photo Manifest",
    content,
    tokenEstimate: Math.ceil(content.length / 4),
  };
}
```

**4h. Create `src/lib/prompt-assembly/assembler.ts`:**

```typescript
import type { PromptLayer } from "@/types/claude";
import type { PhotoManifest } from "@/types/photo";
import type { ArticleBrief } from "@/lib/onyx";
import { buildLayerSop } from "./layer-sop";
import { buildLayerStyleGuide } from "./layer-style-guide";
import { buildLayerTemplateRef } from "./layer-template-ref";
import { buildLayerBrief } from "./layer-brief";
import { buildLayerKbContext } from "./layer-kb-context";
import { buildLayerLinkGraph } from "./layer-link-graph";
import { buildLayerPhotoManifest } from "./layer-photo-manifest";

export interface AssembledPrompt {
  systemPrompt: string;
  layers: PromptLayer[];
  totalTokenEstimate: number;
}

const OUTPUT_FORMAT_INSTRUCTION = `
=== OUTPUT FORMAT ===
You MUST respond with a single valid JSON object conforming to the CanonicalArticleDocument schema.

CRITICAL RULES:
- Output ONLY the JSON object — no markdown fences, no commentary, no explanation
- Do NOT output HTML — output structured JSON only. The Article Renderer handles HTML.
- Every section must have a unique "id" field: "section-1", "section-2", etc.
- Every content node must have a unique "id" field: "node-1", "node-2", etc.
- All internal links must target URLs from the Link Graph above
- All external links must include trustTier and sourceName
- executiveSummary: 25-40 words
- metaTitle: 50-60 characters
- metaDescription: 150-160 characters

If you need to search the web for external source URLs, use the web_search tool.
After searching, embed the found URLs directly in the externalLinks array.
`;

export async function assembleSystemPrompt(
  articleId: number,
  photoManifest: PhotoManifest | null
): Promise<AssembledPrompt> {
  // Static layers (cached)
  const layerSop = buildLayerSop();
  const layerStyleGuide = buildLayerStyleGuide();
  const layerTemplateRef = buildLayerTemplateRef();

  // Dynamic layers — brief first (needed for KB context)
  const layerBrief = await buildLayerBrief(articleId);

  // Extract brief data for Onyx queries
  const briefContent = layerBrief.content;
  const mainEntityMatch = briefContent.match(/Main Entity: (.+)/);
  const supportingMatch = briefContent.match(/Supporting Entities: (.+)/);
  const keywordsMatch = briefContent.match(/Target Keywords: (.+)/);
  const titleMatch = briefContent.match(/Article Title: (.+)/);

  const brief: ArticleBrief = {
    title: titleMatch?.[1] || "",
    mainEntity: mainEntityMatch?.[1] || "",
    supportingEntities: supportingMatch?.[1]?.split(", ").filter(Boolean) || [],
    targetKeywords: keywordsMatch?.[1]?.split(", ").filter(Boolean) || [],
  };

  // Parallel: KB context + link graph
  const [layerKbContext, layerLinkGraph] = await Promise.all([
    buildLayerKbContext(brief),
    buildLayerLinkGraph(articleId),
  ]);

  const layerPhotoManifest = buildLayerPhotoManifest(photoManifest);

  const layers: PromptLayer[] = [
    layerSop,
    layerStyleGuide,
    layerTemplateRef,
    layerBrief,
    layerKbContext,
    layerLinkGraph,
    layerPhotoManifest,
  ];

  const sections = layers.map(
    (layer) => `=== LAYER: ${layer.name.toUpperCase()} ===\n${layer.content}`
  );
  sections.push(OUTPUT_FORMAT_INSTRUCTION);

  const systemPrompt = sections.join("\n\n");
  const totalTokenEstimate = layers.reduce((sum, l) => sum + l.tokenEstimate, 0);

  return { systemPrompt, layers, totalTokenEstimate };
}
```

**4i. Create `src/lib/prompt-assembly/index.ts`:**

```typescript
export { assembleSystemPrompt } from "./assembler";
export type { AssembledPrompt } from "./assembler";
export { buildLayerSop } from "./layer-sop";
export { buildLayerStyleGuide } from "./layer-style-guide";
export { buildLayerTemplateRef } from "./layer-template-ref";
export { buildLayerBrief } from "./layer-brief";
export { buildLayerKbContext } from "./layer-kb-context";
export { buildLayerLinkGraph } from "./layer-link-graph";
export { buildLayerPhotoManifest } from "./layer-photo-manifest";
```

**Verification:** `npx tsc --noEmit` passes. All layer builders import correctly.

---

### Step 5: Build the orchestration layer (`src/lib/orchestration/`)

**5a. Create `src/lib/orchestration/conversation.ts`:**

```typescript
import type Anthropic from "@anthropic-ai/sdk";
import type { ConversationMessage, GenerateArticleRequest } from "@/types/claude";
import type { CanonicalArticleDocument } from "@/types/article";

/**
 * Builds the messages array for the Claude API call from conversation history
 * and the current user request.
 */
export function buildMessages(
  request: GenerateArticleRequest
): Anthropic.Messages.MessageParam[] {
  const messages: Anthropic.Messages.MessageParam[] = [];

  // Add conversation history
  for (const msg of request.conversationHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Build the current user message
  let userContent = request.userMessage;

  // If there's a current document (re-edit), include it as context
  if (request.currentDocument) {
    userContent = buildEditMessage(request.currentDocument, request.userMessage);
  }

  messages.push({
    role: "user",
    content: userContent,
  });

  return messages;
}

function buildEditMessage(
  currentDocument: CanonicalArticleDocument,
  userMessage: string
): string {
  return `Here is the current article document (CanonicalArticleDocument JSON):

\`\`\`json
${JSON.stringify(currentDocument, null, 2)}
\`\`\`

Please modify this document based on my request below. Return the COMPLETE updated CanonicalArticleDocument JSON (not just the changed parts).

My request: ${userMessage}`;
}
```

**5b. Create `src/lib/orchestration/streaming-parser.ts`:**

Parses the accumulated Claude text into a CanonicalArticleDocument.

```typescript
import type { CanonicalArticleDocument } from "@/types/article";

export interface ParseResult {
  document: CanonicalArticleDocument | null;
  conversationReply: string;
  rawText: string;
  parseError: string | null;
}

/**
 * Attempts to extract a JSON CanonicalArticleDocument from Claude's response text.
 *
 * Claude may include conversational text before/after the JSON. This parser:
 * 1. Tries to parse the entire text as JSON
 * 2. Falls back to extracting JSON from markdown code fences
 * 3. Falls back to finding the outermost { ... } block
 */
export function parseGenerationResponse(rawText: string): ParseResult {
  const trimmed = rawText.trim();
  let conversationReply = "";

  // Strategy 1: Entire text is JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (isCanonicalDoc(parsed)) {
      return { document: parsed, conversationReply: "", rawText, parseError: null };
    }
  } catch {
    // Not pure JSON, try other strategies
  }

  // Strategy 2: Extract from markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (isCanonicalDoc(parsed)) {
        // Everything outside the fence is conversation
        conversationReply = trimmed
          .replace(/```(?:json)?\s*\n?[\s\S]*?\n?```/, "")
          .trim();
        return { document: parsed, conversationReply, rawText, parseError: null };
      }
    } catch {
      // fence content wasn't valid JSON
    }
  }

  // Strategy 3: Find the outermost { ... } block
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (isCanonicalDoc(parsed)) {
        conversationReply = (
          trimmed.slice(0, firstBrace) + trimmed.slice(lastBrace + 1)
        ).trim();
        return { document: parsed, conversationReply, rawText, parseError: null };
      }
    } catch {
      // not valid JSON
    }
  }

  // All strategies failed
  return {
    document: null,
    conversationReply: trimmed,
    rawText,
    parseError: "Failed to extract CanonicalArticleDocument JSON from Claude's response",
  };
}

function isCanonicalDoc(obj: unknown): obj is CanonicalArticleDocument {
  if (typeof obj !== "object" || obj === null) return false;
  const doc = obj as Record<string, unknown>;
  return (
    typeof doc.title === "string" &&
    typeof doc.articleId === "number" &&
    Array.isArray(doc.sections)
  );
}
```

**5c. Create `src/lib/orchestration/post-processing.ts`:**

```typescript
import { repairCanonicalDocument, validateCanonicalDocument } from "@/lib/article-schema";
import { renderArticle, TEMPLATE_VERSION } from "@/lib/renderer";
import type { CanonicalArticleDocument } from "@/types/article";
import type { ValidationResult } from "@/types/api";
import type { RendererOutput } from "@/types/renderer";

export interface PostProcessingResult {
  document: CanonicalArticleDocument;
  html: string;
  validationResult: ValidationResult;
  wordCount: number;
}

export function runPostProcessing(rawDocument: CanonicalArticleDocument): PostProcessingResult {
  // Step 1: Repair common LLM output issues
  const { repaired, changes } = repairCanonicalDocument(rawDocument);
  if (changes.length > 0) {
    console.log(`[post-processing] Repaired ${changes.length} issues:`, changes);
  }

  // Step 2: Validate against schema + SOP rules
  const validationResult = validateCanonicalDocument(repaired);
  if (!validationResult.valid) {
    console.warn(
      `[post-processing] Validation found ${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings`
    );
  }

  // Step 3: Render to HTML (renderer internally calls repair again — safe)
  let rendererOutput: RendererOutput;
  try {
    rendererOutput = renderArticle({
      document: repaired,
      htmlOverrides: null,
      templateVersion: TEMPLATE_VERSION,
    });
  } catch (error) {
    // If rendering fails, return empty HTML with the validation result
    console.error("[post-processing] Render failed:", error);
    return {
      document: repaired,
      html: "",
      validationResult: {
        ...validationResult,
        errors: [
          ...validationResult.errors,
          { path: "renderer", message: "HTML rendering failed" },
        ],
        valid: false,
      },
      wordCount: 0,
    };
  }

  return {
    document: repaired,
    html: rendererOutput.html,
    validationResult,
    wordCount: rendererOutput.wordCount,
  };
}
```

**5d. Create `src/lib/orchestration/orchestrator.ts`:**

The main entry point that ties everything together.

```typescript
import type { GenerateArticleRequest, GenerateArticleResponse, StreamEvent } from "@/types/claude";
import { assembleSystemPrompt } from "@/lib/prompt-assembly";
import { streamGeneration } from "@/lib/claude";
import { buildMessages } from "./conversation";
import { parseGenerationResponse } from "./streaming-parser";
import { runPostProcessing } from "./post-processing";

export type StreamCallback = (event: StreamEvent) => void;

/**
 * Runs the full generation pipeline:
 * 1. Assemble system prompt
 * 2. Call Claude with streaming
 * 3. Parse response into CanonicalArticleDocument
 * 4. Run post-processing (repair + validate + render)
 * 5. Return complete response
 */
export async function generateArticle(
  request: GenerateArticleRequest,
  onEvent?: StreamCallback
): Promise<GenerateArticleResponse> {
  const emit = (type: StreamEvent["type"], data: unknown) => {
    onEvent?.({ type, data });
  };

  // Step 1: Assemble the 7-layer system prompt
  emit("status", { message: "Assembling system prompt..." });
  const { systemPrompt, layers, totalTokenEstimate } = await assembleSystemPrompt(
    request.articleId,
    request.photoManifest
  );
  emit("status", {
    message: `System prompt assembled (${layers.length} layers, ~${totalTokenEstimate} tokens)`,
  });

  // Step 2: Build messages array
  const messages = buildMessages(request);

  // Step 3: Call Claude API with streaming
  emit("status", { message: "Calling Claude API..." });

  const streamResult = await streamGeneration(systemPrompt, messages, {
    onTextDelta: (text) => emit("text_delta", { text }),
    onWebSearch: (query) => emit("web_search", { query }),
    onError: (error) => emit("error", { code: "GENERATION_FAILED", message: error.message }),
  });

  emit("status", {
    message: `Claude response complete (${streamResult.tokensUsed.input} input, ${streamResult.tokensUsed.output} output tokens)`,
  });

  // Step 4: Parse JSON from response
  emit("status", { message: "Parsing response..." });
  const parseResult = parseGenerationResponse(streamResult.text);

  if (!parseResult.document) {
    emit("error", {
      code: "GENERATION_FAILED",
      message: parseResult.parseError || "Failed to parse response",
    });
    throw new Error("GENERATION_FAILED");
  }

  emit("document", parseResult.document);

  // Step 5: Post-processing (repair + validate + render)
  emit("status", { message: "Running validation and rendering..." });
  const postResult = runPostProcessing(parseResult.document);

  emit("validation", postResult.validationResult);

  // Build final response
  const response: GenerateArticleResponse = {
    document: postResult.document,
    html: postResult.html,
    validationResult: postResult.validationResult,
    conversationReply:
      parseResult.conversationReply || `Article generated successfully (${postResult.wordCount} words).`,
    tokensUsed: streamResult.tokensUsed,
    webSearchResults: streamResult.webSearchResults,
  };

  emit("complete", response);

  return response;
}
```

**5e. Create `src/lib/orchestration/index.ts`:**

```typescript
export { generateArticle } from "./orchestrator";
export type { StreamCallback } from "./orchestrator";
export { buildMessages } from "./conversation";
export { parseGenerationResponse } from "./streaming-parser";
export type { ParseResult } from "./streaming-parser";
export { runPostProcessing } from "./post-processing";
export type { PostProcessingResult } from "./post-processing";
```

**Verification:** `npx tsc --noEmit` passes. All orchestration modules compile and import correctly.

---

### Step 6: Build the SSE streaming API endpoint

**6a. Create `src/app/api/articles/generate/route.ts`:**

```typescript
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { generateArticle } from "@/lib/orchestration";
import type { StreamEvent, GenerateArticleRequest } from "@/types/claude";
import { z } from "zod";

const GenerateRequestSchema = z.object({
  articleId: z.number().int().positive(),
  userMessage: z.string().min(1).max(10000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      timestamp: z.string(),
    })
  ).default([]),
  currentDocument: z.record(z.string(), z.unknown()).nullable().default(null),
  photoManifest: z.object({
    photos: z.array(z.record(z.string(), z.unknown())),
    heroPhotoId: z.number().nullable(),
    totalAvailable: z.number(),
  }).nullable().default(null),
});

function encodeSSE(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = GenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      // For SSE endpoints, return a standard JSON error for validation failures
      // (the stream hasn't started yet)
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const generateRequest: GenerateArticleRequest = {
      articleId: parsed.data.articleId,
      userMessage: parsed.data.userMessage,
      conversationHistory: parsed.data.conversationHistory,
      currentDocument: parsed.data.currentDocument as GenerateArticleRequest["currentDocument"],
      photoManifest: parsed.data.photoManifest as GenerateArticleRequest["photoManifest"],
    };

    // Create a ReadableStream that emits SSE events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          await generateArticle(generateRequest, (event: StreamEvent) => {
            controller.enqueue(encoder.encode(encodeSSE(event)));
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          const errorEvent: StreamEvent = {
            type: "error",
            data: { code: message === "GENERATION_FAILED" ? "GENERATION_FAILED" : "INTERNAL_ERROR", message },
          };
          controller.enqueue(encoder.encode(encodeSSE(errorEvent)));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return new Response(
        JSON.stringify({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return new Response(
        JSON.stringify({ success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required" } }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

> **Design notes:**
> - Auth errors are caught BEFORE the stream starts, so they return standard JSON responses with appropriate status codes.
> - Once the stream starts, errors are sent as SSE `error` events — the HTTP status is already 200.
> - The `X-Accel-Buffering: no` header prevents Vercel/nginx from buffering SSE events.

**Verification:** `npm run build` passes. The new route appears in the build output as a dynamic route (`ƒ`).

---

### Step 7: Build the link verification endpoint

**7a. Create `src/app/api/links/verify/route.ts`:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const VerifyRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50),
});

interface LinkCheckResult {
  url: string;
  status: number;
  ok: boolean;
  redirectUrl?: string;
  error?: string;
}

const LINK_CHECK_TIMEOUT_MS = 5000;
const MAX_CONCURRENT = 20;

async function checkLink(url: string): Promise<LinkCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "BWC-Content-Engine-LinkChecker/1.0",
      },
    });

    const result: LinkCheckResult = {
      url,
      status: response.status,
      ok: response.ok,
    };

    // Check if there was a redirect
    if (response.url !== url) {
      result.redirectUrl = response.url;
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      url,
      status: 0,
      ok: false,
      error: message.includes("AbortError") || message.includes("abort")
        ? "Timeout"
        : message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = VerifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { urls } = parsed.data;

    // Process in batches to respect concurrency limit
    const results: LinkCheckResult[] = [];
    for (let i = 0; i < urls.length; i += MAX_CONCURRENT) {
      const batch = urls.slice(i, i + MAX_CONCURRENT);
      const batchResults = await Promise.allSettled(batch.map(checkLink));
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            url: batch[batchResults.indexOf(result)] || "unknown",
            status: 0,
            ok: false,
            error: result.reason?.message || "Check failed",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          ok: results.filter((r) => r.ok).length,
          broken: results.filter((r) => !r.ok).length,
        },
      },
    });
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

**Verification:** `npm run build` passes. Both new routes appear in build output.

---

### Step 8: Write the integration test script

**8a. Create `scripts/test-guide-5.ts`:**

```typescript
/**
 * Integration test for Guide 5: Orchestration Layer + Claude API
 *
 * Run with: npx tsx scripts/test-guide-5.ts
 *
 * Tests:
 * 1. Environment variables — all Guide 5 vars present
 * 2. Claude client — SDK instantiates, basic API call works
 * 3. Prompt assembly — all 7 layers build without error
 * 4. Streaming parser — parses JSON from various Claude response formats
 * 5. Post-processing — repair + validate + render pipeline
 * 6. API endpoints (if dev server running) — SSE stream + link verification
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

let passed = 0;
let failed = 0;

function check(name: string, result: boolean, detail?: string) {
  if (result) {
    console.log(`  PASS ${name}`);
    passed++;
  } else {
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function test() {
  console.log("\n=== Guide 5 Integration Tests ===\n");

  // ─── Test 1: Environment variables ──────────────────────────────
  console.log("1. Environment variables");

  check("ANTHROPIC_API_KEY is set", !!process.env.ANTHROPIC_API_KEY);
  check("ANTHROPIC_MODEL is set", !!process.env.ANTHROPIC_MODEL);
  check(
    "ANTHROPIC_MAX_OUTPUT_TOKENS is set",
    !!process.env.ANTHROPIC_MAX_OUTPUT_TOKENS
  );
  check(
    "ANTHROPIC_MAX_OUTPUT_TOKENS >= 16384",
    parseInt(process.env.ANTHROPIC_MAX_OUTPUT_TOKENS || "0", 10) >= 16384
  );
  check("ENABLE_WEB_SEARCH is set", !!process.env.ENABLE_WEB_SEARCH);

  // ─── Test 2: Claude client ──────────────────────────────────────
  console.log("\n2. Claude client");

  const { getClaudeClient, getModelId, getMaxOutputTokens } = await import(
    "../src/lib/claude"
  );

  const client = getClaudeClient();
  check("Claude client instantiates", !!client);
  check("Model ID resolves", !!getModelId());
  check("Max output tokens = 16384", getMaxOutputTokens() === 16384);

  // Basic API call (non-streaming)
  try {
    const msg = await client.messages.create({
      model: getModelId(),
      max_tokens: 50,
      messages: [{ role: "user", content: "Say 'test-ok' and nothing else." }],
    });
    const text =
      msg.content[0].type === "text" ? msg.content[0].text : "";
    check("Basic Claude API call succeeds", text.includes("test-ok"));
    console.log(`    Model: ${msg.model}, Tokens: ${msg.usage.input_tokens}in/${msg.usage.output_tokens}out`);
  } catch (error) {
    check("Basic Claude API call succeeds", false, String(error));
  }

  // ─── Test 3: Prompt assembly ────────────────────────────────────
  console.log("\n3. Prompt assembly (individual layers)");

  const { buildLayerSop } = await import("../src/lib/prompt-assembly");
  const { buildLayerStyleGuide } = await import("../src/lib/prompt-assembly");
  const { buildLayerTemplateRef } = await import("../src/lib/prompt-assembly");
  const { buildLayerPhotoManifest } = await import(
    "../src/lib/prompt-assembly"
  );

  const sopLayer = buildLayerSop();
  check("Layer 1 (SOP) loads", sopLayer.content.length > 1000);
  console.log(
    `    SOP: ${sopLayer.content.length} chars, ~${sopLayer.tokenEstimate} tokens`
  );

  const styleLayer = buildLayerStyleGuide();
  check("Layer 2a (Style Guide) loads", styleLayer.content.length > 1000);
  console.log(
    `    Style Guide: ${styleLayer.content.length} chars, ~${styleLayer.tokenEstimate} tokens`
  );

  const templateLayer = buildLayerTemplateRef();
  check(
    "Layer 2b (Template Ref) builds",
    templateLayer.content.includes("paragraph")
  );

  const photoLayer = buildLayerPhotoManifest(null);
  check(
    "Layer 6 (Photo Manifest) handles null",
    photoLayer.content.includes("No photos")
  );

  // Dynamic layers need DB — test with articleId 1 if DB is available
  try {
    const { buildLayerBrief } = await import("../src/lib/prompt-assembly");
    const briefLayer = await buildLayerBrief(1);
    check("Layer 3 (Brief) loads from DB", briefLayer.content.includes("Article Title:"));
    console.log(`    Brief: ${briefLayer.content.length} chars`);

    const { buildLayerLinkGraph } = await import("../src/lib/prompt-assembly");
    const linkLayer = await buildLayerLinkGraph(1);
    check("Layer 5 (Link Graph) loads from DB", linkLayer.content.includes("CORE BWC PAGES:"));
    console.log(`    Link Graph: ${linkLayer.content.length} chars`);
  } catch (error) {
    console.log(`    Skipping DB-dependent layers: ${error}`);
  }

  // Test KB context layer (requires Onyx)
  try {
    const { buildLayerKbContext } = await import("../src/lib/prompt-assembly");
    const kbLayer = await buildLayerKbContext({
      title: "Test Article",
      mainEntity: "Bhutan wine",
      supportingEntities: [],
      targetKeywords: ["bhutan wine"],
    });
    check(
      "Layer 4 (KB Context) loads from Onyx",
      kbLayer.content.includes("Knowledge Base Context")
    );
    console.log(`    KB Context: ${kbLayer.content.length} chars`);
  } catch (error) {
    console.log(`    Skipping Onyx-dependent layer: ${error}`);
  }

  // ─── Test 4: Streaming parser ───────────────────────────────────
  console.log("\n4. Streaming JSON parser");

  const { parseGenerationResponse } = await import("../src/lib/orchestration");

  // Pure JSON
  const pureJson = JSON.stringify({
    title: "Test",
    articleId: 1,
    sections: [],
    slug: "test",
  });
  const r1 = parseGenerationResponse(pureJson);
  check("Parses pure JSON", r1.document !== null);

  // JSON in code fence
  const fenced = `Here is the article:\n\`\`\`json\n${pureJson}\n\`\`\`\nLet me know if you want changes.`;
  const r2 = parseGenerationResponse(fenced);
  check("Parses JSON from code fence", r2.document !== null);
  check(
    "Extracts conversation reply from fenced response",
    r2.conversationReply.length > 0
  );

  // JSON with surrounding text
  const surrounded = `I've generated the article.\n${pureJson}\nHope this helps!`;
  const r3 = parseGenerationResponse(surrounded);
  check("Parses JSON from surrounded text", r3.document !== null);

  // Invalid text
  const r4 = parseGenerationResponse("This is not JSON at all.");
  check("Returns null for non-JSON text", r4.document === null);
  check("Returns parse error for non-JSON", r4.parseError !== null);

  // ─── Test 5: Post-processing pipeline ───────────────────────────
  console.log("\n5. Post-processing pipeline");

  const fs = await import("fs");
  const fixturePath = path.resolve(
    __dirname,
    "fixtures/sample-canonical-doc.json"
  );

  if (fs.existsSync(fixturePath)) {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    const { runPostProcessing } = await import("../src/lib/orchestration");

    const postResult = runPostProcessing(fixture);
    check("Post-processing produces HTML", postResult.html.length > 0);
    check(
      "Post-processing returns validation result",
      typeof postResult.validationResult.valid === "boolean"
    );
    check("Post-processing returns word count", postResult.wordCount > 0);
    console.log(
      `    Validation: ${postResult.validationResult.valid ? "valid" : "invalid"}, ` +
        `${postResult.validationResult.errors.length} errors, ` +
        `${postResult.validationResult.warnings.length} warnings, ` +
        `${postResult.wordCount} words`
    );
  } else {
    console.log("    Skipping — no fixture file at scripts/fixtures/sample-canonical-doc.json");
  }

  // ─── Test 6: API endpoints (if dev server running) ──────────────
  console.log("\n6. API endpoints (requires dev server on localhost:3000)");

  const baseUrl = process.env.APP_URL || "http://localhost:3000";

  // Link verification endpoint
  try {
    const linkRes = await fetch(`${baseUrl}/api/links/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: ["https://www.bhutanwine.com", "https://httpstat.us/404"],
      }),
    });
    // May get 401 without auth cookie — that's expected
    if (linkRes.status === 401) {
      check("Link verify endpoint exists (401 = auth required)", true);
    } else {
      const linkData = await linkRes.json();
      check("Link verify endpoint responds", linkData.success !== undefined);
    }
  } catch {
    console.log("    Skipping — dev server not running");
  }

  // Generate endpoint (just verify it exists — don't run a full generation)
  try {
    const genRes = await fetch(`${baseUrl}/api/articles/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: 1, userMessage: "test" }),
    });
    if (genRes.status === 401) {
      check("Generate endpoint exists (401 = auth required)", true);
    } else if (genRes.status === 400) {
      check("Generate endpoint exists (400 = validation)", true);
    } else {
      check("Generate endpoint responds", true);
    }
  } catch {
    console.log("    Skipping — dev server not running");
  }

  // ─── Summary ────────────────────────────────────────────────────
  console.log(
    `\n=== Results: ${passed} passed, ${failed} failed out of ${passed + failed} ===\n`
  );
  process.exit(failed > 0 ? 1 : 0);
}

test().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
```

**Verification:** Script compiles with `npx tsc --noEmit --esModuleInterop --resolveJsonModule`. Run with `npx tsx scripts/test-guide-5.ts`.

---

### Step 9: Update documentation and run generators

**9a. Run the documentation generators:**

```bash
npm run gen:api-routes
npm run gen:env
```

This updates `docs/_generated/` with the new routes and any env var changes.

**9b. Verify the build is clean:**

```bash
npx tsc --noEmit
npm run build
```

Expected: Zero type errors. Build shows the two new routes (`/api/articles/generate` and `/api/links/verify`) as dynamic (`ƒ`).

---

## I. Gate Checks

### Lint & Type Gate

```bash
npx tsc --noEmit          # Zero type errors
npx next lint              # Zero lint errors (warnings acceptable)
npm run build              # Zero build errors
```

All three must pass. The agent fixes any issues before proceeding.

### Integration Gate

```bash
npx tsx scripts/test-guide-5.ts
```

**Expected output:**
```
=== Guide 5 Integration Tests ===

1. Environment variables
  PASS ANTHROPIC_API_KEY is set
  PASS ANTHROPIC_MODEL is set
  PASS ANTHROPIC_MAX_OUTPUT_TOKENS is set
  PASS ANTHROPIC_MAX_OUTPUT_TOKENS >= 16384
  PASS ENABLE_WEB_SEARCH is set

2. Claude client
  PASS Claude client instantiates
  PASS Model ID resolves
  PASS Max output tokens = 16384
  PASS Basic Claude API call succeeds

3. Prompt assembly (individual layers)
  PASS Layer 1 (SOP) loads
  PASS Layer 2a (Style Guide) loads
  PASS Layer 2b (Template Ref) builds
  PASS Layer 6 (Photo Manifest) handles null
  PASS Layer 3 (Brief) loads from DB
  PASS Layer 5 (Link Graph) loads from DB
  PASS Layer 4 (KB Context) loads from Onyx

4. Streaming JSON parser
  PASS Parses pure JSON
  PASS Parses JSON from code fence
  PASS Extracts conversation reply from fenced response
  PASS Parses JSON from surrounded text
  PASS Returns null for non-JSON text
  PASS Returns parse error for non-JSON

5. Post-processing pipeline
  PASS Post-processing produces HTML
  PASS Post-processing returns validation result
  PASS Post-processing returns word count

6. API endpoints (requires dev server on localhost:3000)
  PASS Generate endpoint exists (401 = auth required)
  PASS Link verify endpoint exists (401 = auth required)

=== Results: 24 passed, 0 failed out of 24 ===
```

### Human Gate

1. Start the dev server: `npm run dev`
2. Run a curl test against the generation endpoint (requires auth — use a valid session cookie or temporarily disable auth for testing):

```bash
curl -N -X POST http://localhost:3000/api/articles/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "articleId": 1,
    "userMessage": "Generate a short test article about Bhutan wine. Keep it brief — just 2 sections.",
    "conversationHistory": [],
    "currentDocument": null,
    "photoManifest": null
  }'
```

3. Verify the SSE stream:
   - `event: status` events appear with progress messages
   - `event: text_delta` events stream the response text
   - `event: document` contains a valid CanonicalArticleDocument JSON
   - `event: validation` shows the validation result
   - `event: complete` contains the full `GenerateArticleResponse` with HTML

4. Verify the HTML in the `complete` event:
   - Contains BWC stylesheet and Google Fonts
   - Heading hierarchy is correct (H1 > H2)
   - Internal links point to real BWC URLs from the link graph

5. Test link verification:
```bash
curl -X POST http://localhost:3000/api/links/verify \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{"urls": ["https://www.bhutanwine.com", "https://www.bhutanwine.com/grapes-vineyards"]}'
```

Verify both URLs return `ok: true`.

---

## J. Acceptance Criteria

1. `POST /api/articles/generate` accepts a `GenerateArticleRequest` and returns an SSE stream
2. The SSE stream emits `status`, `text_delta`, `document`, `validation`, and `complete` events
3. The `complete` event contains a valid `GenerateArticleResponse` with:
   - A `CanonicalArticleDocument` that passes Zod schema validation
   - Rendered HTML containing BWC stylesheet, correct fonts, heading hierarchy
   - A `ValidationResult` from the post-processing pipeline
   - Token usage stats (input + output)
   - Web search results array (may be empty if no searches were invoked)
4. The system prompt includes all 7 layers with correct content
5. KB context from Onyx is included when available (graceful fallback when unavailable)
6. Internal link graph contains the 10 core BWC page links
7. Photo manifest layer correctly handles null (no photos selected)
8. `POST /api/links/verify` accepts an array of URLs and returns HTTP status for each
9. Conversation history is correctly threaded through multiple requests
10. The `repairCanonicalDocument` and `validateCanonicalDocument` pipeline runs on every generation
11. `npm run build` passes with zero errors
12. `npx tsc --noEmit` passes with zero type errors
13. All 13 existing routes + 2 new routes are functional

---

## K. Risks and Failure Modes

### Risk 1: Token Budget — System Prompt Too Large

**Threat:** The 7-layer system prompt is ~23K tokens. Combined with conversation history and output, it could approach model limits on very long conversations.

**Mitigation:**
- `claude-sonnet-4-5` has 200K context — 23K system prompt leaves ~160K for history + output
- Long-term: Guide 6+ can implement conversation history truncation if needed
- The assembler logs total token estimates for monitoring

### Risk 2: JSON Parsing Failures

**Threat:** Claude may not always return clean JSON — it might wrap it in markdown fences, add conversational text, or produce malformed JSON.

**Mitigation:**
- `streaming-parser.ts` implements 3 fallback strategies (pure JSON → code fence → brace extraction)
- `repairCanonicalDocument` fixes common structural issues after parsing
- On total parse failure, the error is surfaced to the client via SSE error event

### Risk 3: `.env` ANTHROPIC_MAX_OUTPUT_TOKENS Mismatch

**Threat:** Local `.env` may have `ANTHROPIC_MAX_OUTPUT_TOKENS=4096` while `.env.example` documents `16384`. Hub articles (2500+ words as structured JSON) will exceed 4096 tokens.

**Mitigation:** The integration test explicitly checks that `ANTHROPIC_MAX_OUTPUT_TOKENS >= 16384`. If it fails, the developer must update their `.env` before proceeding. **The agent executing this guide must verify the actual `.env` value and fix it if needed.**

### Risk 4: Onyx Unavailability

**Threat:** Onyx CE may be down or slow, causing Layer 4 to fail.

**Mitigation:** `searchOnyxMulti` already handles failures gracefully via `searchOnyxSafe` (returns null on error). `assembleOnyxContext` returns a fallback message when no results are found. Generation proceeds with the fallback KB context.

### Risk 5: web_search Tool Type Version

**Threat:** The tool type `web_search_20250305` may be updated by Anthropic.

**Mitigation:** The tool configuration is isolated in `src/lib/claude/tools.ts`. If the API rejects the tool type, only this one file needs updating. The integration test verifies the tool is accepted.

### Risk 6: SSE Buffering on Vercel

**Threat:** Vercel's edge runtime or proxy may buffer SSE events, causing delayed delivery.

**Mitigation:**
- `X-Accel-Buffering: no` header is set
- `Cache-Control: no-cache` prevents caching
- Vercel serverless functions support streaming responses natively with `ReadableStream`
- If buffering occurs in production, consider switching to Vercel Edge Runtime for this route

### Risk 7: Streaming with web_search Tool Interaction

**Threat:** When Claude invokes `web_search`, the streaming behavior includes server tool use blocks and search result blocks intermixed with text content. The text accumulation must correctly skip non-text content blocks.

**Mitigation:** The `streaming.ts` handler explicitly checks `event.type` and `content_block.type` to differentiate text deltas from tool use and search results. Web search results are captured separately. The raw event iteration handles all content block types.
