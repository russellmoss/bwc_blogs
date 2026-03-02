# Implementation Guide 6: Split-Pane UI + Chat Mode

**Guide type:** Critical-path implementation
**Depends on:** Guides 1, 4, 5 (all verified complete)
**Milestone:** M3 — "Product is real"
**Last updated:** 2026-03-02

---

## A. Objective

Build the primary user interface — a split-pane layout with a conversation panel on the left and a live rendered preview on the right. When this guide completes, a user can:

1. Log in and land on the authenticated dashboard
2. Select an article from the content map dropdown
3. Type a message and click "Generate"
4. Watch status updates stream into the chat panel in real time
5. See the fully styled BWC blog post appear in the preview iframe when the document arrives
6. View validation results (pass/fail badge) in the toolbar
7. Toggle between Desktop and Mobile viewport
8. Toggle between rendered Preview and raw HTML source view
9. Continue the conversation — iterate on the article with follow-up messages

This is the first time the product becomes visible. Everything in Guides 1–5 was invisible backend infrastructure.

---

## B. Scope

### In Scope
- Authenticated dashboard layout with `SessionProvider` and server-side auth guard
- Zustand state store for article editor state (`src/lib/store/article-store.ts`)
- UI type definitions (`src/types/ui.ts`)
- 11 component files across `src/components/{chat,preview,layout}/`
- SSE stream consumer using `fetch()` + `ReadableStream` (NOT EventSource)
- Iframe-based preview with full BWC brand CSS isolation via `srcDoc`
- Article selector dropdown populated from `GET /api/content-map`
- Streaming message display with status indicators
- Mobile/Desktop viewport toggle
- Preview/HTML source toggle
- Validation badge on toolbar
- Replace placeholder `src/app/(dashboard)/page.tsx`

### Out of Scope
- Canvas Edit mode, contenteditable injection, `data-cad-path` mapping (Guide 7)
- HTML editing with CodeMirror/Monaco (Guide 7)
- Undo/Redo system (Guide 7)
- QA Scorecard overlay and click-to-highlight (Guide 8)
- Photo Manager and Cloudinary upload UI (Guide 9)
- Content Map Dashboard table/hub views (Guide 10)
- Article persistence to database, finalization flow (Guide 11)
- Copy HTML / Download .html buttons (Guide 11 — no persistence yet)
- Finalize Article button (Guide 11)

---

## C. Depends On

| Guide | What This Guide Uses From It |
|---|---|
| 1 | `prisma` client, `getCurrentUser()` / `requireRole()`, `SessionUser` type, NextAuth config, `env.ts`, all `src/types/` |
| 4 | `renderArticle()`, `TEMPLATE_VERSION` from `@/lib/renderer`, `RendererInput` / `RendererOutput` types |
| 5 | `POST /api/articles/generate` (SSE streaming), `StreamEvent` / `StreamEventType` / `GenerateArticleRequest` / `GenerateArticleResponse` / `ConversationMessage` types |

All dependencies verified present and working (see `exploration-results.md` §3).

---

## D. Shared Contracts Referenced

### Types (from `src/types/`)
- `CanonicalArticleDocument` — `src/types/article.ts`
- `GenerateArticleRequest`, `GenerateArticleResponse`, `ConversationMessage`, `StreamEvent`, `StreamEventType` — `src/types/claude.ts`
- `ValidationResult`, `ErrorCode` — `src/types/api.ts`
- `ContentMapEntry` — `src/types/content-map.ts`
- `RendererInput`, `RendererOutput` — `src/types/renderer.ts`

### Library Modules
- `renderArticle`, `TEMPLATE_VERSION` — `@/lib/renderer`
- `getCurrentUser` — `@/lib/auth/session`

### API Routes (consumed, not created)
- `GET /api/content-map` — returns `{ success: true, data: ContentMapEntry[] }`
- `POST /api/articles/generate` — SSE stream with 7 event types

### Architecture Doc References
- §3C View 1 (line 576): Chat Interface + Live Preview — full ASCII mockup and UX spec
- §3C Three Editing Modes (line 634): Toolbar layout, mode switching
- §8 Phase 2 (line 2675): Deliverable description

---

## E. Existing Constraints to Preserve

1. **`npm run build` must continue to pass** with zero errors after every step
2. **All 13 existing API routes** must remain functional — this guide creates NO new routes
3. **Do not modify** files owned by Guides 1–5 except:
   - `src/types/index.ts` — add re-export for new `ui.ts` file
4. **Import conventions**: `@/` path alias, `import type` for type-only imports, import from specific type files (not barrel)
5. **Error pattern**: `{ success: false, error: { code, message } }` — check `data.success` on API responses
6. **File naming**: kebab-case files, PascalCase components, camelCase functions
7. **Styling**: Tailwind v4 utilities with inline hex values for BWC brand colors (e.g., `text-[#bc9b5d]`, `bg-[#fcf8ed]`)
8. **Root layout** (`src/app/layout.tsx`): Do NOT modify. Dashboard gets its own layout.
9. **Middleware is inactive** (`src/proxy.ts` not recognized by Next.js). Auth guard must be server-side in layout.

