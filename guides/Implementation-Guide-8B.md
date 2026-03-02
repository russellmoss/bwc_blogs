# Implementation Guide 8B: Targeted QA Fix Endpoint

**Guide type:** Feature extension (sub-guide of Guide 8)
**Depends on:** Guide 8 (QA Scorecard — complete), Guide 5 (Claude API client), Guide 7 (undo/redo + store)
**Milestone:** M5B — "Surgical QA fixes"
**Last updated:** 2026-03-02

---

## A. Objective

Extend the Guide 8 QA system with a **targeted fix endpoint** that replaces the current Tier 2 "Fix in Chat" flow. When this guide completes:

1. **Tier 1 fixes** (metadata lengths, schema flags, slug) remain deterministic and server-side — no change from Guide 8.
2. **Tier 2 fixes** (word count, link additions, heading rewrites) use a **targeted Claude API call** that returns only partial JSON for changed fields, costing ~5x less than full regeneration.
3. The user clicks **Fix Selected** in the ScorecardPanel, and the system atomically updates the document, HTML preview, and QA scorecard — without routing through the chat panel.

### Cost Comparison

| Approach | Output Tokens | Approximate Cost |
|---|---|---|
| Full regeneration (`/api/articles/generate`) | ~16,000 | $0.48 |
| Targeted QA fix (`/api/articles/qa/fix`) | ~3,000 | $0.09 |

---

## B. Scope

### In Scope
- Extract `CheerioDomAdapter` from `src/app/api/articles/qa/route.ts` into shared module
- New `POST /api/articles/qa/fix` endpoint with auth enforcement
- Patch prompt builder: instructs Claude to return partial JSON for changed fields only
- Deep merge utility: merges Claude's partial response into the full `CanonicalArticleDocument`
- Store extension: `applyQaFix` async action
- UI rewire: ScorecardPanel "Fix Selected" calls `applyQaFix` for Tier 2 items

### Out of Scope
- Streaming response from fix endpoint (not needed — response is small)
- Tier 1 fix changes (already complete in Guide 8)
- Finalization flow integration (Guide 11)
- New QA checks or rule changes

---

## C. Depends On

| Guide | What This Guide Uses From It |
|---|---|
| 8 | `runQAChecks`, `BrowserDomAdapter`, `CheerioDomAdapter` (to extract), `CHECK_REGISTRY`, `getFixEntry`, `getFixTier`, `getClaudePromptTemplate`, `fix-registry.ts` (Tier 2 prompt templates), QA types, ScorecardPanel, ScorecardItem, store QA actions |
| 5 | `getClaudeClient()`, `getModelId()` from `src/lib/claude/client.ts` |
| 7 | `setByPath()` from `src/lib/undo-redo/undo-manager.ts`, `renderArticle()` from `src/lib/renderer` |
| 4 | `CanonicalArticleDocumentSchema` from `src/lib/article-schema/schema` |
| 1 | `requireRole()` from `src/lib/auth/session` |

All dependencies verified present and working.

---

## D. Shared Contracts Referenced

### Types (from `src/types/`)
- `CanonicalArticleDocument`, `ArticleSection` — `src/types/article.ts`
- `QACheck`, `QAResult`, `QAScore`, `CheckSeverity` — `src/types/qa.ts`
- `FixTier`, `DocMutation`, `DeterministicFixResult`, `FixRegistryEntry` — `src/types/qa-fix.ts`
- `ArticleEditorState`, `ArticleEditorActions` — `src/types/ui.ts`
- `ApiResponse`, `ErrorCode` — `src/types/api.ts`

### Library Modules
- `runQAChecks`, `BrowserDomAdapter`, `getFixEntry`, `getFixTier`, `getClaudePromptTemplate` — `@/lib/qa`
- `getClaudeClient`, `getModelId` — `@/lib/claude/client`
- `renderArticle` — `@/lib/renderer`
- `TEMPLATE_VERSION` — `@/lib/renderer/compiled-template`
- `setByPath`, `createUndoEntry`, `pushToStack` — `@/lib/undo-redo`
- `requireRole` — `@/lib/auth/session`

---

## E. Existing Constraints to Preserve

1. **`npm run build` must pass** with zero errors after every phase
2. **All 14 existing API routes** must remain functional — this guide creates 1 new route
3. **Do not modify** files owned by Guides 1–7 (except the specific modifications listed below)
4. **Import conventions**: `@/` path alias, `import type` for type-only imports, named exports only
5. **Store pattern**: `create<State & Actions>((set, get) => ({...}))`, selectors as standalone exports
6. **API response format**: `{ success: true, data }` / `{ success: false, error: { code, message } }`
7. **Auth on paid endpoints**: All routes that call Claude API must have `requireRole("admin", "editor")`
8. **Undo before mutation**: Always push undo entry before modifying `currentDocument`
9. **Re-render after mutation**: Always call `renderArticle()` after document changes to sync HTML
10. **Re-run QA after mutation**: Always call `runQAChecks()` after document changes to refresh scorecard

---

## F. Files Created / Modified

### New Files (4 total)

