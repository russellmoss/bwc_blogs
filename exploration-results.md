# Exploration Results — Guide 6: Split-Pane UI + Chat Mode

**Date:** 2026-03-02
**Prepared by:** Build-guide exploration team (code-inspector, integration-verifier, pattern-finder)
**Source files:** `code-inspector-findings.md`, `integration-verifier-findings.md`, `pattern-finder-findings.md`

---

## 1. Current Build State

### Guides Complete: 1 through 5 (Foundation → Orchestration Layer)

| Category | Count | Details |
|---|---|---|
| Prisma models | 9 | users, content_map, article_documents, article_html, internal_links, photos, article_photos, leads, lead_events |
| API routes | 15 | health, auth, users (2), content-map (3), onyx (2), articles (3: generate/render/validate), links/verify |
| Type files | 11 | article, api, auth, claude, content-map, renderer, qa, photo, onyx, next-auth.d.ts, index |
| Lib modules | 9 dirs | auth, db, orchestration, renderer, claude, prompt-assembly, article-schema, onyx, content-map |
| Components | 0 | `src/components/` does not exist |
| DB rows | 50 | 1 user, 39 content_map, 10 internal_links; article_documents and article_html empty |

### Integration Health: All Services Connected and Verified

| Service | Status | Response Time |
|---|---|---|
| Neon Postgres | PASS | ~800ms (tsx startup overhead) |
| Onyx RAG | PASS | 95ms health / 179ms search |
| Claude API | PASS | ~1.5s, SSE streaming + web_search confirmed |
| Cloudinary | PASS | 244ms API / 160ms CDN |
| Vercel (deployed) | PASS | 197ms, all env flags true |
| npm run build | PASS | 4.6s, 15 routes, zero errors |
| TypeScript (tsc --noEmit) | PASS | Zero errors |
| ESLint | PASS | 0 errors (1 warning in untracked scratch file) |

---

## 2. Next Guide Target

### Guide 6: Split-Pane UI + Chat Mode — CRITICAL

**From orchestration doc §7:**
> What it builds: The primary user interface — the split-pane layout with conversation on the left and live rendered preview on the right.
> Why it's critical: This is the product. Everything built in Guides 1–5 is invisible backend infrastructure. Guide 6 is where the user first sees the system work.

**Milestone:** M3 — "Product is real." Open the app, generate an article, see it render live in the preview.

**Architecture doc sections to reference:**
- §3C View 1: Chat Interface + Live Preview (lines 576–769) — complete UI spec with ASCII mockups
- §3C Three Editing Modes (lines 634–742) — mode switching, toolbar layout
- §8 Phase 2 (lines 2675–2700) — deliverable description

### File Ownership (orchestration doc §5E)

Guide 6 owns:
- `src/app/(dashboard)/page.tsx` — main app shell (replace placeholder)
- `src/app/(dashboard)/layout.tsx` — authenticated layout (**must create**)
- `src/components/chat/` — ChatPanel, MessageList, MessageInput, StreamingMessage
- `src/components/preview/` — PreviewPanel, PreviewIframe, PreviewToolbar, HtmlSourceView
- `src/components/layout/` — SplitPane, AppShell, ArticleSelector

### What Guide 6 Produces
- 12 new files (1 layout + 11 components)
- Client-side state management (Zustand store)
- SSE stream consumer for `/api/articles/generate`
- Iframe-based preview with isolated BWC brand CSS
- Article selector populated from content map API
- Streaming message display in chat panel

---

## 3. Dependencies Satisfied

### Shared Contracts — All Present