---

## F. Files Created / Modified

### New Files (14 total)

| File | Purpose |
|---|---|
| `src/types/ui.ts` | UI state types: `PreviewMode`, `ViewportMode`, `EditingMode`, `ArticleEditorState` |
| `src/lib/store/article-store.ts` | Zustand store implementing `ArticleEditorState` with actions |
| `src/app/(dashboard)/layout.tsx` | Authenticated layout: server-side auth guard + SessionProvider wrapper |
| `src/components/layout/AppShell.tsx` | Header bar: BWC logo, title, ArticleSelector |
| `src/components/layout/SplitPane.tsx` | `react-resizable-panels` wrapper — left chat, right preview |
| `src/components/layout/ArticleSelector.tsx` | Dropdown populated from `GET /api/content-map` |
| `src/components/chat/ChatPanel.tsx` | Left pane: SSE consumer, message list, input, streaming state |
| `src/components/chat/MessageList.tsx` | Scrollable message history with auto-scroll |
| `src/components/chat/MessageInput.tsx` | Textarea + Send button, disabled during generation |
| `src/components/chat/StreamingMessage.tsx` | Real-time streaming text display with typing indicator |
| `src/components/preview/PreviewPanel.tsx` | Right pane container: toolbar + content area |
| `src/components/preview/PreviewIframe.tsx` | `<iframe srcDoc={html}>` with BWC CSS isolation |
| `src/components/preview/PreviewToolbar.tsx` | Preview/HTML toggle, Desktop/Mobile toggle, validation badge |
| `src/components/preview/HtmlSourceView.tsx` | Syntax-highlighted raw HTML display |

### Modified Files (2)

| File | Change |
|---|---|
| `src/types/index.ts` | Add `export * from "./ui"` re-export |
| `src/app/(dashboard)/page.tsx` | Replace placeholder with main app shell |

---

## G. Technical Design

### G1. UI State Architecture (Zustand)

The Zustand store is the single source of truth for the article editor. All 11 components read from and write to this store. No prop drilling beyond the top-level page.

```typescript
// src/types/ui.ts
export type PreviewMode = "preview" | "html";
export type ViewportMode = "desktop" | "mobile";
export type EditingMode = "chat" | "canvas" | "html";

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

export interface ArticleEditorActions {
  // Article selection
  setSelectedArticle: (article: ContentMapEntry | null) => void;

  // Generation
  startGeneration: () => void;
  appendStreamingText: (text: string) => void;
  setStatusMessage: (message: string) => void;
  setDocument: (doc: CanonicalArticleDocument) => void;
  setCurrentHtml: (html: string) => void;
  setValidationResult: (result: ValidationResult) => void;
  completeGeneration: (response: GenerateArticleResponse) => void;
  failGeneration: (error: string) => void;

  // Conversation
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;

  // UI toggles
  setPreviewMode: (mode: PreviewMode) => void;
  setViewportMode: (mode: ViewportMode) => void;
  setEditingMode: (mode: EditingMode) => void;

  // Reset
  resetEditor: () => void;
}
```

### G2. SSE Stream Consumer

The ChatPanel owns the SSE consumption lifecycle. It uses `fetch()` + `ReadableStream` (not EventSource — POST body is required).

**Flow:**
1. User types message → ChatPanel calls `startGeneration()` on store
2. ChatPanel fires `fetch("/api/articles/generate", { method: "POST", body })``
3. If `!response.ok` → parse JSON error, call `failGeneration()`, return
4. Read stream with `response.body.getReader()` + `TextDecoder`
5. Parse SSE wire format: `event: {type}\ndata: {JSON}\n\n`
6. Dispatch events to store actions:

| SSE Event | Store Action | UI Effect |
|---|---|---|
| `status` | `setStatusMessage(data.message)` | Status text in chat panel |
| `text_delta` | `appendStreamingText(data.text)` | Streaming text bubble |
| `web_search` | `setStatusMessage("Searching: " + data.query)` | Search indicator |
| `document` | `setDocument(data)` + client-side `renderArticle()` → `setCurrentHtml()` | Live preview updates mid-stream |
| `validation` | `setValidationResult(data)` | Toolbar badge updates |
| `complete` | `completeGeneration(data)` | Final doc + HTML saved to store, conversation updated, streaming cleared |
| `error` | `failGeneration(data.message)` | Error shown in chat, UI unlocked |

### G3. Iframe CSS Isolation

The renderer output is a complete self-contained HTML document (`<!DOCTYPE html>` with embedded `<style>` block containing the full BWC stylesheet and Google Fonts). Using `<iframe srcDoc={html}>`:

- Dashboard Tailwind CSS has **zero** impact on iframe content
- BWC brand fonts (Cormorant Garamond, Fraunces, Nunito Sans, Trirong) load inside the iframe via Google Fonts CDN
- `sandbox="allow-same-origin"` is required for font CDN requests
- No additional style injection needed

**Viewport toggle:** Set iframe container width to `375px` for mobile, `100%` for desktop.

### G4. Component Tree

```
(dashboard)/page.tsx
  └── AppShell
      ├── Header
      │   ├── BWC Logo + "Content Engine" title
      │   └── ArticleSelector (dropdown from /api/content-map)
      └── SplitPane (react-resizable-panels)
          ├── Left: ChatPanel
          │   ├── MessageList
          │   │   ├── MessageBubble (user messages)
          │   │   ├── MessageBubble (assistant messages)
          │   │   └── StreamingMessage (during generation)
          │   └── MessageInput (textarea + send)
          └── Right: PreviewPanel
              ├── PreviewToolbar
              │   ├── Preview/HTML toggle
              │   ├── Desktop/Mobile toggle
              │   └── Validation badge
              └── Content
                  ├── PreviewIframe (when mode = preview)
                  └── HtmlSourceView (when mode = html)