| File | Purpose |
|---|---|
| `src/lib/qa/cheerio-adapter.ts` | Shared `CheerioDomAdapter` class — extracted from inline route definition |
| `src/app/api/articles/qa/fix/route.ts` | `POST` endpoint — applies Tier 1 fixes server-side, calls Claude for Tier 2, returns merged document |
| `src/lib/qa/patch-prompt.ts` | Builds the minimal system + user prompt instructing Claude to return partial JSON |
| `src/lib/qa/merge-partial.ts` | Deep-merges Claude's partial JSON response into the full `CanonicalArticleDocument` |

### Modified Files (5 total)

| File | Change |
|---|---|
| `src/app/api/articles/qa/route.ts` | Replace inline `CheerioDomAdapter` with import from `@/lib/qa/cheerio-adapter` |
| `src/lib/qa/index.ts` | Add re-exports for `CheerioDomAdapter`, `buildPatchPrompt`, `mergePartialDocument` |
| `src/types/ui.ts` | Add `applyQaFix` and `isApplyingFix` to interfaces |
| `src/lib/store/article-store.ts` | Implement `applyQaFix` async action, add `isApplyingFix` state, rewire batch fixes |
| `src/components/scorecard/ScorecardPanel.tsx` | Wire "Fix Selected" to `applyQaFix` for Tier 2 items, add loading spinner |

---

## G. Technical Design

### G1. Shared CheerioDomAdapter

Extract the `CheerioDomAdapter` class from `src/app/api/articles/qa/route.ts` into a new shared module at `src/lib/qa/cheerio-adapter.ts`. The class implements the `DomAdapter` interface from `src/lib/qa/engine.ts`.

```typescript
// src/lib/qa/cheerio-adapter.ts
import * as cheerio from "cheerio";
import type { Element as CheerioElement } from "domhandler";
import type { DomAdapter, DomElement } from "./engine";

export class CheerioDomAdapter implements DomAdapter {
  private $: cheerio.CheerioAPI;

  constructor(html: string) {
    this.$ = cheerio.load(html);
  }

  querySelectorAll(selector: string): DomElement[] {
    const elements: DomElement[] = [];
    try {
      this.$(selector).each((_, el) => {
        const $el = this.$(el);
        elements.push({
          tagName: (el as CheerioElement).tagName?.toUpperCase() || "",
          getAttribute: (name: string) => $el.attr(name) ?? null,
          textContent: $el.text(),
        });
      });
    } catch {
      // Invalid selector — return empty
    }
    return elements;
  }

  querySelector(selector: string): DomElement | null {
    try {
      const $el = this.$(selector).first();
      if ($el.length === 0) return null;
      const el = $el.get(0) as CheerioElement;
      return {
        tagName: el.tagName?.toUpperCase() || "",
        getAttribute: (name: string) => $el.attr(name) ?? null,
        textContent: $el.text(),
      };
    } catch {
      return null;
    }
  }
}
```

After extraction, `src/app/api/articles/qa/route.ts` imports from the shared module:

```typescript
import { CheerioDomAdapter } from "@/lib/qa/cheerio-adapter";
```

### G2. Fix Endpoint Architecture

**Endpoint:** `POST /api/articles/qa/fix`

**Request body:**
```typescript
{
  document: CanonicalArticleDocument;  // Current document state
  html: string;                        // Current rendered HTML
  checkIds: string[];                  // QA check IDs to fix (e.g. ["F06", "F07", "W01"])
}
```

**Processing flow:**
```
┌──────────────────────────────────────────────────────────┐
│  POST /api/articles/qa/fix                                │
│                                                           │
│  1. requireRole("admin", "editor")                        │
│  2. Validate request body with Zod                        │
│  3. Split checkIds into tier1Ids and tier2Ids             │
│                                                           │
│  4. Apply Tier 1 fixes (deterministic):                   │
│     For each tier1Id:                                     │
│       entry = getFixEntry(id)                             │
│       result = entry.fix(doc) → DocMutation[]             │
│       doc = apply mutations via setByPath                 │
│                                                           │
│  5. If tier2Ids.length > 0:                               │
│     a. Build patch prompt (system + user)                 │
│     b. Call Claude (non-streaming, max_tokens: 4096)      │
│     c. Parse partial JSON from response                   │
│     d. Merge partial JSON into doc                        │
│                                                           │
│  6. Re-render HTML from updated doc                       │
│  7. Re-run QA checks on updated doc + HTML                │
│  8. Return { document, html, qaScore, appliedFixes }      │
└──────────────────────────────────────────────────────────┘
```

**Success response (200):**
```typescript
{
  success: true,
  data: {
    document: CanonicalArticleDocument;  // Updated document
    html: string;                        // Re-rendered HTML
    qaScore: QAScore;                    // Fresh QA score
    appliedFixes: {                      // What was actually fixed
      tier1: string[];                   // Check IDs where Tier 1 fix succeeded
      tier2: string[];                   // Check IDs sent to Claude
    };
    tier1Summary: string;                // E.g. "Trimmed meta title; Set canonical URL"
    claudeTokensUsed: number | null;     // Output tokens used by Claude (null if no Tier 2)
  }
}
```

**Error responses:**
- 400: Invalid request body (`VALIDATION_ERROR`)
- 401: Not authenticated (`AUTH_REQUIRED`)
- 403: Not admin/editor (`AUTH_FORBIDDEN`)
- 500: Claude API failure or internal error (`GENERATION_FAILED` / `INTERNAL_ERROR`)

### G3. Patch Prompt Design

