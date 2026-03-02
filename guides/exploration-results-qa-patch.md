# Exploration Results: Targeted QA Patch Endpoint

**Date:** 2026-03-02
**Target:** Guide 8B — Targeted QA Fix Endpoint (extends Guide 8: QA Scorecard)
**Agents:** code-inspector, integration-verifier, pattern-finder

---

## 1. Current Build State

**Guides Complete:** 1 (Foundation), 2 (Content Map), 3 (Onyx RAG), 4 (Article Schema + Renderer), 5 (Orchestration + Claude API), 6 (Split-Pane UI), 7 (Canvas Edit + Undo/Redo), 8 (QA Scorecard)

**Additionally completed (not in original plan):**
- Tier 1 deterministic fix system (fix-registry.ts, qa-fix.ts types)
- Multi-select batch fixing in scorecard UI
- `applyDeterministicFix` and `applyBatchFixes` store actions

**Inventory:**
- 9 Prisma tables, 18 API routes, 12 type files, 25+ components, 15+ lib modules
- Build: PASS (4.6s, zero errors)
- Database: PASS (Neon Postgres connected)
- Claude API: CONFIGURED (singleton client, streaming implemented)

---

## 2. Next Guide Target

**Guide 8B: Targeted QA Fix Endpoint**

Build a new `POST /api/articles/qa/fix` endpoint that:
1. Accepts specific QA check IDs + current document
2. Applies Tier 1 fixes deterministically (server-side)
3. Batches Tier 2 fixes into ONE targeted Claude API call (non-streaming)
4. Claude returns partial JSON (only changed fields)
5. Deep-merges partial response into full document
6. Runs repair → validate → render → QA pipeline
7. Returns updated document + HTML + QA score

**Why:** Currently Tier 2 fixes route through the full `/api/articles/generate` endpoint, causing a complete document regeneration. This is slow (~15s) and expensive (~$0.10/call). The patch endpoint should be ~3s and ~$0.02/call.

---

## 3. Dependencies Satisfied

### Types (all exist)
| Type | File | Status |
|---|---|---|
| `CanonicalArticleDocument` | `src/types/article.ts` | 22 fields, all sub-types defined |
| `QACheck`, `QAResult`, `QAScore` | `src/types/qa.ts` | Complete |
| `FixTier`, `DocMutation`, `DeterministicFixResult`, `FixRegistryEntry` | `src/types/qa-fix.ts` | Complete |
| `ValidationResult`, `ErrorCode` | `src/types/api.ts` | Complete |
| `RendererInput`, `RendererOutput` | `src/types/renderer.ts` | Complete |
| `ArticleEditorActions`, `ArticleEditorState` | `src/types/ui.ts` | Has `applyDeterministicFix`, `applyBatchFixes` — needs `applyQaFix` |

### Library Modules (all exist)
| Module | Import | Exports Needed |
|---|---|---|
| Claude client | `@/lib/claude/client` | `getClaudeClient()`, `getModelId()`, `getMaxOutputTokens()` |
| QA engine | `@/lib/qa` | `runQAChecks`, `CHECK_REGISTRY`, `getFixTier`, `getFixEntry`, `getClaudePromptTemplate` |
| Fix registry | `@/lib/qa/fix-registry` | All 43 check mappings, 8 Tier 1 fix functions |
| Article schema | `@/lib/article-schema` | `validateCanonicalDocument`, `repairCanonicalDocument`, `CanonicalArticleDocumentSchema` |
| Renderer | `@/lib/renderer` | `renderArticle` |
| Template version | `@/lib/renderer/compiled-template` | `TEMPLATE_VERSION` |
| Auth | `@/lib/auth/session` | `requireRole` |
| Undo-redo | `@/lib/undo-redo` | `setByPath`, `createUndoEntry`, `pushToStack` |
| Orchestration | `@/lib/orchestration` | `parseGenerationResponse`, `runPostProcessing` |

### External Services
| Service | Status | Notes |
|---|---|---|
| Claude API | CONFIGURED | `ANTHROPIC_API_KEY` set, singleton ready |
| Neon Postgres | PASS | Connected, schema valid |

---

## 4. Dependencies Missing or Needing Change

### BLOCKER: CheerioDomAdapter Not Exported

`CheerioDomAdapter` is defined **inline** in `src/app/api/articles/qa/route.ts` (not exported). The new fix endpoint needs the same class for server-side DOM querying after re-render.

**Fix:** Extract to `src/lib/qa/cheerio-adapter.ts`, re-export from `src/lib/qa/index.ts`, update existing `qa/route.ts` import.