```

### G5. Auth Architecture

Since middleware is inactive (`src/proxy.ts`), the dashboard layout implements a dual-layer auth guard:

**Layer 1 — Server component (layout.tsx):**
```typescript
const user = await getCurrentUser();
if (!user) redirect("/login");
```
This runs on every navigation to any `(dashboard)/*` route.

**Layer 2 — Client-side SessionProvider:**
The layout wraps children in `<SessionProvider>` so client components can use `useSession()` to access `session.user.name`, `session.user.role`, etc.

**Architecture note:** The layout must split into a server component (auth check) and a client component (SessionProvider). Next.js App Router requires this because `SessionProvider` uses React Context (client-only), but `getCurrentUser()` uses `getServerSession()` (server-only).

---

## H. Step-by-Step Execution Plan

### Step 1: Install Dependencies

```bash
npm install react-resizable-panels lucide-react zustand
```

**Verify:** `npm run build` still passes. Check `package.json` shows all three in `dependencies`.

---

### Step 2: Create UI Type Definitions

Create `src/types/ui.ts`:

```typescript
import type { CanonicalArticleDocument } from "./article";
import type { ConversationMessage, GenerateArticleResponse } from "./claude";
import type { ContentMapEntry } from "./content-map";
import type { ValidationResult } from "./api";

// === UI Mode Types ===

export type PreviewMode = "preview" | "html";
export type ViewportMode = "desktop" | "mobile";
export type EditingMode = "chat" | "canvas" | "html";

// === Article Editor State ===

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

export interface ArticleEditorActions {
  // Article selection
  setSelectedArticle: (article: ContentMapEntry | null) => void;

  // Generation
  startGeneration: () => void;
  appendStreamingText: (text: string) => void;
  setStatusMessage: (message: string) => void;
  setDocument: (doc: CanonicalArticleDocument) => void;
  setCurrentHtml: (html: string) => void;
  setValidationResult: (result: ValidationResult) => void;
  completeGeneration: (response: GenerateArticleResponse) => void;
  failGeneration: (error: string) => void;

  // Conversation
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;

  // UI toggles
  setPreviewMode: (mode: PreviewMode) => void;
  setViewportMode: (mode: ViewportMode) => void;
  setEditingMode: (mode: EditingMode) => void;

  // Reset
  resetEditor: () => void;
}
```

Update `src/types/index.ts` — add one line:

```typescript
export * from "./ui";
```

**Verify:** `npx tsc --noEmit` passes.

---

### Step 3: Create Zustand Store

Create directory `src/lib/store/` and file `src/lib/store/article-store.ts`:

```typescript
import { create } from "zustand";
import type { CanonicalArticleDocument } from "@/types/article";
import type { ConversationMessage, GenerateArticleResponse } from "@/types/claude";
import type { ContentMapEntry } from "@/types/content-map";
import type { ValidationResult } from "@/types/api";
import type {
  ArticleEditorState,
  ArticleEditorActions,
  PreviewMode,
  ViewportMode,
  EditingMode,
} from "@/types/ui";

const initialState: ArticleEditorState = {
  selectedArticleId: null,
  selectedArticle: null,
  isGenerating: false,
  streamingText: "",
  statusMessage: "",
  currentDocument: null,
  currentHtml: "",
  validationResult: null,
  conversationHistory: [],
  previewMode: "preview",
  viewportMode: "desktop",
  editingMode: "chat",
};

export const useArticleStore = create<ArticleEditorState & ArticleEditorActions>(
  (set) => ({
    ...initialState,

    // Article selection
    setSelectedArticle: (article: ContentMapEntry | null) =>
      set({
        selectedArticle: article,
        selectedArticleId: article?.id ?? null,
        // Reset document state when switching articles
        currentDocument: null,
        currentHtml: "",
        validationResult: null,
        conversationHistory: [],
        streamingText: "",
        statusMessage: "",
        isGenerating: false,
      }),

    // Generation
    startGeneration: () =>
      set({
        isGenerating: true,
        streamingText: "",
        statusMessage: "Starting generation...",
      }),

    appendStreamingText: (text: string) =>
      set((state) => ({
        streamingText: state.streamingText + text,
      })),

    setStatusMessage: (message: string) =>
      set({ statusMessage: message }),

    setDocument: (doc: CanonicalArticleDocument) =>
      set({ currentDocument: doc }),

    setCurrentHtml: (html: string) =>
      set({ currentHtml: html }),

    setValidationResult: (result: ValidationResult) =>
      set({ validationResult: result }),

    completeGeneration: (response: GenerateArticleResponse) =>
      set((state) => ({
        isGenerating: false,
        streamingText: "",
        statusMessage: "",
        currentDocument: response.document,
        currentHtml: response.html,
        validationResult: response.validationResult,
        conversationHistory: [
          ...state.conversationHistory,
          {
            role: "assistant" as const,
            content: response.conversationReply,
            timestamp: new Date().toISOString(),
          },
        ],
      })),

    failGeneration: (error: string) =>
      set((state) => ({
        isGenerating: false,
        streamingText: "",
        statusMessage: "",
        conversationHistory: [
          ...state.conversationHistory,
          {
            role: "assistant" as const,
            content: `Error: ${error}`,
            timestamp: new Date().toISOString(),
          },
        ],
      })),

    // Conversation
    addUserMessage: (content: string) =>
      set((state) => ({
        conversationHistory: [
          ...state.conversationHistory,
          {
            role: "user" as const,
            content,
            timestamp: new Date().toISOString(),
          },
        ],
      })),

    addAssistantMessage: (content: string) =>
      set((state) => ({
        conversationHistory: [
          ...state.conversationHistory,
          {
            role: "assistant" as const,
            content,
            timestamp: new Date().toISOString(),
          },
        ],
      })),

    // UI toggles
    setPreviewMode: (mode: PreviewMode) => set({ previewMode: mode }),
    setViewportMode: (mode: ViewportMode) => set({ viewportMode: mode }),
    setEditingMode: (mode: EditingMode) => set({ editingMode: mode }),

    // Reset
    resetEditor: () => set(initialState),
  })
);
```

**Verify:** `npx tsc --noEmit` passes.

---

### Step 4: Create Dashboard Layout (Auth Guard + SessionProvider)

Create `src/app/(dashboard)/layout.tsx`.

This file must handle the server/client split. Next.js App Router requires server components for `getServerSession()` and client components for `SessionProvider`. The pattern is a server layout that checks auth + a client wrapper for the provider.

```typescript
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DashboardProviders } from "./providers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <DashboardProviders>{children}</DashboardProviders>;
}
```

Create `src/app/(dashboard)/providers.tsx` (client component):

```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**Verify:** `npx tsc --noEmit` passes. `npm run build` passes.

---

### Step 5: Create Layout Components

#### 5A. Create `src/components/layout/ArticleSelector.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";
import type { ContentMapEntry } from "@/types/content-map";

export function ArticleSelector() {
  const [articles, setArticles] = useState<ContentMapEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { selectedArticle, setSelectedArticle } = useArticleStore();

  useEffect(() => {
    async function fetchArticles() {
      try {
        const response = await fetch("/api/content-map");
        const data = await response.json();
        if (data.success) {
          setArticles(data.data);
        }
      } catch {
        // Silently fail — dropdown will be empty
      } finally {
        setIsLoading(false);
      }
    }
    fetchArticles();
  }, []);

  const articleTypeLabel = (type: string) => {
    switch (type) {
      case "hub": return "Hub";
      case "spoke": return "Spoke";
      case "news": return "News";
      default: return type;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-[#cccccc] rounded-md hover:border-[#bc9b5d] transition-colors min-w-[260px]"
        disabled={isLoading}
      >
        <span className="truncate text-left flex-1 text-[#242323]">
          {isLoading
            ? "Loading articles..."
            : selectedArticle
              ? selectedArticle.title
              : "Select an article..."}
        </span>
        <ChevronDown className="w-4 h-4 text-[#414141] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-[400px] max-h-[400px] overflow-y-auto bg-white border border-[#cccccc] rounded-md shadow-lg z-50">
          {articles.map((article) => (
            <button
              key={article.id}
              onClick={() => {
                setSelectedArticle(article);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-[#fcf8ed] border-b border-[#e8e6e6] last:border-b-0 ${
                selectedArticle?.id === article.id ? "bg-[#fcf8ed]" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[#e8e6e6] text-[#414141]">
                  {articleTypeLabel(article.articleType)}
                </span>
                <span className="text-sm font-medium text-[#242323] truncate">
                  {article.title}
                </span>
              </div>
              <div className="text-xs text-[#414141] mt-0.5 truncate">
                {article.hubName} &middot; {article.status}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
```

#### 5B. Create `src/components/layout/AppShell.tsx`

```tsx
"use client";

import { ArticleSelector } from "./ArticleSelector";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="h-14 border-b border-[#e8e6e6] flex items-center px-4 gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg font-serif font-semibold text-[#bc9b5d]">
            BWC
          </span>
          <span className="text-sm text-[#414141]">Content Engine</span>
        </div>
        <div className="border-l border-[#e8e6e6] h-6 mx-2" />
        <ArticleSelector />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
```

#### 5C. Create `src/components/layout/SplitPane.tsx`

```tsx
"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export function SplitPane({ left, right }: SplitPaneProps) {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel defaultSize={40} minSize={25} maxSize={60}>
        <div className="h-full overflow-hidden">{left}</div>
      </Panel>
      <PanelResizeHandle className="w-1.5 bg-[#e8e6e6] hover:bg-[#bc9b5d] transition-colors cursor-col-resize" />
      <Panel defaultSize={60} minSize={30}>
        <div className="h-full overflow-hidden">{right}</div>
      </Panel>
    </PanelGroup>
  );
}
```

**Verify:** `npx tsc --noEmit` passes.

---

### Step 6: Create Chat Components

#### 6A. Create `src/components/chat/StreamingMessage.tsx`

```tsx
"use client";

import { useArticleStore } from "@/lib/store/article-store";

export function StreamingMessage() {
  const { statusMessage, streamingText, isGenerating } = useArticleStore();

  if (!isGenerating) return null;

  return (
    <div className="px-4 py-3">
      {/* Status message */}
      {statusMessage && (
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-[#bc9b5d] animate-pulse" />
          <span className="text-sm text-[#414141] italic">{statusMessage}</span>
        </div>
      )}

      {/* Streaming text (raw Claude output) */}
      {streamingText && (
        <div className="bg-[#f7f7f7] rounded-lg px-4 py-3 text-sm text-[#242323] whitespace-pre-wrap">
          {streamingText}
          <span className="inline-block w-1.5 h-4 bg-[#bc9b5d] animate-pulse ml-0.5 align-text-bottom" />
        </div>
      )}
    </div>
  );
}
```

#### 6B. Create `src/components/chat/MessageList.tsx`

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useArticleStore } from "@/lib/store/article-store";
import { StreamingMessage } from "./StreamingMessage";

export function MessageList() {
  const { conversationHistory, isGenerating } = useArticleStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory.length, isGenerating]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Welcome message when empty */}
      {conversationHistory.length === 0 && !isGenerating && (
        <div className="px-4 py-8 text-center">
          <p className="text-[#414141] text-sm">
            Select an article from the dropdown above, then type a message to start generating.
          </p>
        </div>
      )}

      {/* Conversation messages */}
      {conversationHistory.map((message, index) => (
        <div
          key={index}
          className={`px-4 py-3 ${
            message.role === "user"
              ? "bg-white"
              : "bg-[#f7f7f7]"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                message.role === "user"
                  ? "bg-[#bc9b5d] text-white"
                  : "bg-[#316142] text-white"
              }`}
            >
              {message.role === "user" ? "U" : "E"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#414141] mb-1">
                {message.role === "user" ? "You" : "Engine"}
              </div>
              <div className="text-sm text-[#242323] whitespace-pre-wrap break-words">
                {message.content}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Streaming message during generation */}
      <StreamingMessage />

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
```