The patch prompt instructs Claude to return **only the changed fields** of the `CanonicalArticleDocument`. This is the key cost savings mechanism.

**System prompt** (in `src/lib/qa/patch-prompt.ts`):

```
You are a surgical article editor for Bhutan Wine Company. You will receive a
CanonicalArticleDocument (JSON) and a list of QA issues to fix.

CRITICAL RULES:
1. Return ONLY a JSON object containing the fields you changed — nothing else.
2. For scalar fields (title, metaTitle, executiveSummary, etc.), include just
   the field name and new value.
3. For array fields (sections, internalLinks, externalLinks, faq), return the
   COMPLETE replacement array — not a diff.
4. If you modify a section, return the full sections array with all sections
   (unchanged ones included) to preserve order and IDs.
5. Do NOT change fields unrelated to the requested fixes.
6. Do NOT include version, articleId, slug, articleType, hubId, or other
   identity fields unless explicitly asked.
7. Return valid JSON only — no markdown fences, no explanation text.

Example — fixing meta title length:
Input issue: "F04: Meta title is 72 chars, must be 50-60"
Output: {"metaTitle": "Bhutanese Wine Terroir: Himalayan Vineyard Guide"}

Example — fixing word count (requires section changes):
Input issue: "F06: Word count 1100, spoke needs ≥1200"
Output: {"sections": [<full sections array with expanded content>]}
```

**User prompt** (assembled per request):

```
Current document:
<JSON of full CanonicalArticleDocument>

QA issues to fix:
- [F06] Add more content to meet the word count minimum for this article type.
  (Current: Word count: 1100 words, Spoke minimum: 1200)
- [W01] Adjust the H1 title to be 50-65 characters.
  (Current: H1 length: 48 chars, target: 50-65)

Return ONLY the JSON patch with changed fields.
```

### G4. Partial JSON Merge Strategy

`src/lib/qa/merge-partial.ts` implements a safe deep merge:

```typescript
export function mergePartialDocument(
  base: CanonicalArticleDocument,
  partial: Record<string, unknown>
): CanonicalArticleDocument
```

**Merge rules:**

| Field Type | Merge Behavior |
|---|---|
| Scalar (`title`, `metaTitle`, `executiveSummary`, etc.) | Replace directly |
| `author` (object) | Shallow merge: `{ ...base.author, ...partial.author }` |
| `schema` (object) | Shallow merge: `{ ...base.schema, ...partial.schema }` |
| `sections` (array) | **Full replacement** — Claude returns all sections |
| `internalLinks` (array) | **Full replacement** |
| `externalLinks` (array) | **Full replacement** |
| `faq` (array) | **Full replacement** |
| `captureComponents` (array) | **Full replacement** |
| `dataNosnippetSections` (array) | **Full replacement** |
| `heroImage` (object or null) | Replace directly |
| Identity fields (`version`, `articleId`, `slug`, `articleType`, `hubId`) | **Never overwrite** — these are excluded from the merge |

**Safety checks:**
1. If partial contains `version` AND `articleId`, assume Claude returned a full document — validate with Zod and use as-is (no merge)
2. If partial `sections` array exists, verify each section has an `id` field before replacing
3. Validate the merged document with `CanonicalArticleDocumentSchema.safeParse()` — if invalid, return the base document unchanged and report the error

### G5. Store Extension

Add to `ArticleEditorState`:
```typescript
isApplyingFix: boolean;   // Loading state for QA fix in progress
```

Add to `ArticleEditorActions`:
```typescript
applyQaFix: (checkIds: string[]) => Promise<void>;
```

**`applyQaFix` implementation:**
1. Set `isApplyingFix: true`
2. Gather `currentDocument` and `currentHtml` from state
3. Call `POST /api/articles/qa/fix` with `{ document, html, checkIds }`
4. On success:
   a. Push undo entry (pre-fix state)
   b. Set `currentDocument` from response
   c. Set `currentHtml` from response
   d. Set `qaScore` from response
   e. Clear `redoStack`
   f. Set `isApplyingFix: false`
5. On failure:
   a. Set `isApplyingFix: false`
   b. Set `statusMessage` with error

**Rewire `applyBatchFixes`:**
The existing `applyBatchFixes` action currently:
- Applies Tier 1 fixes locally (keep this)
- Composes a `pendingChatMessage` for Tier 2 and switches to chat mode (replace this)

After Guide 8B, `applyBatchFixes` should:
- Apply Tier 1 fixes locally (unchanged)
- If `tier2Ids.length > 0`, call `applyQaFix(tier2Ids)` instead of composing a chat message

### G6. UI Rewire

**ScorecardPanel changes:**

1. Import `isApplyingFix` from store
2. Add loading spinner overlay when `isApplyingFix === true`
3. "Fix Selected" button: when selection includes Tier 2 items, call `applyQaFix` instead of routing to chat
4. Disable "Fix Selected" and "Re-run QA" buttons while `isApplyingFix`

**ScorecardItem changes:**

1. Per-item Tier 2 "Fix in Chat" button → "Fix (AI)" button that calls `applyQaFix([checkId])` for single-item fix
2. Keep "Fix in Chat" as a secondary option (user may still prefer chat)

---

## H. Step-by-Step Execution Plan

### Phase 1: Shared Infrastructure