| Contract | Status | Location | Fields |
|---|---|---|---|
| `CanonicalArticleDocument` | EXISTS | `src/types/article.ts` | 22 fields fully defined |
| `GenerateArticleRequest` | EXISTS | `src/types/claude.ts` | articleId, userMessage, conversationHistory, currentDocument, photoManifest |
| `GenerateArticleResponse` | EXISTS | `src/types/claude.ts` | document, html, validationResult, conversationReply, tokensUsed, webSearchResults |
| `ConversationMessage` | EXISTS | `src/types/claude.ts` | role (user\|assistant), content, timestamp |
| `StreamEvent` / `StreamEventType` | EXISTS | `src/types/claude.ts` | 7 event types: status, text_delta, web_search, document, validation, complete, error |
| `ContentMapEntry` | EXISTS | `src/types/content-map.ts` | 25 fields (id, title, slug, articleType, status, etc.) |
| `RendererInput` / `RendererOutput` | EXISTS | `src/types/renderer.ts` | document + htmlOverrides + templateVersion → html + metadata + wordCount |
| `ValidationResult` | EXISTS | `src/types/api.ts` | valid, errors[], warnings[] |
| `ErrorCode` | EXISTS | `src/types/api.ts` | 11 typed error codes |

### Library Modules — All Present

| Module | Status | Entry Point | Key Export |
|---|---|---|---|
| Orchestration | EXISTS | `src/lib/orchestration/orchestrator.ts` | `generateArticle(request, onEvent)` — 5-step pipeline |
| Renderer | EXISTS | `src/lib/renderer/renderer.ts` | `renderArticle(input): RendererOutput` — pure sync function |
| Compiled Template | EXISTS | `src/lib/renderer/compiled-template.ts` | `STYLE_BLOCK`, `GOOGLE_FONTS_HTML`, `TEMPLATE_VERSION` ("2026.1") |
| Claude Client | EXISTS | `src/lib/claude/streaming.ts` | `streamGeneration()` |
| Auth Session | EXISTS | `src/lib/auth/session.ts` | `getSession()`, `getCurrentUser()`, `requireRole()` |
| Auth Config | EXISTS | `src/lib/auth/config.ts` | NextAuth v4 config |
| Article Schema | EXISTS | `src/lib/article-schema/` | `validateCanonicalDocument()`, `repairCanonicalDocument()` |

### API Routes — All Present

| Route | Method | Auth | Response Format |
|---|---|---|---|
| `/api/articles/generate` | POST (SSE) | admin, editor | text/event-stream with 7 event types |
| `/api/articles/render` | POST | admin, editor | `{ success, data: { html, metadata } }` |
| `/api/articles/validate` | POST | admin, editor | `{ success, data: ValidationResult }` |
| `/api/content-map` | GET | admin, editor, viewer | `{ success, data: ContentMapEntry[] }` |
| `/api/content-map/[id]` | GET | admin, editor, viewer | `{ success, data: ContentMapEntry }` |
| `/api/auth/[...nextauth]` | GET, POST | public | NextAuth v4 handler |

### Database — Seeded and Ready

| Table | Rows | Guide 6 Usage |
|---|---|---|
| users | 1 | Auth session verification |
| content_map | 39 | ArticleSelector dropdown (8 hubs + 31 spokes) |
| internal_links | 10 | Not directly queried by Guide 6 UI |
| article_documents | 0 | Not used in Guide 6 (persistence is Guide 11) |
| article_html | 0 | Not used in Guide 6 |

---

## 4. Dependencies Missing or Mismatched

### 4A. NPM Packages — Must Install Before Coding

```bash
npm install react-resizable-panels lucide-react zustand
```

| Package | Purpose | Notes |
|---|---|---|
| `react-resizable-panels` | Split-pane resize functionality | Architecture doc specifies this library |
| `lucide-react` | Icon library (Send, Copy, Eye, Code, Undo, Check, etc.) | Standard React icon set |
| `zustand` | Client-side state management | Lightweight, TypeScript-native; Guide 6 sets the state management precedent |

### 4B. Missing Files — All Must Be Created