### Missing Store Action: `applyQaFix`

`ArticleEditorActions` needs a new async action `applyQaFix(checkIds: string[]) => Promise<void>` that:
- Calls `POST /api/articles/qa/fix`
- Updates `currentDocument`, `currentHtml`, `validationResult`, `qaScore`
- Pushes undo entry
- Does NOT add to `conversationHistory` (this is not a chat interaction)

### applyBatchFixes Needs Rewiring

Currently `applyBatchFixes` routes Tier 2 items to `pendingChatMessage` → chat → full generate. After this guide, it should route Tier 2 through the new `applyQaFix` action instead.

### Partial JSON Merge Strategy (New Code)

No existing deep-merge utility exists. The endpoint needs:
1. A prompt that instructs Claude to return partial JSON with only changed fields
2. A `deepMerge(original, partial)` function that handles arrays (sections, links) correctly
3. Fallback: if merge fails, re-send as full doc request

---

## 5. Established Patterns to Follow

### API Route Handler (Standard JSON — from render/validate routes)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const RequestSchema = z.object({ /* ... */ });

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    // business logic
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, { status: 401 });
    if (message === "AUTH_FORBIDDEN") return NextResponse.json({ success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required" } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
```

### Claude Non-Streaming Call

```typescript
import { getClaudeClient, getModelId } from "@/lib/claude/client";

const client = getClaudeClient();
const response = await client.messages.create({
  model: getModelId(),
  max_tokens: 4096,  // small for patch responses
  system: patchSystemPrompt,
  messages: [{ role: "user", content: patchUserPrompt }],
});
const text = response.content
  .filter((b) => b.type === "text")
  .map((b) => (b as { type: "text"; text: string }).text)
  .join("");
```

### Store Action: Undo + Modify + Render + QA (from applyDeterministicFix)

```typescript
// 1. Push undo BEFORE modifying
const undoEntry = createUndoEntry(state.currentDocument, state.currentHtml, state.htmlOverrides, label);

// 2. Modify document (setByPath for field-level, or full replace)

// 3. Re-render
const rendered = renderArticle({ document: updatedDoc, htmlOverrides, templateVersion: TEMPLATE_VERSION });

// 4. Re-run QA
const dom = new BrowserDomAdapter(rendered.html);
const qaScore = runQAChecks(updatedDoc, rendered.html, dom);

// 5. Atomic commit
set({ currentDocument, currentHtml, undoStack: pushToStack(state.undoStack, undoEntry), redoStack: [], qaScore });
```

### Streaming Parser JSON Extraction (from parseGenerationResponse)

```typescript
// 3 strategies: pure JSON → markdown fence → outermost braces
// Use for extracting partial JSON from Claude response text
import { parseGenerationResponse } from "@/lib/orchestration";
```

---

## 6. Integration Readiness

| Service | Status | Notes |
|---|---|---|
| Claude API | Ready | `getClaudeClient()` singleton, `.messages.create()` for non-streaming |
| Cheerio | Installed | Already in `package.json`, used by existing QA route |
| Article Renderer | Ready | Pure function, no side effects |
| QA Engine | Ready | `runQAChecks()` works with any DomAdapter |
| Article Schema | Ready | Zod validation + repair pipeline |

---

## 7. Risks and Blockers

### Risk 1: Partial JSON Merge Complexity (HIGH)
Claude returns partial JSON for changed fields. Merging arrays (sections, links) is non-trivial:
- If Claude adds a section, it returns the new section — but where does it go in the array?
- If Claude modifies `sections[2].content[0].text`, do we replace by index or by ID?

**Mitigation:** Use section `id` fields for matching. For arrays like `internalLinks` and `externalLinks`, replace the entire array if Claude touches it. Document the merge contract clearly in the prompt.

### Risk 2: Claude Response Quality (MEDIUM)
Asking Claude for partial JSON is unusual. It may:
- Return a full document instead of partial
- Return malformed JSON
- Miss the merge format instructions

**Mitigation:** Validate Claude's response. If it returns a full document (has `version` + `articleId` fields), use it as-is. If partial, merge. If malformed, return error with skippedFixes.

### Risk 3: Inconsistency: QA Route Has No Auth (LOW)
`POST /api/articles/qa` has no `requireRole()` call. The new `qa/fix` endpoint MUST have auth (it calls Claude = costs money). This creates an inconsistency.

**Mitigation:** Add auth to the new route. Optionally fix the existing QA route too, but that's a separate concern.

---

## 8. Deviations from Orchestration Doc Plan

| Aspect | Orchestration Doc Says | Actual State |
|---|---|---|
| QA fix actions | Guide 8 owns `src/lib/qa/`, `src/components/scorecard/`, `src/app/api/articles/qa/` | Guide 8 complete. This is an extension (8B). |
| Fix system | Not in original plan | Tier 1 deterministic fixes already implemented with fix-registry.ts |
| Store actions | Not in original plan | `applyDeterministicFix` and `applyBatchFixes` already exist |
| Scorecard UI | "Fix in Chat/Canvas" actions | Extended with checkboxes, tier badges, "Auto Fix" button, "Fix Selected" button |
| QA route at `/api/articles/qa/` | Guide 8 owns this path | EXISTS — the new `fix` sub-route goes at `/api/articles/qa/fix/` |

### Key Deviation: Tier 2 Currently Routes Through Chat
The plan originally had "Fix in Chat" as the only Tier 2 path. The `applyBatchFixes` action composes a targeted prompt and sets `pendingChatMessage`, which the user then sends through the full generate flow. The new endpoint replaces this with a direct API call that skips the chat/conversation system entirely.

---

## 9. Files to Create / Modify

### New Files
| File | Purpose |
|---|---|
| `src/lib/qa/cheerio-adapter.ts` | Extract CheerioDomAdapter from inline definition |
| `src/app/api/articles/qa/fix/route.ts` | New POST endpoint — targeted QA fixes |
| `src/lib/qa/patch-prompt.ts` | Prompt builder for targeted Claude fix requests |
| `src/lib/qa/merge-partial.ts` | Deep-merge partial JSON response into full doc |

### Modified Files
| File | Change |
|---|---|
| `src/app/api/articles/qa/route.ts` | Import CheerioDomAdapter from shared module |
| `src/lib/qa/index.ts` | Re-export CheerioDomAdapter, patch-prompt, merge-partial |
| `src/types/ui.ts` | Add `applyQaFix` to `ArticleEditorActions` |
| `src/lib/store/article-store.ts` | Implement `applyQaFix`, rewire `applyBatchFixes` Tier 2 path |
| `src/components/scorecard/ScorecardPanel.tsx` | Wire "Fix Selected" to use `applyQaFix` for Tier 2 |

---

## 10. Recommended Endpoint Contract

### Request
```typescript
const QaFixRequestSchema = z.object({
  document: z.record(z.unknown()),     // CanonicalArticleDocument (validated separately)
  html: z.string(),
  checkIds: z.array(z.string()).min(1).max(20),
  qaResults: z.array(z.object({
    check: z.object({ id: z.string(), name: z.string(), severity: z.string(), rule: z.string(), category: z.string() }),
    passed: z.boolean(),
    score: z.number(),
    message: z.string(),
    elementPath: z.string().nullable(),
    fixSuggestion: z.string().nullable(),
  })).optional(),
});
```

### Response
```typescript
{
  success: true,
  data: {
    document: CanonicalArticleDocument,
    html: string,
    validationResult: ValidationResult,
    qaScore: QAScore,
    appliedFixes: { checkId: string, tier: 1 | 2, summary: string }[],
    skippedFixes: { checkId: string, reason: string }[],
  }
}
```

---

## 11. Claude Prompt Strategy

### System Prompt (Minimal — NOT the 7-layer prompt)
```
You are a technical editor fixing specific QA issues in a blog article for Bhutan Wine Company.
You will receive the current article as a CanonicalArticleDocument JSON and a list of QA issues to fix.

CRITICAL INSTRUCTIONS:
1. Return ONLY a partial JSON object containing the fields you changed.
2. Do NOT return the full document — only changed fields.
3. For array fields (sections, internalLinks, externalLinks), return the COMPLETE updated array.
4. For scalar fields (title, metaTitle, executiveSummary), return just the new value.
5. Wrap your response in ```json fences.
6. Make minimal changes — do not rewrite content that isn't related to the QA issues.
```

### User Prompt (Per-fix)
```
Current document:
{JSON.stringify(document, null, 2)}

Fix these QA issues:
- [F06] Add more content to meet the word count minimum. (Current: hub articles need >= 2500 words, got 2311)
- [F07] Add more internal links. (Current: hub articles need >= 8 internal links, got 4)

Return only the changed fields as partial JSON.
```

### Token Budget
- Input: ~8000 tokens (full doc + prompt)
- Output: ~2000 tokens max (partial changes)
- Total: ~10000 tokens (~$0.02 with Sonnet)
- vs. full generate: ~50000 tokens (~$0.10)

---

*End of exploration results. Run `/build-guide` to generate the implementation guide.*