#### Step 1.1: Extract CheerioDomAdapter to shared module

**Create:** `src/lib/qa/cheerio-adapter.ts`

Copy the `CheerioDomAdapter` class exactly as it exists in `src/app/api/articles/qa/route.ts` (lines 12–50) into the new file. The class must:
- Import `cheerio`, `domhandler`, and the `DomAdapter`/`DomElement` types from `./engine`
- Export the class as a named export

```typescript
import * as cheerio from "cheerio";
import type { Element as CheerioElement } from "domhandler";
import type { DomAdapter, DomElement } from "./engine";

export class CheerioDomAdapter implements DomAdapter {
  private $: cheerio.CheerioAPI;

  constructor(html: string) {
    this.$ = cheerio.load(html);
  }

  querySelectorAll(selector: string): DomElement[] {
    const elements: DomElement[] = [];
    try {
      this.$(selector).each((_, el) => {
        const $el = this.$(el);
        elements.push({
          tagName: (el as CheerioElement).tagName?.toUpperCase() || "",
          getAttribute: (name: string) => $el.attr(name) ?? null,
          textContent: $el.text(),
        });
      });
    } catch {
      // Invalid selector — return empty
    }
    return elements;
  }

  querySelector(selector: string): DomElement | null {
    try {
      const $el = this.$(selector).first();
      if ($el.length === 0) return null;
      const el = $el.get(0) as CheerioElement;
      return {
        tagName: el.tagName?.toUpperCase() || "",
        getAttribute: (name: string) => $el.attr(name) ?? null,
        textContent: $el.text(),
      };
    } catch {
      return null;
    }
  }
}
```

**Verify:** `npm run build` passes.

---

#### Step 1.2: Update existing QA route to use shared adapter

**Modify:** `src/app/api/articles/qa/route.ts`

1. Remove the inline `CheerioDomAdapter` class (lines 12–50)
2. Remove the `import * as cheerio from "cheerio"` and `import type { Element as CheerioElement } from "domhandler"` lines
3. Add import: `import { CheerioDomAdapter } from "@/lib/qa/cheerio-adapter";`
4. The rest of the file remains unchanged — `new CheerioDomAdapter(html)` still works

The modified imports section should be:

```typescript
import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types/api";
import type { QAScore } from "@/types/qa";
import type { CanonicalArticleDocument } from "@/types/article";
import { CanonicalArticleDocumentSchema } from "@/lib/article-schema/schema";
import { runQAChecks } from "@/lib/qa";
import { CheerioDomAdapter } from "@/lib/qa/cheerio-adapter";
```

**Verify:** `npm run build` passes. Existing QA route still works.

---

#### Step 1.3: Update barrel export

**Modify:** `src/lib/qa/index.ts`

Add the new exports:

```typescript
export { runQAChecks, CHECK_REGISTRY, BrowserDomAdapter } from "./engine";
export type { DomAdapter, DomElement } from "./engine";
export { fleschKincaidGrade, countSyllables, countSentences } from "./readability";
export { getFixTier, getFixEntry, getClaudePromptTemplate } from "./fix-registry";
export { CheerioDomAdapter } from "./cheerio-adapter";
```

**Verify:** `npm run build` passes.

---

### Phase 2: Patch Prompt Builder

#### Step 2.1: Create patch-prompt.ts

**Create:** `src/lib/qa/patch-prompt.ts`

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { QAScore } from "@/types/qa";
import { getClaudePromptTemplate } from "./fix-registry";

const PATCH_SYSTEM_PROMPT = `You are a surgical article editor for Bhutan Wine Company. You receive a CanonicalArticleDocument (JSON) and a list of QA issues to fix.

CRITICAL RULES:
1. Return ONLY a JSON object containing the fields you changed — nothing else.
2. For scalar fields (title, metaTitle, metaDescription, executiveSummary, etc.), include just the field name and new value.
3. For array fields (sections, internalLinks, externalLinks, faq), return the COMPLETE replacement array — not a diff or partial array.
4. If you modify any section's content, return the FULL sections array with ALL sections (unchanged ones included) to preserve order and IDs.
5. Do NOT change fields unrelated to the requested fixes.
6. Do NOT include version, articleId, slug, articleType, or hubId unless explicitly asked to fix them.
7. Return valid JSON only — no markdown fences, no explanation text, no comments.
8. Preserve all existing section IDs exactly (e.g. "section-1", "section-2").
9. When adding internal links, use this format: { "url": "https://www.bhutanwine.com/post/slug", "anchorText": "descriptive text 3-8 words", "targetArticleId": null, "linkType": "spoke-to-hub", "sectionId": "section-N" }
10. When adding external links, use this format: { "url": "https://example.com/page", "anchorText": "descriptive text 3-8 words", "trustTier": "secondary", "sectionId": "section-N" }
11. The article is about Bhutan Wine Company — a winery in the Himalayan kingdom of Bhutan. Write in a sophisticated, luxury-brand tone appropriate for wine enthusiasts.`;

/**
 * Build the system and user prompts for a targeted Claude QA fix call.
 * Returns { system, user } strings ready for the Anthropic API.
 */