| File | Purpose |
|---|---|
| `src/app/(dashboard)/layout.tsx` | **CRITICAL** — authenticated layout with SessionProvider |
| `src/components/layout/AppShell.tsx` | Header bar with logo, title, article selector |
| `src/components/layout/SplitPane.tsx` | react-resizable-panels wrapper |
| `src/components/layout/ArticleSelector.tsx` | Dropdown populated from GET /api/content-map |
| `src/components/chat/ChatPanel.tsx` | Left pane — SSE consumer, generation state owner |
| `src/components/chat/MessageList.tsx` | Scrollable message history with auto-scroll |
| `src/components/chat/MessageInput.tsx` | Textarea + send button |
| `src/components/chat/StreamingMessage.tsx` | Real-time streaming text with typing indicator |
| `src/components/preview/PreviewPanel.tsx` | Right pane container |
| `src/components/preview/PreviewIframe.tsx` | `<iframe srcDoc={html}>` with BWC brand CSS isolation |
| `src/components/preview/PreviewToolbar.tsx` | Mode toggles, Copy HTML, viewport toggle |
| `src/components/preview/HtmlSourceView.tsx` | Raw HTML source display |

### 4C. Missing Type Definitions

Guide 6 should create `src/types/ui.ts`:

```typescript
export type PreviewMode = 'preview' | 'html';
export type ViewportMode = 'desktop' | 'mobile';
export type EditingMode = 'chat' | 'canvas' | 'html';

export interface ArticleEditorState {
  // Article selection
  selectedArticleId: number | null;
  selectedArticle: ContentMapEntry | null;

  // Generation state
  isGenerating: boolean;
  streamingText: string;
  statusMessage: string;

  // Document state
  currentDocument: CanonicalArticleDocument | null;
  currentHtml: string;
  validationResult: ValidationResult | null;

  // Conversation
  conversationHistory: ConversationMessage[];

  // UI state
  previewMode: PreviewMode;
  viewportMode: ViewportMode;
  editingMode: EditingMode;
}
```

### 4D. Critical Gap: Missing SessionProvider

`src/app/layout.tsx` (root layout) has **no SessionProvider** from `next-auth/react`. Client components calling `useSession()` will fail silently. Guide 6 MUST wrap the dashboard layout in SessionProvider.

### 4E. Critical Gap: Middleware Not Active

`src/proxy.ts` was renamed from `src/middleware.ts` (commit `45be677: chore: rename middleware to proxy and stabilize build`). Next.js only recognizes `src/middleware.ts` or root `middleware.ts` — `src/proxy.ts` is **not active as middleware**.

**Action:** Guide 6's `(dashboard)/layout.tsx` MUST include server-side auth check (`getCurrentUser()` + redirect to `/login`) as the primary auth guard. Do not rely on middleware.

### 4F. Date Field Mismatch in ContentMapEntry

TypeScript types `scheduledDate` and `publishedDate` are typed as `Date | null`, but the API serializes them as ISO strings. The ArticleSelector component must treat these as `string | null`.

### 4G. Template Version Drift

The render API's Zod schema defaults `templateVersion` to `"1.0"`, but the actual constant is `TEMPLATE_VERSION = "2026.1"`. Guide 6 must **always import and pass `TEMPLATE_VERSION` explicitly** from `@/lib/renderer`.

---

## 5. Established Patterns to Follow

### 5A. API Route Handler Pattern (Consistency: HIGH)

Template from `src/app/api/content-map/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const RequestSchema = z.object({ /* fields */ });

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");        // 1. Auth FIRST
    const body = await request.json();            // 2. Parse body
    const parsed = RequestSchema.safeParse(body); // 3. safeParse (never .parse)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR",
          message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    // 4. Business logic
    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 });
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required" } },
        { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 });
  }
}
```

### 5B. SSE Streaming Pattern (CRITICAL — Guide 6 must consume this)