#### 6C. Create `src/components/chat/MessageInput.tsx`

```tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { Send } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";

interface MessageInputProps {
  onSend: (message: string) => void;
}

export function MessageInput({ onSend }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isGenerating, selectedArticleId } = useArticleStore();

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || isGenerating || !selectedArticleId) return;
    onSend(trimmed);
    setMessage("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [message, isGenerating, selectedArticleId, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
  };

  const isDisabled = isGenerating || !selectedArticleId;

  return (
    <div className="border-t border-[#e8e6e6] px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            !selectedArticleId
              ? "Select an article first..."
              : isGenerating
                ? "Generating..."
                : "Type your message... (Enter to send, Shift+Enter for newline)"
          }
          disabled={isDisabled}
          rows={1}
          className="flex-1 resize-none rounded-md border border-[#cccccc] px-3 py-2 text-sm text-[#242323] placeholder:text-[#414141] focus:outline-none focus:border-[#bc9b5d] disabled:bg-[#f7f7f7] disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSend}
          disabled={isDisabled || !message.trim()}
          className="p-2 rounded-md bg-[#bc9b5d] text-white hover:bg-[#a8893f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

#### 6D. Create `src/components/chat/ChatPanel.tsx`

This is the most important component — it owns the SSE stream consumption lifecycle.

```tsx
"use client";