export function buildPatchPrompt(
  doc: CanonicalArticleDocument,
  checkIds: string[],
  qaScore: QAScore | null
): { system: string; user: string } {
  const issueLines: string[] = [];

  for (const id of checkIds) {
    const template = getClaudePromptTemplate(id);
    // Find the matching QA result for context
    const result = qaScore?.results.find(
      (r) => r.check.id === id && !r.passed
    );
    const context = result ? ` (Current: ${result.message})` : "";
    issueLines.push(`- [${id}] ${template || "Fix this issue."}${context}`);
  }

  const user = `Current document:
${JSON.stringify(doc, null, 2)}

QA issues to fix:
${issueLines.join("\n")}

Return ONLY the JSON patch with changed fields.`;

  return { system: PATCH_SYSTEM_PROMPT, user };
}
```

**Verify:** `npm run build` passes.

---

### Phase 3: Deep Merge Utility

#### Step 3.1: Create merge-partial.ts

**Create:** `src/lib/qa/merge-partial.ts`

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import { CanonicalArticleDocumentSchema } from "@/lib/article-schema/schema";

/** Fields that must NEVER be overwritten by a patch */
const IDENTITY_FIELDS = new Set([
  "version",
  "articleId",
  "slug",
  "articleType",
  "hubId",
]);

/** Fields that are objects and should be shallow-merged */
const OBJECT_MERGE_FIELDS = new Set(["author", "schema"]);

/** Fields that are arrays and should be fully replaced (not concatenated) */
const ARRAY_REPLACE_FIELDS = new Set([
  "sections",
  "internalLinks",
  "externalLinks",
  "faq",
  "captureComponents",
  "dataNosnippetSections",
]);

export interface MergeResult {
  document: CanonicalArticleDocument;
  merged: boolean;
  error: string | null;
}

/**
 * Merge a partial JSON response from Claude into a full CanonicalArticleDocument.
 *
 * If the partial appears to be a full document (has version + articleId),
 * validates and returns it directly. Otherwise performs a field-by-field merge.
 */
export function mergePartialDocument(
  base: CanonicalArticleDocument,
  partial: Record<string, unknown>
): MergeResult {
  // Safety: if partial is empty or not an object, return base unchanged
  if (!partial || typeof partial !== "object" || Object.keys(partial).length === 0) {
    return { document: base, merged: false, error: "Empty or invalid partial response" };
  }

  // Check if Claude returned a full document instead of a patch
  if ("version" in partial && "articleId" in partial && "sections" in partial) {
    const parsed = CanonicalArticleDocumentSchema.safeParse(partial);
    if (parsed.success) {
      return {
        document: parsed.data as CanonicalArticleDocument,
        merged: true,
        error: null,
      };
    }
    // Full doc failed validation — fall through to patch merge
  }

  // Perform field-by-field merge
  const merged = structuredClone(base);

  for (const [key, value] of Object.entries(partial)) {
    // Skip identity fields
    if (IDENTITY_FIELDS.has(key)) continue;

    // Skip if field doesn't exist on the document type
    if (!(key in merged)) continue;

    if (OBJECT_MERGE_FIELDS.has(key) && value && typeof value === "object" && !Array.isArray(value)) {
      // Shallow merge for author, schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[key] = { ...(merged as any)[key], ...value };
    } else if (ARRAY_REPLACE_FIELDS.has(key) && Array.isArray(value)) {
      // Full array replacement
      if (key === "sections") {
        // Validate that each section has an id
        const validSections = value.every(
          (s: unknown) => typeof s === "object" && s !== null && "id" in s
        );
        if (!validSections) continue; // Skip invalid sections array
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[key] = value;
    } else {
      // Scalar replacement (title, metaTitle, executiveSummary, etc.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[key] = value;
    }
  }

  // Validate the merged document
  const validated = CanonicalArticleDocumentSchema.safeParse(merged);
  if (!validated.success) {
    return {
      document: base,
      merged: false,
      error: `Merged document failed validation: ${validated.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  return {
    document: validated.data as CanonicalArticleDocument,
    merged: true,
    error: null,
  };
}

/**
 * Parse Claude's text response into a JSON object.
 * Handles common response artifacts: markdown fences, trailing text, etc.
 */