**Server side** (`src/app/api/articles/generate/route.ts`):
- Uses `new Response(ReadableStream, headers)` — NOT `NextResponse`
- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`
- Wire format: `event: {type}\ndata: {JSON}\n\n`
- Pre-stream auth failures return JSON (not SSE) — client must check `response.ok` before reading stream

**SSE Event Sequence (11 events in order):**
1. `status` — `{ message: "Assembling system prompt..." }`
2. `status` — `{ message: "System prompt assembled (N layers, ~N tokens)" }`
3. `status` — `{ message: "Calling Claude API..." }`
4. `text_delta` — `{ text: "partial text" }` (MANY events, real-time Claude output)
5. `web_search` — `{ query: "search query" }` (0 or more if ENABLE_WEB_SEARCH=true)
6. `status` — `{ message: "Claude response complete (N input, N output tokens)" }`
7. `status` — `{ message: "Parsing response..." }`
8. `document` — full `CanonicalArticleDocument` (parsed, before repair/validation)
9. `status` — `{ message: "Running validation and rendering..." }`
10. `validation` — `{ valid: boolean, errors: [...], warnings: [...] }`
11. `complete` — full `GenerateArticleResponse` `{ document, html, validationResult, conversationReply, tokensUsed, webSearchResults }`

On error at any point: `error` event with `{ code: ErrorCode, message: string }`, then stream closes.

**Client-side consumption pattern** (MUST use fetch, NOT EventSource — POST body required):

```typescript
const response = await fetch("/api/articles/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestPayload),
});

// Pre-stream errors come as JSON, NOT SSE
if (!response.ok) {
  const errorData = await response.json();
  // Handle { success: false, error: { code, message } }
  return;
}

// Consume SSE stream
const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split("\n\n");
  buffer = parts.pop() ?? "";
  for (const part of parts) {
    const lines = part.split("\n");
    let eventType = "", data = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) eventType = line.slice(7);
      if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (eventType && data) {
      handleEvent(eventType as StreamEventType, JSON.parse(data));
    }
  }
}
```

**Event handling map for ChatPanel:**

| Event | UI Action |
|---|---|
| `status` | `setStatusMessage(data.message)` — show in chat as system message |
| `text_delta` | `appendStreamingText(data.text)` — append into streaming bubble |
| `web_search` | Show "Searching: {query}" indicator |
| `document` | Intermediate doc — can render live preview with `renderArticle()` |
| `validation` | `setValidationResult(data)` — store for toolbar badge |
| `complete` | Extract `{ document, html, conversationReply }`. Set `currentDocument` + `currentHtml`. Push user + assistant `ConversationMessage`s to history. Clear streaming state. Set `isGenerating = false` |
| `error` | Show error message in chat. Set `isGenerating = false` |

### 5C. Renderer Usage Pattern

```typescript
import { renderArticle, TEMPLATE_VERSION } from "@/lib/renderer";
import type { RendererInput } from "@/types/renderer";

const input: RendererInput = {
  document: canonicalDoc,
  htmlOverrides: null,       // null for Guide 6 (Canvas Edit is Guide 7)
  templateVersion: TEMPLATE_VERSION,  // "2026.1" — ALWAYS use constant
};

const result = renderArticle(input);
// result.html = complete <!DOCTYPE html> document — use as iframe srcDoc
```

**Renderer output is a complete standalone HTML document** with:
- Google Fonts preconnect + link tags
- Full BWC_STYLESHEET (363 lines) embedded in `<style>`
- JSON-LD schema blocks
- `data-cad-path` attributes on all editable elements
- All BEM components scoped to `.bwc-article` / `.blog-content`

### 5D. Iframe CSS Isolation Strategy

```tsx
<iframe
  srcDoc={currentHtml}
  className="w-full h-full border-0"
  title="Article preview"
  sandbox="allow-same-origin"
