# Exploration Results — Guide 8B: Targeted QA Fix Endpoint

**Date:** 2026-03-02
**Target:** Guide 8B — Targeted QA Fix Endpoint (sub-guide of Guide 8)
**Depends on:** Guide 8 (QA Scorecard), Guide 5 (Claude API), Guide 7 (undo/redo)
**File ownership:** `src/app/api/articles/qa/fix/`, `src/lib/qa/cheerio-adapter.ts`, `src/lib/qa/patch-prompt.ts`, `src/lib/qa/merge-partial.ts`

---

## 1. Current Build State

### Guides Complete: 1–8

| Guide | Status | Evidence |
|---|---|---|
| 1: Foundation | ✅ Complete | Prisma schema, auth, types, agent-guard |
| 2: Content Map | ✅ Complete | CRUD routes, 39 seeded rows, CSV import |
| 3: Onyx RAG | ✅ Complete | Client, search, health routes |
| 4: Article Schema + Renderer | ✅ Complete | Zod schema, validation, renderer, JSON-LD |
| 5: Orchestration + Claude API | ✅ Complete | 7-layer prompt, streaming, web search |
| 6: Split-Pane UI + Chat | ✅ Complete | Chat panel, preview iframe, streaming |
| 7: Canvas Edit + HTML Mode + Undo/Redo | ✅ Complete | contenteditable, CodeMirror, undo stack |
| 8: QA Scorecard | ✅ Complete | 43 checks, scorecard UI, fix registry, Tier 1 deterministic fixes |

### Summary Inventory

| Category | Count |
|---|---|
| Database tables | 9 |
| API routes | 14 |
| Type files | 11 (including qa-fix.ts) |
| Lib modules | 13 (including qa/) |
| Components | 20 (including 3 scorecard) |
| Build status | ✅ 0 TS errors, 21 routes compiled |

---

## 2. Source Doc Status

| Document | Status |
|---|---|
| `docs/BWC Master Content Engine SOP.md` | ✅ Present and verified |
| `docs/Bhutan Wine Company — Brand Style Guide for HTML Blog Posts (3).md` | ✅ Present and verified |

---

## 3. Key Findings — Existing Infrastructure

### 3A. CheerioDomAdapter (BLOCKER — requires extraction)

The `CheerioDomAdapter` class is defined **inline** in `src/app/api/articles/qa/route.ts` (lines 12–50). It cannot be imported by the new fix route. The class must be extracted to `src/lib/qa/cheerio-adapter.ts` before the fix endpoint can be created.

**Current location:** `src/app/api/articles/qa/route.ts` (inline, unexported)
**Required location:** `src/lib/qa/cheerio-adapter.ts` (exported, shared)

### 3B. Fix Registry — Tier 2 Templates Already Written

All 26 Tier 2 (Claude-assisted) prompt templates are already defined in `src/lib/qa/fix-registry.ts`. The new `patch-prompt.ts` should compose these templates into a Claude API call — not duplicate them.

**Tier 1 (deterministic):** 8 checks with fix functions (F04, F05, F10, F14, F17, W04, W05, W18)
**Tier 2 (Claude-assisted):** 35 checks with `claudePromptTemplate` strings

### 3C. Claude Client Pattern

`src/lib/claude/client.ts` provides a singleton Anthropic client:
- `getClaudeClient()` — returns singleton, throws `GENERATION_FAILED` if no API key
- `getModelId()` — returns `env.ANTHROPIC_MODEL` (currently `claude-sonnet-4-5-20250929`)
- `getMaxOutputTokens()` — returns 16384 (for full generation, NOT for patch responses)

The fix endpoint should use `max_tokens: 4096` to limit costs.

### 3D. Auth Pattern

`requireRole("admin", "editor")` from `src/lib/auth/session.ts` — proven pattern used in `/api/articles/generate`. Throws `Error("AUTH_REQUIRED")` or `Error("AUTH_FORBIDDEN")`.

**Note:** The existing `POST /api/articles/qa` route does NOT use auth. The fix route MUST use it since it calls the paid Claude API.

### 3E. Store — Current Tier 2 Flow

The existing `applyBatchFixes` action in `src/lib/store/article-store.ts`:
1. Applies Tier 1 fixes locally (deterministic)
2. For Tier 2: composes `pendingChatMessage` and switches to chat mode

This routes Tier 2 through full `/api/articles/generate` (16K+ output tokens). Guide 8B replaces step 2 with a targeted `POST /api/articles/qa/fix` call (~4K output tokens).

### 3F. QA Re-run Pattern

After any document mutation, the store:
1. Re-renders HTML via `renderArticle()`
2. Creates `BrowserDomAdapter(html)`
3. Calls `runQAChecks(doc, html, dom)`
4. Sets `qaScore` in store

This pattern must be preserved in the server-side fix endpoint (using `CheerioDomAdapter` instead of `BrowserDomAdapter`).

---

## 4. Gaps & Deviations

| Gap | Severity | Resolution |
|---|---|---|
| `CheerioDomAdapter` inline in route file | **BLOCKER** | Extract to shared module in Phase 1 |
| No `applyQaFix` action in store | Expected | New action added in Phase 5 |
| No `isApplyingFix` loading state | Expected | New state field added in Phase 5 |
| No `/api/articles/qa/fix` route | Expected | Created in Phase 4 |
| `applyBatchFixes` routes Tier 2 to chat | Expected | Rewired in Phase 5 |

---

## 5. Established Patterns

### API Route Template

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import type { ApiResponse } from "@/types/api";

const RequestSchema = z.object({ /* ... */ });

export async function POST(request: Request) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "..." } }, { status: 400 });
    }
    // ... business logic ...
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") return NextResponse.json({ ... }, { status: 401 });
    if (message === "AUTH_FORBIDDEN") return NextResponse.json({ ... }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
```

### Store Async Action Template

```typescript
someAction: async (args) => {
  const state = get();
  if (!state.currentDocument) return;
  set({ isLoading: true });
  try {
    const response = await fetch("/api/...", { method: "POST", ... });
    const result = await response.json();
    if (!result.success) { set({ isLoading: false }); return; }
    const undoEntry = createUndoEntry(state.currentDocument, state.currentHtml, state.htmlOverrides, "label");
    set({ currentDocument: result.data.document, currentHtml: result.data.html, undoStack: pushToStack(...), isLoading: false });
  } catch { set({ isLoading: false }); }
},
```

---

## 6. Risks & Blockers

| Item | Severity | Status |
|---|---|---|
| CheerioDomAdapter extraction | HIGH | Blocker — must extract before creating fix route |
| Claude API available | OK | ✅ Key configured, client working |
| TypeScript compiles | OK | ✅ 0 errors |
| Build passes | OK | ✅ 21 routes, clean |
| cheerio installed | OK | ✅ v1.2.0 in dependencies |
| No naming collisions | OK | ✅ `applyQaFix` not found in codebase |
| Source docs present | OK | ✅ SOP + Style Guide verified |

**Overall: READY TO BUILD. One blocker (CheerioDomAdapter extraction) is resolved in Phase 1 of the guide.**