export function parsePartialJson(text: string): Record<string, unknown> | null {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Try direct parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    // Try to find the first { ... } block
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const extracted = cleaned.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(extracted);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Fall through
      }
    }
    return null;
  }
}
```

**Verify:** `npm run build` passes.

---

### Phase 4: Fix Endpoint

#### Step 4.1: Create the fix route

**Create:** `src/app/api/articles/qa/fix/route.ts`

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { getClaudeClient, getModelId } from "@/lib/claude/client";
import { CanonicalArticleDocumentSchema } from "@/lib/article-schema/schema";
import { runQAChecks } from "@/lib/qa";
import { getFixEntry, getFixTier } from "@/lib/qa/fix-registry";
import { CheerioDomAdapter } from "@/lib/qa/cheerio-adapter";
import { buildPatchPrompt } from "@/lib/qa/patch-prompt";
import { mergePartialDocument, parsePartialJson } from "@/lib/qa/merge-partial";
import { renderArticle } from "@/lib/renderer";
import { TEMPLATE_VERSION } from "@/lib/renderer/compiled-template";
import { setByPath } from "@/lib/undo-redo/undo-manager";
import type { CanonicalArticleDocument } from "@/types/article";
import type { ApiResponse } from "@/types/api";
import type { QAScore } from "@/types/qa";

const FixRequestSchema = z.object({
  document: z.record(z.string(), z.unknown()),
  html: z.string().min(1),
  checkIds: z.array(z.string()).min(1).max(20),
});

interface FixResponseData {
  document: CanonicalArticleDocument;
  html: string;
  qaScore: QAScore;
  appliedFixes: {
    tier1: string[];
    tier2: string[];
  };
  tier1Summary: string;
  claudeTokensUsed: number | null;
}

export async function POST(request: Request) {
  try {
    // 1. Auth check — this endpoint costs money
    await requireRole("admin", "editor");

    // 2. Parse and validate request
    const body = await request.json();
    const parsed = FixRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parsed.error.flatten(),
          },
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // 3. Validate the document
    const docParsed = CanonicalArticleDocumentSchema.safeParse(parsed.data.document);
    if (!docParsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid document structure",
            details: docParsed.error.issues,
          },
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    let doc = docParsed.data as CanonicalArticleDocument;
    const { checkIds } = parsed.data;

    // 4. Split into tiers
    const tier1Ids = checkIds.filter((id) => getFixTier(id) === 1);
    const tier2Ids = checkIds.filter((id) => getFixTier(id) === 2);

    // 5. Apply Tier 1 fixes (deterministic)
    const tier1Applied: string[] = [];
    const tier1Summaries: string[] = [];

    for (const checkId of tier1Ids) {
      const entry = getFixEntry(checkId);
      if (!entry?.fix) continue;
      const result = entry.fix(doc);
      if (!result) continue;

      for (const mutation of result.mutations) {
        doc = setByPath(doc, mutation.cadPath, mutation.value);
      }
      tier1Applied.push(checkId);
      tier1Summaries.push(result.summary);
    }

    // 6. Apply Tier 2 fixes (Claude API)
    let claudeTokensUsed: number | null = null;

    if (tier2Ids.length > 0) {
      // Run a quick QA to get current result messages for context
      const preDom = new CheerioDomAdapter(parsed.data.html);
      const preQaScore = runQAChecks(doc, parsed.data.html, preDom);

      // Build prompt
      const { system, user } = buildPatchPrompt(doc, tier2Ids, preQaScore);

      // Call Claude (non-streaming, small output)
      const client = getClaudeClient();
      const response = await client.messages.create({
        model: getModelId(),
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      });

      claudeTokensUsed = response.usage?.output_tokens ?? null;

      // Extract text from response
      const text = response.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("");

      // Parse partial JSON
      const partial = parsePartialJson(text);
      if (partial) {
        const mergeResult = mergePartialDocument(doc, partial);
        if (mergeResult.merged) {
          doc = mergeResult.document;
        }
        // If merge failed, doc stays as-is (Tier 1 fixes still applied)
      }
    }

    // 7. Re-render HTML
    const rendered = renderArticle({
      document: doc,
      htmlOverrides: null,
      templateVersion: TEMPLATE_VERSION,
    });

    // 8. Re-run QA
    const dom = new CheerioDomAdapter(rendered.html);
    const qaScore = runQAChecks(doc, rendered.html, dom);

    // 9. Return result
    return NextResponse.json({
      success: true,
      data: {
        document: doc,
        html: rendered.html,
        qaScore,
        appliedFixes: {
          tier1: tier1Applied,
          tier2: tier2Ids,
        },
        tier1Summary: tier1Summaries.join("; ") || "None",
        claudeTokensUsed,
      },
    } as ApiResponse<FixResponseData>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_REQUIRED", message: "Authentication required" },
        } as ApiResponse<never>,
        { status: 401 }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_FORBIDDEN", message: "Admin or editor role required" },
        } as ApiResponse<never>,
        { status: 403 }
      );
    }
    if (message === "GENERATION_FAILED") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "GENERATION_FAILED", message: "Claude API key not configured" },
        } as ApiResponse<never>,
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: message,
        },
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}
```

**Verify:** `npm run build` passes. Route compiles and appears in the build output.

---

### Phase 5: Store Extension

#### Step 5.1: Extend UI types

**Modify:** `src/types/ui.ts`

1. Add to `ArticleEditorState` (after `pendingChatMessage: string;`):

```typescript
  isApplyingFix: boolean;
```

2. Add to `ArticleEditorActions` (after `applyBatchFixes: (checkIds: string[]) => void;`):

```typescript
  applyQaFix: (checkIds: string[]) => Promise<void>;
```

---

#### Step 5.2: Implement applyQaFix in store

**Modify:** `src/lib/store/article-store.ts`

1. Add `isApplyingFix: false` to `initialState`.

2. Add `isApplyingFix: false` to the `setSelectedArticle` reset block.

3. Add the `applyQaFix` action after `applyBatchFixes`:

```typescript
    applyQaFix: async (checkIds: string[]) => {
      const state = get();
      if (!state.currentDocument || !state.currentHtml || checkIds.length === 0) return;

      set({ isApplyingFix: true, statusMessage: "Applying QA fixes..." });

      try {
        const response = await fetch("/api/articles/qa/fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: state.currentDocument,
            html: state.currentHtml,
            checkIds,
          }),
        });

        const result = await response.json();

        if (!result.success) {
          set({
            isApplyingFix: false,
            statusMessage: `Fix failed: ${result.error?.message || "Unknown error"}`,
          });
          return;
        }

        // Push undo before applying changes
        const undoEntry = createUndoEntry(
          state.currentDocument,
          state.currentHtml,
          state.htmlOverrides,
          `QA fix: ${checkIds.length} issue(s)`
        );

        set({
          currentDocument: result.data.document,
          currentHtml: result.data.html,
          qaScore: result.data.qaScore,
          undoStack: pushToStack(state.undoStack, undoEntry),
          redoStack: [],
          isApplyingFix: false,
          statusMessage: "",
        });
      } catch (error) {
        set({
          isApplyingFix: false,
          statusMessage: `Fix failed: ${error instanceof Error ? error.message : "Network error"}`,
        });
      }
    },
```

4. Rewire `applyBatchFixes` — replace the Tier 2 chat path. Change the section starting at `// Compose targeted Claude prompt for Tier 2 items` (approximately lines 455–469):

**Before:**
```typescript
      // Compose targeted Claude prompt for Tier 2 items
      let pendingChatMessage = state.pendingChatMessage;
      if (tier2Ids.length > 0) {
        pendingChatMessage = composeBatchClaudePrompt(tier2Ids, state.qaScore);
      }

      set({
        currentDocument: updatedDoc,
        currentHtml: newHtml,
        undoStack: pushToStack(state.undoStack, undoEntry),
        redoStack: [],
        qaScore,
        pendingChatMessage,
        // Switch to chat mode if there are Tier 2 items to send
        ...(tier2Ids.length > 0 ? { editingMode: "chat" as const, isScorecardOpen: false } : {}),
      });
```

**After:**
```typescript
      set({
        currentDocument: updatedDoc,
        currentHtml: newHtml,
        undoStack: pushToStack(state.undoStack, undoEntry),
        redoStack: [],
        qaScore,
      });

      // Route Tier 2 items through the targeted fix endpoint
      if (tier2Ids.length > 0) {
        get().applyQaFix(tier2Ids);
      }
```

**Verify:** `npm run build` passes.

---

### Phase 6: UI Rewire

#### Step 6.1: Update ScorecardPanel

**Modify:** `src/components/scorecard/ScorecardPanel.tsx`

1. Add `isApplyingFix` to store bindings:

```typescript
const isApplyingFix = useArticleStore((s) => s.isApplyingFix);
```

2. Add `applyQaFix` to destructured actions:

```typescript
const {
  setIsScorecardOpen,
  setEditingMode,
  setPendingChatMessage,
  runQa,
  applyDeterministicFix,
  applyBatchFixes,
  applyQaFix,
} = useArticleStore();
```

3. Replace `handleFixSelected` with a version that splits Tier 1 and Tier 2:

```typescript
const handleFixSelected = useCallback(() => {
  if (selectedIds.size === 0) return;
  const ids = Array.from(selectedIds);
  const t1 = ids.filter((id) => getFixTier(id) === 1);
  const t2 = ids.filter((id) => getFixTier(id) === 2);

  // Apply Tier 1 deterministically (sync)
  if (t1.length > 0 && t2.length === 0) {
    applyBatchFixes(t1);
  } else if (t1.length === 0 && t2.length > 0) {
    applyQaFix(t2);
  } else {
    // Mixed: apply Tier 1 first, then Tier 2 via targeted endpoint
    applyBatchFixes(t1);
    applyQaFix(t2);
  }
  setSelectedIds(new Set());
}, [selectedIds, applyBatchFixes, applyQaFix]);
```

4. Add a loading overlay inside the panel (at the top of the scrollable area, before the result sections):

```tsx
{isApplyingFix && (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: "rgba(255, 255, 255, 0.85)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 25,
      gap: "12px",
    }}
  >
    <div
      style={{
        width: "24px",
        height: "24px",
        border: "3px solid #e8e6e6",
        borderTopColor: "#bc9b5d",
        borderRadius: "50%",
        animation: "bwc-spin 0.8s linear infinite",
      }}
    />
    <span style={{ fontSize: "13px", color: "#414141", fontWeight: 500 }}>
      Applying AI fixes...
    </span>
  </div>
)}
```

5. Add a `<style>` tag for the spinner animation inside the component (in the JSX, inside the top-level div):

```tsx
<style>{`@keyframes bwc-spin { to { transform: rotate(360deg); } }`}</style>
```

6. Disable buttons while applying:

For the "Fix Selected" button, add `disabled={isApplyingFix}` and conditionally reduce opacity:
```typescript
opacity: isApplyingFix ? 0.5 : 1,
cursor: isApplyingFix ? "not-allowed" : "pointer",
```

For the "Re-run QA" button, add the same disabled/opacity treatment.

**Verify:** `npm run build` passes.

---

#### Step 6.2: Update barrel export

**Modify:** `src/lib/qa/index.ts`

Final state:

```typescript
export { runQAChecks, CHECK_REGISTRY, BrowserDomAdapter } from "./engine";
export type { DomAdapter, DomElement } from "./engine";
export { fleschKincaidGrade, countSyllables, countSentences } from "./readability";
export { getFixTier, getFixEntry, getClaudePromptTemplate } from "./fix-registry";
export { CheerioDomAdapter } from "./cheerio-adapter";
export { buildPatchPrompt } from "./patch-prompt";
export { mergePartialDocument, parsePartialJson } from "./merge-partial";
```