/>
```

- `srcDoc` creates a separate document context — **zero CSS leakage** between dashboard Tailwind and BWC brand styles
- `allow-same-origin` is required for Google Fonts CDN requests to load inside the iframe
- No additional style injection needed — renderer output is self-contained
- For mobile preview toggle: set iframe container width to `375px`; for desktop: `100%`

### 5E. Auth Patterns

**Server components (dashboard layout):**
```typescript
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const user = await getCurrentUser();
if (!user) redirect("/login");
```

**Client components (after SessionProvider):**
```typescript
"use client";
import { useSession } from "next-auth/react";

const { data: session } = useSession();
// session.user: { id: string, email: string, name: string, role: string }
```

**Dashboard layout must include SessionProvider:**
```tsx
// src/app/(dashboard)/layout.tsx
import { SessionProvider } from "next-auth/react";
```

### 5F. Type Import Convention

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { StreamEvent, StreamEventType, GenerateArticleRequest, ConversationMessage } from "@/types/claude";
import type { RendererOutput } from "@/types/renderer";
import type { ContentMapEntry } from "@/types/content-map";
import type { ValidationResult } from "@/types/api";
```

Always import from specific files, never from barrel `@/types/index.ts`.
Always use `import type` for type-only imports.

### 5G. CSS/Styling Convention

- Tailwind v4 with `@import "tailwindcss"` syntax (NOT v3 `@tailwind` directives)
- No `tailwind.config.js` — CSS-based config via `@theme` blocks in `globals.css`
- Existing pages use inline Tailwind with raw hex values: `text-[#bc9b5d]`, `bg-[#fcf8ed]`
- Dashboard fonts: Geist Sans + Geist Mono (from root layout `next/font/google`)
- No component library installed — all UI built with Tailwind utilities

### 5H. Error Response Handling Pattern

```typescript
// Frontend error handling for API calls
const response = await fetch("/api/content-map");
const data = await response.json();

if (!data.success) {
  // data.error: { code: ErrorCode, message: string, details?: unknown }
  showError(data.error.message);
  return;
}

// data.data is the typed result
const entries: ContentMapEntry[] = data.data;
```

Error codes from `src/types/api.ts`: `AUTH_REQUIRED` (401), `AUTH_FORBIDDEN` (403), `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `GENERATION_FAILED` (500), `ONYX_UNAVAILABLE` (503), `RENDER_ERROR` (500), `QA_GATE_FAILED` (422), `CLOUDINARY_ERROR` (500), `LINK_VERIFICATION_FAILED` (422), `INTERNAL_ERROR` (500).

---

## 6. Integration Readiness

| Service | Guide 6 Usage | Status | Notes |
|---|---|---|---|
| Claude API (via `/api/articles/generate`) | SSE streaming generation | VERIFIED | POST body: articleId + userMessage; returns 7 event types |
| Renderer (via `renderArticle()`) | Produce iframe HTML from CanonicalArticleDocument | VERIFIED | Pure sync function, self-contained HTML output |
| Content Map API | Populate article selector dropdown | VERIFIED | 39 entries available, ordered by createdAt desc |
| NextAuth v4 | Session-based dashboard access | VERIFIED | JWT strategy, 30-day maxAge, login page at /login |
| Neon Postgres | Auth session + content map queries | VERIFIED | All tables present, seeded data correct |

**Known quirks:**
- Onyx can be slow on cold start (4GB droplet) — the orchestrator has 10s timeout + retry. This affects generation latency, not the UI directly.
- Claude streaming can take 15-30s for full article generation — the UI must show progress via `status` events and `text_delta` streaming.
- The `complete` event's `html` field is the final rendered HTML. The `document` event's intermediate doc can also be rendered client-side for a live preview during generation.
- The generate route expects `articleId` (a `contentMap.id`), not a content map slug. The frontend must fetch the content map list, let the user pick an entry, and pass its `id`.

---

## 7. Risks and Blockers

### No Blockers. All services pass. Guide 6 can proceed.

### Risks (LOW severity):

| Risk | Impact | Mitigation |
|---|---|---|
| Middleware not active (`src/proxy.ts` not recognized) | Dashboard routes theoretically unprotected at middleware level | Guide 6's layout.tsx includes server-side `getCurrentUser()` + `redirect("/login")` as primary auth guard |
| Date field serialization mismatch (`Date` vs `string`) | ArticleSelector could display "[object Object]" for dates | Treat `scheduledDate`/`publishedDate` as `string \| null` in UI code |
| Template version drift (Zod default "1.0" vs actual "2026.1") | Renderer could use wrong template version | Always import `TEMPLATE_VERSION` constant from `@/lib/renderer` |
| No article save/persistence route | Work lost on browser refresh | Expected — persistence is Guide 11 scope. Could warn user before navigating away |
| First frontend guide — no component patterns to follow | Inconsistency risk for Guides 7-10 | Establish clean patterns in Guide 6 that downstream guides can copy |
| No `GET /api/articles/[id]` route | Cannot load previously saved drafts | Not needed in Guide 6 (all state is in-memory); Guide 11 will add this |

### Non-blocking issues:
- Prisma `package.json#prisma` config deprecated — will break in Prisma 7. Not a Guide 6 concern.
- `AUTH_FORBIDDEN` error message says "Admin access required" even when editors are allowed — consistently misleading across all routes, do not introduce a different variant.