import { useCallback } from "react";
import { useArticleStore } from "@/lib/store/article-store";
import { renderArticle, TEMPLATE_VERSION } from "@/lib/renderer";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import type { StreamEventType } from "@/types/claude";
import type { CanonicalArticleDocument } from "@/types/article";
import type { ValidationResult } from "@/types/api";
import type { GenerateArticleResponse } from "@/types/claude";

export function ChatPanel() {
  const {
    selectedArticleId,
    currentDocument,
    conversationHistory,
    addUserMessage,
    startGeneration,
    appendStreamingText,
    setStatusMessage,
    setDocument,
    setCurrentHtml,
    setValidationResult,
    completeGeneration,
    failGeneration,
  } = useArticleStore();

  const handleSend = useCallback(
    async (message: string) => {
      if (!selectedArticleId) return;

      // Add user message to conversation and start generation
      addUserMessage(message);
      startGeneration();

      try {
        const response = await fetch("/api/articles/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleId: selectedArticleId,
            userMessage: message,
            conversationHistory: conversationHistory,
            currentDocument: currentDocument,
            photoManifest: null,
          }),
        });

        // Pre-stream errors come as JSON, not SSE
        if (!response.ok) {
          const errorData = await response.json();
          failGeneration(
            errorData?.error?.message ?? `HTTP ${response.status}`
          );
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
            let eventType = "";
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) eventType = line.slice(7);
              if (line.startsWith("data: ")) data = line.slice(6);
            }
            if (eventType && data) {
              handleSSEEvent(
                eventType as StreamEventType,
                JSON.parse(data)
              );
            }
          }
        }
      } catch (err) {
        failGeneration(
          err instanceof Error ? err.message : "Network error"
        );
      }
    },
    [
      selectedArticleId,
      currentDocument,
      conversationHistory,
      addUserMessage,
      startGeneration,
      failGeneration,
    ]
  );

  const handleSSEEvent = useCallback(
    (type: StreamEventType, data: unknown) => {
      switch (type) {
        case "status": {
          const d = data as { message: string };
          setStatusMessage(d.message);
          break;
        }
        case "text_delta": {
          const d = data as { text: string };
          appendStreamingText(d.text);
          break;
        }
        case "web_search": {
          const d = data as { query: string };
          setStatusMessage(`Searching: ${d.query}`);
          break;
        }
        case "document": {
          // Intermediate document — render for live preview
          const doc = data as CanonicalArticleDocument;
          setDocument(doc);
          try {
            const result = renderArticle({
              document: doc,
              htmlOverrides: null,
              templateVersion: TEMPLATE_VERSION,
            });
            setCurrentHtml(result.html);
          } catch {
            // Render may fail on partial doc — ignore
          }
          break;
        }
        case "validation": {
          const d = data as ValidationResult;
          setValidationResult(d);
          break;
        }
        case "complete": {
          const d = data as GenerateArticleResponse;
          completeGeneration(d);
          break;
        }
        case "error": {
          const d = data as { code: string; message: string };
          failGeneration(d.message);
          break;
        }
      }
    },
    [
      setStatusMessage,
      appendStreamingText,
      setDocument,
      setCurrentHtml,
      setValidationResult,
      completeGeneration,
      failGeneration,
    ]
  );

  return (
    <div className="h-full flex flex-col bg-white">
      <MessageList />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
```

**Verify:** `npx tsc --noEmit` passes.

---

### Step 7: Create Preview Components

#### 7A. Create `src/components/preview/PreviewIframe.tsx`

```tsx
"use client";

import { useArticleStore } from "@/lib/store/article-store";

export function PreviewIframe() {
  const { currentHtml, viewportMode } = useArticleStore();

  if (!currentHtml) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f7f7f7]">
        <p className="text-[#414141] text-sm">
          Preview will appear here after generation
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex justify-center bg-[#e8e6e6] overflow-auto p-4">
      <div
        className="bg-white shadow-lg transition-all duration-300"
        style={{
          width: viewportMode === "mobile" ? "375px" : "100%",
          maxWidth: viewportMode === "desktop" ? "1200px" : "375px",
          height: "100%",
        }}
      >
        <iframe
          srcDoc={currentHtml}
          className="w-full h-full border-0"
          title="Article preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
```

#### 7B. Create `src/components/preview/HtmlSourceView.tsx`

```tsx
"use client";

import { useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useArticleStore } from "@/lib/store/article-store";

export function HtmlSourceView() {
  const { currentHtml } = useArticleStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!currentHtml) return;
    await navigator.clipboard.writeText(currentHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentHtml]);

  if (!currentHtml) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f7f7f7]">
        <p className="text-[#414141] text-sm">
          HTML source will appear here after generation
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-end px-3 py-1.5 bg-[#242323] border-b border-[#414141]">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[#e8e6e6] hover:text-white transition-colors"
          title="Copy HTML"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy HTML
            </>
          )}
        </button>
      </div>
      <pre className="flex-1 overflow-auto bg-[#1a1a1a] p-4 text-xs leading-5 text-[#e8e6e6] font-mono whitespace-pre-wrap break-words">
        {currentHtml}
      </pre>
    </div>
  );
}
```

#### 7C. Create `src/components/preview/PreviewToolbar.tsx`

```tsx
"use client";