**Verify:** `npm run build` passes.

---

### Phase 7: Verification

#### Step 7.1: Type check

```bash
npx tsc --noEmit
```

Expected: zero errors.

#### Step 7.2: Build

```bash
npm run build
```

Expected: clean build, new route `/api/articles/qa/fix` visible in output.

#### Step 7.3: Regenerate API route docs

```bash
npm run gen:api-routes
```

Expected: `docs/_generated/api-routes.md` updated with the new `/api/articles/qa/fix` route.

---

## I. Gate Checks

### Lint & Type Gate

```bash
npx tsc --noEmit          # Zero errors
npx next lint              # Zero errors (warnings acceptable)
```

### Integration Gate

Test the fix endpoint manually:

```bash
# From the project root, with dev server running:
curl -X POST http://localhost:3000/api/articles/qa/fix \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "document": { /* valid CanonicalArticleDocument */ },
    "html": "<html>...</html>",
    "checkIds": ["F04", "F17"]
  }'
```

Expected response structure:
```json
{
  "success": true,
  "data": {
    "document": { ... },
    "html": "...",
    "qaScore": { "total": ..., "canFinalize": ... },
    "appliedFixes": { "tier1": ["F04", "F17"], "tier2": [] },
    "tier1Summary": "Trimmed meta title...; Set canonical URL...",
    "claudeTokensUsed": null
  }
}
```

### Human Gate

1. Open the app at `http://localhost:3000/dashboard`
2. Generate or load an article
3. Click **Run QA** — scorecard appears
4. Select a **Tier 1** issue (e.g., F04 meta title) — click **Auto Fix** — verify it fixes instantly
5. Select a **Tier 2** issue (e.g., F06 word count) — click **Fix Selected** — verify:
   - Loading spinner appears in scorecard
   - After a few seconds, document updates
   - HTML preview refreshes
   - QA scorecard re-runs automatically
   - Undo works (Ctrl+Z restores pre-fix state)
6. Select **multiple issues** (mix of Tier 1 and Tier 2) — click **Fix Selected** — verify both tiers apply

---

## J. Acceptance Criteria

1. `CheerioDomAdapter` is in a shared module importable by both `qa/route.ts` and `qa/fix/route.ts`
2. `POST /api/articles/qa/fix` returns 401 without auth, 403 for viewers, 200 for admin/editor
3. Tier 1 fixes (F04, F05, F10, F14, F17, W04, W05, W18) are applied server-side without Claude
4. Tier 2 fixes call Claude with `max_tokens: 4096` (not the full 16384/32768)
5. Claude's partial JSON response is safely merged into the document using `mergePartialDocument`
6. Invalid Claude responses do not corrupt the document — Tier 1 fixes still applied
7. Store `applyQaFix` pushes undo before mutation and re-runs QA after
8. ScorecardPanel shows loading state during fix and updates atomically on completion
9. `npm run build` passes with zero errors
10. Existing QA route (`POST /api/articles/qa`) still works unchanged

---

## K. Risks and Failure Modes

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Claude returns malformed JSON instead of valid patch | Medium | Low | `parsePartialJson` handles markdown fences and brace extraction; `mergePartialDocument` validates with Zod; base document returned unchanged on failure |
| Claude modifies identity fields (articleId, slug) | Low | Medium | `IDENTITY_FIELDS` set in `mergePartialDocument` blocks these from being overwritten |
| Claude returns full document instead of patch | Medium | Low | `mergePartialDocument` detects this case and validates with Zod before using |
| Sections array from Claude has wrong IDs | Low | High | Validation requires each section to have an `id` field; Zod validation catches schema violations |
| Network timeout on Claude API call | Low | Low | Standard error handling returns 500; user can retry; document state unchanged |
| Race condition: user clicks fix while another fix is in progress | Low | Low | `isApplyingFix` flag prevents concurrent fix attempts; buttons disabled during fix |
| Auth token expired mid-request | Low | Low | `requireRole` throws early before any document mutation |

---

## L. File Dependency Map

```
src/lib/qa/cheerio-adapter.ts
  ← imports: cheerio, domhandler, ./engine (DomAdapter, DomElement)
  → used by: /api/articles/qa/route.ts, /api/articles/qa/fix/route.ts

src/lib/qa/patch-prompt.ts
  ← imports: @/types/article, @/types/qa, ./fix-registry
  → used by: /api/articles/qa/fix/route.ts

src/lib/qa/merge-partial.ts
  ← imports: @/types/article, @/lib/article-schema/schema
  → used by: /api/articles/qa/fix/route.ts

src/app/api/articles/qa/fix/route.ts
  ← imports: zod, @/lib/auth/session, @/lib/claude/client,
             @/lib/article-schema/schema, @/lib/qa,
             ./cheerio-adapter, ./patch-prompt, ./merge-partial,
             @/lib/renderer, @/lib/undo-redo/undo-manager
  → called by: article-store.ts (applyQaFix action)

src/lib/store/article-store.ts
  ← modified: adds applyQaFix action, isApplyingFix state
  → used by: ScorecardPanel.tsx

src/components/scorecard/ScorecardPanel.tsx
  ← modified: wires Fix Selected to applyQaFix, adds loading overlay
  → renders: ScorecardItem.tsx (unchanged)
```