---

## 8. Deviations from Orchestration Doc Predictions

| Prediction (Orchestration Doc) | Actual Codebase | Impact on Guide 6 |
|---|---|---|
| Middleware at `src/middleware.ts` | Renamed to `src/proxy.ts` (commit 45be677) | Must use server-side auth in layout instead of relying on middleware |
| `GenerateArticleRequest` in `src/types/api.ts` | Actually in `src/types/claude.ts` | Import from `@/types/claude`, not `@/types/api` |
| Root layout has SessionProvider | No SessionProvider anywhere | Guide 6 dashboard layout must add SessionProvider |
| `src/components/` exists with some structure | Directory does not exist at all | Guide 6 creates the entire component tree from scratch |
| Template version "1.0" | Actual constant is `TEMPLATE_VERSION = "2026.1"` | Always use `TEMPLATE_VERSION` import, never hardcode |
| `src/app/(dashboard)/layout.tsx` exists | Only `page.tsx` exists (placeholder) | Must create layout.tsx from scratch |
| Renderer can do incremental/partial rendering | Renderer is a pure synchronous function requiring a complete document | Use the `document` SSE event (full doc) to call `renderArticle()` for live preview during generation; stream `text_delta` events to a separate streaming text display |

---

## Summary

**Guide 6: Split-Pane UI + Chat Mode** is ready to build. All 5 prerequisite guides are complete. All backend services are connected and verified. All TypeScript types, API routes, and library modules that Guide 6 depends on exist and are working correctly.

**What needs to happen:**
1. Install 3 npm packages: `react-resizable-panels`, `lucide-react`, `zustand`
2. Create `src/types/ui.ts` for UI state types
3. Create `src/app/(dashboard)/layout.tsx` with SessionProvider + server-side auth guard
4. Create 11 component files across `src/components/{chat,preview,layout}/`
5. Replace the placeholder `src/app/(dashboard)/page.tsx` with the main app shell

**No new API routes needed.** Guide 6 is a pure frontend guide that consumes existing backend infrastructure.

**Key architectural decisions for the guide:**
- **State management:** Zustand (install as dependency, sets the pattern for all downstream guides)
- **CSS isolation:** iframe with `srcDoc` — renderer output is self-contained, zero leakage risk
- **SSE consumption:** `fetch()` + `ReadableStream` + manual SSE line parsing (not EventSource — POST required)
- **Auth guard:** Server-side `getCurrentUser()` + redirect in layout (middleware is inactive)
- **Live preview:** Call `renderArticle()` client-side when `document` SSE event arrives; show final HTML from `complete` event