import { Monitor, Smartphone, Eye, Code, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";

export function PreviewToolbar() {
  const {
    previewMode,
    setPreviewMode,
    viewportMode,
    setViewportMode,
    validationResult,
  } = useArticleStore();

  return (
    <div className="h-10 border-b border-[#e8e6e6] flex items-center px-3 gap-3 bg-[#f7f7f7] shrink-0">
      {/* Preview / HTML toggle */}
      <div className="flex items-center rounded-md border border-[#cccccc] overflow-hidden">
        <button
          onClick={() => setPreviewMode("preview")}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors ${
            previewMode === "preview"
              ? "bg-[#bc9b5d] text-white"
              : "bg-white text-[#414141] hover:bg-[#fcf8ed]"
          }`}
          title="Preview"
        >
          <Eye className="w-3.5 h-3.5" />
          Preview
        </button>
        <button
          onClick={() => setPreviewMode("html")}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors ${
            previewMode === "html"
              ? "bg-[#bc9b5d] text-white"
              : "bg-white text-[#414141] hover:bg-[#fcf8ed]"
          }`}
          title="HTML Source"
        >
          <Code className="w-3.5 h-3.5" />
          HTML
        </button>
      </div>

      {/* Desktop / Mobile toggle */}
      <div className="flex items-center rounded-md border border-[#cccccc] overflow-hidden">
        <button
          onClick={() => setViewportMode("desktop")}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors ${
            viewportMode === "desktop"
              ? "bg-[#bc9b5d] text-white"
              : "bg-white text-[#414141] hover:bg-[#fcf8ed]"
          }`}
          title="Desktop"
        >
          <Monitor className="w-3.5 h-3.5" />
          Desktop
        </button>
        <button
          onClick={() => setViewportMode("mobile")}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors ${
            viewportMode === "mobile"
              ? "bg-[#bc9b5d] text-white"
              : "bg-white text-[#414141] hover:bg-[#fcf8ed]"
          }`}
          title="Mobile"
        >
          <Smartphone className="w-3.5 h-3.5" />
          Mobile
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Validation badge */}
      {validationResult && (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            validationResult.valid
              ? "bg-green-50 text-green-700"
              : validationResult.errors.length > 0
                ? "bg-red-50 text-red-700"
                : "bg-yellow-50 text-yellow-700"
          }`}
        >
          {validationResult.valid ? (
            <CheckCircle className="w-3.5 h-3.5" />
          ) : validationResult.errors.length > 0 ? (
            <XCircle className="w-3.5 h-3.5" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5" />
          )}
          {validationResult.valid
            ? "Valid"
            : `${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings`}
        </div>
      )}
    </div>
  );
}
```

#### 7D. Create `src/components/preview/PreviewPanel.tsx`

```tsx
"use client";

import { useArticleStore } from "@/lib/store/article-store";
import { PreviewToolbar } from "./PreviewToolbar";
import { PreviewIframe } from "./PreviewIframe";
import { HtmlSourceView } from "./HtmlSourceView";

export function PreviewPanel() {
  const { previewMode } = useArticleStore();

  return (
    <div className="h-full flex flex-col">
      <PreviewToolbar />
      <div className="flex-1 overflow-hidden">
        {previewMode === "preview" ? <PreviewIframe /> : <HtmlSourceView />}
      </div>
    </div>
  );
}
```

**Verify:** `npx tsc --noEmit` passes.

---

### Step 8: Replace Dashboard Page

Replace the placeholder `src/app/(dashboard)/page.tsx` with the main app shell:

```tsx
"use client";

import { AppShell } from "@/components/layout/AppShell";
import { SplitPane } from "@/components/layout/SplitPane";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";

export default function DashboardPage() {
  return (
    <AppShell>
      <SplitPane
        left={<ChatPanel />}
        right={<PreviewPanel />}
      />
    </AppShell>
  );
}
```

**Verify:** `npx tsc --noEmit` passes. `npm run build` passes.

---

### Step 9: Final Build & Lint Gate

Run all verification checks:

```bash
npx tsc --noEmit
npx next lint
npm run build
```

All three must pass with zero errors. Warnings are acceptable.

**Verify file count:** 14 new files created, 2 files modified:

```
NEW:
  src/types/ui.ts
  src/lib/store/article-store.ts
  src/app/(dashboard)/layout.tsx
  src/app/(dashboard)/providers.tsx
  src/components/layout/AppShell.tsx
  src/components/layout/SplitPane.tsx
  src/components/layout/ArticleSelector.tsx
  src/components/chat/ChatPanel.tsx
  src/components/chat/MessageList.tsx
  src/components/chat/MessageInput.tsx
  src/components/chat/StreamingMessage.tsx
  src/components/preview/PreviewPanel.tsx
  src/components/preview/PreviewIframe.tsx
  src/components/preview/PreviewToolbar.tsx
  src/components/preview/HtmlSourceView.tsx

MODIFIED:
  src/types/index.ts (added ui.ts re-export)
  src/app/(dashboard)/page.tsx (replaced placeholder)
```

---

## I. Gate Checks

### Gate 1: Lint & Type Check (Agent Self-Serve)

```bash
npx tsc --noEmit          # Zero type errors
npx next lint              # Zero lint errors (warnings acceptable)
npm run build              # Build succeeds, all routes compiled
```

### Gate 2: Integration Test

**Guide 6 has no programmatic integration test** — it is a pure UI guide. All backend routes are unchanged. Integration is verified by the Human Gate.

However, the agent SHOULD verify that the backend routes still work:
```bash
curl -s http://localhost:3000/api/health | head -c 200
curl -s http://localhost:3000/api/content-map | head -c 200
```

Both should return `{ "success": true, ... }`.

### Gate 3: Human Gate — MAJOR MILESTONE (M3)

**This is the most important human checkpoint in the entire build.**

Run `npm run dev` and navigate to `http://localhost:3000/`.

1. **Auth redirect:** You should be redirected to `/login` if not authenticated
2. **Login:** Sign in with the seeded admin credentials
3. **Dashboard loads:** You see the BWC Content Engine header with the article selector dropdown
4. **Article selector:** Click the dropdown — you should see all 39 content map entries with hub/spoke badges
5. **Select article:** Pick any article (e.g., "The Complete Guide to Bhutan Wine")
6. **Type message:** Type "Generate a comprehensive article about Bhutan wine" in the input field
7. **Generation starts:** Click Send or press Enter
   - Status messages appear: "Assembling system prompt...", "Calling Claude API...", etc.
   - Streaming text appears as Claude generates
   - The preview pane updates when the document arrives — a fully styled BWC blog post
8. **Preview:** The rendered article shows BWC fonts (Cormorant Garamond headings, Nunito Sans body), gold accents, proper spacing
9. **Mobile toggle:** Click "Mobile" — preview shrinks to 375px phone width
10. **Desktop toggle:** Click "Desktop" — preview returns to full width
11. **HTML toggle:** Click "HTML" — see the raw HTML source with copy button
12. **Preview toggle:** Click "Preview" — return to rendered view
13. **Validation badge:** Should show either green "Valid" or red with error/warning counts
14. **Iterate:** Type a follow-up message ("Make the opening more narrative") — watch the article regenerate

If all 14 checks pass: **Guide 6 is complete. Milestone M3 achieved.**

---

## J. Acceptance Criteria

1. Authenticated users see the split-pane dashboard; unauthenticated users are redirected to `/login`
2. The article selector dropdown displays all content map entries from the API
3. Selecting an article and sending a message triggers SSE generation
4. Status messages stream into the chat panel in real time
5. The fully styled article renders in the preview iframe with BWC brand fonts, colors, and layout
6. The preview iframe uses `srcDoc` — no CSS leakage between dashboard and article styles
7. Desktop/Mobile viewport toggle changes the preview width
8. Preview/HTML toggle switches between rendered view and raw source
9. The validation badge reflects the validation result from the generation pipeline
10. Follow-up messages maintain conversation history and can iterate on the article
11. The chat panel shows clear user/assistant message distinction
12. During generation, the input is disabled and streaming indicators are visible
13. Errors from the API display as error messages in the chat
14. `npx tsc --noEmit`, `npx next lint`, and `npm run build` all pass with zero errors

---

## K. Risks and Failure Modes

| Risk | Impact | Mitigation |
|---|---|---|
| `renderArticle()` imported in client component fails due to server-only deps | Build error — renderer uses Node APIs | The renderer is a pure sync function with no Node deps (confirmed in pattern-finder findings). It uses only string manipulation. Safe for client-side import. |
| `SessionProvider` not wrapping dashboard | `useSession()` returns undefined, no client-side session access | Layout explicitly wraps in `DashboardProviders` client component |
| SSE parsing edge case — partial event at chunk boundary | Missing events or JSON parse errors | Buffer-based parser keeps incomplete data between reads, only processes complete `\n\n`-delimited events |
| Content map API returns dates as strings, not Date objects | ArticleSelector displays `[object Object]` | Guide does not display dates in the dropdown — only title, type, hub name, status |
| First article generation takes 15-30 seconds | User thinks the app is broken | Status messages stream continuously so user sees progress; typing indicator visible |
| No article persistence (Guide 11) | Work lost on refresh | Expected — out of scope. Browser `beforeunload` warning could be added but is not required |
| `react-resizable-panels` SSR mismatch | Hydration warning | All components are `"use client"` — no SSR mismatch risk |
| Middleware inactive (`src/proxy.ts`) | API routes theoretically accessible without auth | API routes have their own `requireRole()` guards. Dashboard layout has server-side `getCurrentUser()` + redirect. Double-layered protection. |
