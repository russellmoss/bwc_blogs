# Implementation Guide 8: Article Scorecard & QA System

**Guide type:** Feature implementation
**Depends on:** Guides 4 (canonical doc + validation), 6 (UI shell + store), 7 (canvas edit + iframe patterns)
**Milestone:** M5 — "Quality assured"
**Last updated:** 2026-03-02

---

## A. Objective

Build the deterministic QA engine that grades articles against every measurable rule in the Master SOP. When this guide completes, a user can:

1. Click **Run QA** in the preview toolbar to score the current article
2. See a **ScorecardPanel** slide out from the right edge of the preview pane, organized by FAIL / WARN / INFO sections
3. See a numeric score (e.g. "39/42") and a clear **canFinalize** / **blocked** status
4. Click any failed or warned check to **highlight the offending element** in the preview iframe (via `data-cad-path` selectors and CSS injection)
5. Click **Fix in Chat** to switch to Chat mode with a pre-populated fix suggestion
6. Click **Fix in Canvas** to switch to Canvas mode with the element already highlighted
7. See the scorecard persist across mode switches and automatically re-run after edits
8. Use the **POST /api/articles/qa** endpoint for server-side QA validation (used by finalization in Guide 11)

The entire QA engine is deterministic — **zero LLM calls**, zero API token cost. All checks run against the `CanonicalArticleDocument` and/or rendered HTML.

---

## B. Scope

### In Scope
- QA engine: `src/lib/qa/engine.ts` — orchestrates all checks, calls `validateCanonicalDocument` from Guide 4, maps results to `QAResult[]`, then runs 27 additional checks
- Readability calculator: `src/lib/qa/readability.ts` — pure-function Flesch-Kincaid grade level
- Check modules: `src/lib/qa/checks/` — organized by category (structure, metadata, links, images, schema, content, readability)
- Store extension: add `qaScore`, `isScorecardOpen`, and actions to `article-store.ts`
- Scorecard UI: `src/components/scorecard/ScorecardPanel.tsx` — slide-out overlay with categorized results
- Scorecard item: `src/components/scorecard/ScorecardItem.tsx` — individual check row with actions
- Click-to-highlight: CSS injection into iframe via `window.__bwcIframeRef` pattern
- API route: `POST /api/articles/qa` — accepts document + HTML, returns `QAScore`
- PreviewToolbar: add "Run QA" button
- PreviewPanel: mount ScorecardPanel overlay
- Install `cheerio` for server-side HTML parsing in the API route

### Out of Scope
- External link liveness checking (W27) — deferred to Guide 11 finalization flow (requires async network requests, too slow for interactive QA)
- Internal link registry validation (F16) — deferred to Guide 11 (requires DB query against content_map)
- Database persistence of QA scores — Guide 11 writes `qa_score` and `qa_failures` to `article_html` on finalization
- Photo Manager and Cloudinary upload (Guide 9)
- Content Map Dashboard (Guide 10)
- Finalization flow and QA gate enforcement (Guide 11)

---

## C. Depends On

| Guide | What This Guide Uses From It |
|---|---|
| 4 | `validateCanonicalDocument()` from `@/lib/article-schema/validate`, `countWords()` / `countDocumentWords()` (must be exported), `CanonicalArticleDocumentSchema` Zod schema |
| 6 | `useArticleStore`, `PreviewPanel`, `PreviewToolbar`, `PreviewIframe`, `ArticleEditorState`, `ArticleEditorActions` |
| 7 | `window.__bwcIframeRef` global ref pattern, `data-cad-path` attributes on DOM elements, canvas edit overlay z-index conventions, `CanvasEditOverlay` CSS injection pattern |

All dependencies verified present and working (see `guides/exploration-results-8.md` §3).

---

## D. Shared Contracts Referenced

### Types (from `src/types/`)
- `CanonicalArticleDocument`, `ArticleSection`, `InternalLinkRef`, `ExternalLinkRef`, `ImagePlacement` — `src/types/article.ts`
- `QACheck`, `QAResult`, `QAScore`, `CheckSeverity` — `src/types/qa.ts`
- `ArticleEditorState`, `ArticleEditorActions`, `EditingMode` — `src/types/ui.ts`
- `ApiResponse`, `ValidationResult`, `ErrorCode` — `src/types/api.ts`

### Library Modules
- `validateCanonicalDocument`, `countWords`, `countDocumentWords` — `@/lib/article-schema/validate`
- `useArticleStore`, `selectEffectiveHtml` — `@/lib/store/article-store`
- `renderArticle`, `TEMPLATE_VERSION` — `@/lib/renderer`

### Architecture Doc References
- Orchestration Doc §7, Guide 8 Spec: "QA Scorecard"
- Orchestration Doc Appendix D: Complete QA Check Registry (17 FAIL + 26 WARN)
- `CLAUDE.md` §"Renderer FAIL-Level Constraints": all FAIL-level rules summarized
- SOP §1–§12: source of truth for all check rules

---

## E. Existing Constraints to Preserve

1. **`npm run build` must pass** with zero errors after every phase
2. **All 13 existing API routes** must remain functional — this guide creates 1 new route
3. **Do not modify** files owned by Guides 1–5 except `src/lib/article-schema/validate.ts` (export `countWords` and `countDocumentWords`)
4. **Import conventions**: `@/` path alias, `import type` for type-only imports, named exports only
5. **Styling**: Inline `style={{}}` with hex color strings. Gold: `#bc9b5d`, text: `#414141`, red: `#b91c1c`, amber: `#a16207`, green: `#15803d`
6. **Store pattern**: `create<State & Actions>((set, get) => ({...}))`, selectors as standalone exports
7. **iframe sandbox**: Keep `allow-same-origin`. Access via `window.__bwcIframeRef.contentDocument`
8. **Scorecard z-index**: Use z-index 20, above CanvasEditOverlay (z-index 10). Scorecard and canvas edit are mutually exclusive.
9. **QA engine is pure**: No DB calls, no LLM calls, no network requests. Input: `CanonicalArticleDocument` + HTML string. Output: `QAScore`.

---

## F. Files Created / Modified

### New Files (10 total)

| File | Purpose |
|---|---|
| `src/lib/qa/engine.ts` | QA engine — orchestrates all checks, calls validate.ts, produces `QAScore` |
| `src/lib/qa/readability.ts` | Pure-function Flesch-Kincaid grade level calculator |
| `src/lib/qa/checks/structure-checks.ts` | F01–F02, W01–W03: heading hierarchy, H1 count, heading lengths |
| `src/lib/qa/checks/metadata-checks.ts` | F03–F05, W04–W05: executive summary, meta title/description, slug |
| `src/lib/qa/checks/link-checks.ts` | F07–F09, F15, W06–W09, W11: internal/external link rules, anchor text |
| `src/lib/qa/checks/image-checks.ts` | F11–F12, W14–W17, W20–W21: alt text, dimensions, performance, distribution |
| `src/lib/qa/checks/content-checks.ts` | F06, W22–W24, W26: word count, banned phrases, entity placement, citable paragraphs |
| `src/lib/qa/checks/schema-checks.ts` | F10, F13–F14, F17, W18–W19: BlogPosting, author, dates, canonical URL, data-nosnippet |
| `src/lib/qa/index.ts` | Barrel export |
| `src/components/scorecard/ScorecardPanel.tsx` | Slide-out overlay with categorized check results, highlight-on-click, fix actions |
| `src/components/scorecard/ScorecardItem.tsx` | Individual check result row with status icon, message, action buttons |
| `src/components/scorecard/index.ts` | Barrel export |
| `src/app/api/articles/qa/route.ts` | POST route — accepts document + HTML, returns `QAScore` |

### Modified Files (5 total)

| File | Change |
|---|---|
| `src/lib/article-schema/validate.ts` | Export `countWords` and `countDocumentWords` (change from `function` to `export function`) |
| `src/types/ui.ts` | Add `qaScore: QAScore \| null` and `isScorecardOpen: boolean` to `ArticleEditorState`; add `setQaScore`, `setIsScorecardOpen`, `runQa` to `ArticleEditorActions` |
| `src/lib/store/article-store.ts` | Add QA state fields + actions; add `selectQaScore` and `selectIsScorecardOpen` selectors |
| `src/components/preview/PreviewToolbar.tsx` | Add "Run QA" button (with shield icon); add QA score badge |
| `src/components/preview/PreviewPanel.tsx` | Import and mount `ScorecardPanel` overlay when `isScorecardOpen` is true |

---

## G. Technical Design

### G1. QA Engine Architecture

The QA engine follows a **wrap-and-extend** strategy:

```
┌─────────────────────────────────────────────────────┐
│  runQAChecks(doc, html)                              │
│                                                      │
│  1. Call validateCanonicalDocument(doc)               │
│     → Map ValidationResult.errors to QAResult[] (FAIL)│
│     → Map ValidationResult.warnings to QAResult[] (WARN)│
│                                                      │
│  2. Parse HTML with DOMParser (client) or cheerio (server)│
│                                                      │
│  3. Run additional check modules:                    │
│     ├── structureChecks(doc, dom)    → QAResult[]    │
│     ├── metadataChecks(doc)          → QAResult[]    │
│     ├── linkChecks(doc)              → QAResult[]    │
│     ├── imageChecks(doc, dom)        → QAResult[]    │
│     ├── contentChecks(doc)           → QAResult[]    │
│     ├── schemaChecks(doc, dom)       → QAResult[]    │
│     └── readabilityCheck(doc)        → QAResult[]    │
│                                                      │
│  4. Deduplicate (validation checks vs new checks)    │
│  5. Score: sum all result.score values               │
│  6. Return QAScore                                   │
└─────────────────────────────────────────────────────┘
```

**Key design decisions:**
- The engine accepts a `CanonicalArticleDocument` and an HTML string
- On the client, HTML is parsed with `new DOMParser().parseFromString(html, "text/html")`
- On the server (API route), HTML is parsed with `cheerio.load(html)`
- The engine exports a universal interface; platform-specific parsing is injected

### G2. Validation Result Mapping

`validateCanonicalDocument()` returns `ValidationResult` with `errors[]` and `warnings[]`. The QA engine maps these to `QAResult[]`:

```typescript
function mapValidationToQAResults(validation: ValidationResult): QAResult[] {
  const results: QAResult[] = [];

  // Map errors → QAResult with severity "fail"
  for (const err of validation.errors) {
    const checkId = mapPathToCheckId(err.path); // e.g. "metaTitle" → "F04"
    results.push({
      check: CHECK_REGISTRY[checkId],
      passed: false,
      score: 0,
      message: err.message,
      elementPath: mapPathToElementPath(err.path),
      fixSuggestion: generateFixSuggestion(checkId, err.message),
    });
  }

  // Map warnings → QAResult with severity "warn"
  for (const warn of validation.warnings) {
    results.push({
      check: { id: "W09", name: "Anchor text length", severity: "warn", rule: warn, category: "links" },
      passed: false,
      score: 0.5,
      message: warn,
      elementPath: null,
      fixSuggestion: null,
    });
  }

  return results;
}
```

### G3. Check Registry

All checks are defined in a central registry constant:

```typescript
export const CHECK_REGISTRY: Record<string, QACheck> = {
  // FAIL-level (17)
  F01: { id: "F01", name: "H1 present", severity: "fail", rule: "Exactly 1 <h1> element", category: "structure" },
  F02: { id: "F02", name: "Heading hierarchy", severity: "fail", rule: "No skips (H1→H3 without H2), no H4–H6", category: "structure" },
  F03: { id: "F03", name: "Executive summary", severity: "fail", rule: "Present, 25–40 words", category: "metadata" },
  F04: { id: "F04", name: "Meta title", severity: "fail", rule: "Non-empty, 50–60 characters", category: "metadata" },
  F05: { id: "F05", name: "Meta description", severity: "fail", rule: "Non-empty, 150–160 characters", category: "metadata" },
  F06: { id: "F06", name: "Word count", severity: "fail", rule: "Hub≥2500, Spoke≥1200, News≥600", category: "content" },
  F07: { id: "F07", name: "Internal links min", severity: "fail", rule: "Hub≥8, Spoke≥5, News≥3", category: "links" },
  F08: { id: "F08", name: "Core page links", severity: "fail", rule: "Hub≥4, Spoke≥3, News≥2", category: "links" },
  F09: { id: "F09", name: "External links min", severity: "fail", rule: "Hub≥5, Spoke≥3, News≥2", category: "links" },
  F10: { id: "F10", name: "BlogPosting schema", severity: "fail", rule: "Required fields present", category: "schema" },
  F11: { id: "F11", name: "Hero image alt", severity: "fail", rule: "Non-empty, descriptive alt text", category: "images" },
  F12: { id: "F12", name: "No blank alt", severity: "fail", rule: "Every <img> has alt attribute (descriptive or alt=\"\")", category: "images" },
  F13: { id: "F13", name: "Author byline", severity: "fail", rule: "Name + credentials present", category: "schema" },
  F14: { id: "F14", name: "Publication date", severity: "fail", rule: "Valid ISO 8601 date", category: "schema" },
  F15: { id: "F15", name: "Prohibited anchor text", severity: "fail", rule: "No 'click here', 'read more', 'learn more'", category: "links" },
  F16: { id: "F16", name: "Internal links valid", severity: "fail", rule: "All hrefs exist in registry (deferred to Guide 11)", category: "links" },
  F17: { id: "F17", name: "Canonical URL", severity: "fail", rule: "Starts with https://www.bhutanwine.com/", category: "schema" },

  // WARN-level (26)
  W01: { id: "W01", name: "H1 length", severity: "warn", rule: "50–65 characters", category: "structure" },
  W02: { id: "W02", name: "H2 count range", severity: "warn", rule: "Hub 5–8, Spoke 3–5, News 2–3", category: "structure" },
  W03: { id: "W03", name: "Duplicate headings", severity: "warn", rule: "No identical heading text", category: "structure" },
  W04: { id: "W04", name: "Meta title ≠ H1", severity: "warn", rule: "Similar but not identical", category: "metadata" },
  W05: { id: "W05", name: "Slug length", severity: "warn", rule: "3–6 words", category: "metadata" },
  W06: { id: "W06", name: "Spoke → parent hub link", severity: "warn", rule: "At least 1 link to parent hub", category: "links" },
  W07: { id: "W07", name: "Sibling spoke links", severity: "warn", rule: "1–2 links to sibling spokes", category: "links" },
  W08: { id: "W08", name: "Cross-cluster link", severity: "warn", rule: "At least 1 link to different cluster", category: "links" },
  W09: { id: "W09", name: "Anchor text length", severity: "warn", rule: "3–8 words per anchor", category: "links" },
  W10: { id: "W10", name: "External target=_blank", severity: "warn", rule: "All external links open in new tab", category: "links" },
  W11: { id: "W11", name: "No competitor links", severity: "warn", rule: "No winery/e-commerce competitor URLs", category: "links" },
  W12: { id: "W12", name: "External link spread", severity: "warn", rule: "Not clustered in 1–2 sections", category: "links" },
  W13: { id: "W13", name: "Source trust tiers", severity: "warn", rule: "≥1 primary source link", category: "links" },
  W14: { id: "W14", name: "Image count min", severity: "warn", rule: "Hub≥5, Spoke≥3, News≥1", category: "images" },
  W15: { id: "W15", name: "Visual spacing", severity: "warn", rule: "≤400 consecutive words without image", category: "images" },
  W16: { id: "W16", name: "Alt text length", severity: "warn", rule: "Informative images: 10–25 words", category: "images" },
  W17: { id: "W17", name: "Captions on locations", severity: "warn", rule: "Location/process images should have captions", category: "images" },
  W18: { id: "W18", name: "FAQPage schema sync", severity: "warn", rule: "Present iff FAQ section exists", category: "schema" },
  W19: { id: "W19", name: "data-nosnippet", severity: "warn", rule: "On pricing/legal content", category: "schema" },
  W20: { id: "W20", name: "Hero image perf", severity: "warn", rule: "loading=\"eager\" + fetchpriority=\"high\"", category: "images" },
  W21: { id: "W21", name: "Image dimensions", severity: "warn", rule: "All images have width + height attributes", category: "images" },
  W22: { id: "W22", name: "No hardcoded data", severity: "warn", rule: "No $XXX or XX.X% patterns", category: "content" },
  W23: { id: "W23", name: "Banned superlatives", severity: "warn", rule: "No 'best winery', 'finest wines', etc.", category: "content" },
  W24: { id: "W24", name: "Main entity placement", severity: "warn", rule: "Entity in H1, exec summary, meta, first 100 words", category: "content" },
  W25: { id: "W25", name: "Reading level", severity: "warn", rule: "Flesch-Kincaid Grade 10–14", category: "readability" },
  W26: { id: "W26", name: "Citable paragraphs", severity: "warn", rule: "≥3 standalone factual paragraphs", category: "content" },
};
```

### G4. Flesch-Kincaid Readability

Pure-function implementation in `src/lib/qa/readability.ts`:

```typescript
/** Count syllables in a single word using vowel-group heuristic */
export function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;

  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Silent 'e' at end (but not "le" endings like "bottle")
  if (word.endsWith("e") && !word.endsWith("le")) count--;
  // Silent 'es' / 'ed' endings
  if (word.endsWith("es") || word.endsWith("ed")) count--;

  return Math.max(count, 1);
}

/** Count sentences by splitting on terminal punctuation */
export function countSentences(text: string): number {
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter(s => s.trim().length > 0);
  return Math.max(sentences.length, 1);
}

/** Calculate Flesch-Kincaid Grade Level */
export function fleschKincaidGrade(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 0;

  const totalWords = words.length;
  const totalSentences = countSentences(text);
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  return 0.39 * (totalWords / totalSentences) + 11.8 * (totalSyllables / totalWords) - 15.59;
}
```

Target range: FK Grade 10–14 (luxury wine audience). Below 10 = too simple. Above 14 = too academic.

### G5. DOM Parsing Strategy

**Client-side (browser):** Use native `DOMParser` — zero-cost, instant:

```typescript
function parseHtmlClient(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}
```

**Server-side (API route):** Use `cheerio` for read-only DOM queries:

```typescript
import * as cheerio from "cheerio";

function parseHtmlServer(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}
```

The check functions accept a minimal `DomAdapter` interface so they work in both environments:

```typescript
export interface DomAdapter {
  querySelectorAll(selector: string): DomElement[];
  querySelector(selector: string): DomElement | null;
}

export interface DomElement {
  tagName: string;
  getAttribute(name: string): string | null;
  textContent: string;
}
```

Two adapter implementations: `BrowserDomAdapter` (wraps `Document`) and `CheerioDomAdapter` (wraps `cheerio.CheerioAPI`). Both live in `src/lib/qa/engine.ts`.

### G6. Click-to-Highlight

When a user clicks a check result in the ScorecardPanel:

1. Read `elementPath` from the `QAResult` — either a CSS selector or a `data-cad-path` value
2. Access `window.__bwcIframeRef.contentDocument`
3. Query: `doc.querySelector(selector)` or `doc.querySelector(\`[data-cad-path="${path}"]\`)`
4. Remove any previous highlight: `doc.querySelectorAll(".bwc-qa-highlight-fail, .bwc-qa-highlight-warn").forEach(el => el.classList.remove(...))`
5. Apply class: `.bwc-qa-highlight-fail` (red outline) or `.bwc-qa-highlight-warn` (amber outline)
6. Scroll into view: `element.scrollIntoView({ behavior: "smooth", block: "center" })`
7. Auto-remove after 4 seconds via `setTimeout`

**CSS injection** (injected once when scorecard opens, following CanvasEditOverlay pattern):

```css
.bwc-qa-highlight-fail {
  outline: 3px solid #ef4444 !important;
  outline-offset: 4px !important;
  background-color: rgba(239, 68, 68, 0.05) !important;
  transition: outline-color 0.2s, background-color 0.2s;
}
.bwc-qa-highlight-warn {
  outline: 3px solid #f59e0b !important;
  outline-offset: 4px !important;
  background-color: rgba(245, 158, 11, 0.05) !important;
  transition: outline-color 0.2s, background-color 0.2s;
}
```

### G7. Fix Actions

Each `QAResult` with `fixSuggestion !== null` gets action buttons:

**Fix in Chat:**
1. Close the scorecard (`setIsScorecardOpen(false)`)
2. Switch to chat mode (`setEditingMode("chat")`)
3. Pre-populate the chat input with the fix suggestion text (store action: `setPendingChatMessage`)

**Fix in Canvas:**
1. Close the scorecard (`setIsScorecardOpen(false)`)
2. Switch to canvas mode (`setEditingMode("canvas")`)
3. After canvas overlay mounts, highlight the target element (same click-to-highlight logic)

The `fixSuggestion` strings are generated per check ID:

```typescript
function generateFixSuggestion(checkId: string, message: string): string | null {
  switch (checkId) {
    case "F03": return "Rewrite the executive summary to be 25-40 words.";
    case "F04": return `Adjust the meta title to be 50-60 characters. Current: ${message}`;
    case "F05": return `Adjust the meta description to be 150-160 characters. Current: ${message}`;
    case "F06": return `The article needs more content to meet the word count minimum. ${message}`;
    // ... etc for all checks with actionable fixes
    default: return null;
  }
}
```

### G8. Store Extension

Add to `ArticleEditorState`:

```typescript
// QA state
qaScore: QAScore | null;
isScorecardOpen: boolean;
pendingChatMessage: string;
```

Add to `ArticleEditorActions`:

```typescript
setQaScore: (score: QAScore | null) => void;
setIsScorecardOpen: (open: boolean) => void;
setPendingChatMessage: (message: string) => void;
runQa: () => void;
```

The `runQa` action:
1. Reads `currentDocument` and `currentHtml` from state
2. If either is null, returns early
3. Calls `runQAChecks(doc, html)` from the QA engine (client-side, using `DOMParser`)
4. Sets `qaScore` with the result
5. Sets `isScorecardOpen(true)`

### G9. Scorecard UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  PreviewToolbar  [Preview|HTML] [Desktop|Mobile] [Chat|Canvas|HTML] [Undo|Redo] ... [Run QA ▶] │
├───────────────────────────────────────┬─────────────────────────┤
│                                       │  ▼ ARTICLE SCORECARD    │
│                                       │  Score: 39/42           │
│                                       │  ■■■■■■■■■■■■□□□ 93%    │
│     Preview Iframe                    │  Status: ✅ Can finalize │
│     (with highlight on                │                         │
│      clicked element)                 │  ▸ BLOCKERS (3 FAIL)    │
│                                       │    ✕ F06 Word count     │
│                                       │      Hub needs ≥2500... │
│                                       │      [Fix Chat] [Fix ✎] │
│                                       │                         │
│                                       │  ▸ WARNINGS (5)         │
│                                       │    ⚠ W01 H1 length      │
│                                       │    ⚠ W25 Reading level   │
│                                       │                         │
│                                       │  ▸ INFO (34 passed)     │
│                                       │    ✓ F01 H1 present     │
│                                       │                         │
│                                       │  [Re-run QA] [Dismiss]  │
└───────────────────────────────────────┴─────────────────────────┘
```

**Positioning:**
- ScorecardPanel: `position: absolute`, `top: 0`, `right: 0`, `height: 100%`, `width: 380px`, `zIndex: 20`
- Background: `#ffffff` with left border `2px solid #e8e6e6`
- Drop shadow: `box-shadow: -4px 0 12px rgba(0,0,0,0.1)`
- Scrollable content area with sticky header

**Color coding:**
- FAIL items: background `#fef2f2`, icon color `#b91c1c`
- WARN items: background `#fefce8`, icon color `#a16207`
- PASS items: background `#f0fdf4`, icon color `#15803d`
- Score bar: gold `#bc9b5d`

### G10. API Route Design

**Endpoint:** `POST /api/articles/qa`

**Request body:**
```typescript
{
  document: CanonicalArticleDocument;
  html: string;
}
```

**Success response (200):**
```typescript
{
  success: true,
  data: QAScore
}
```

**Failure response (422 — QA gate failed):**
```typescript
{
  success: false,
  error: {
    code: "QA_GATE_FAILED",
    message: "Article has N FAIL-level issues that block finalization",
    details: QAScore
  }
}
```

Note: The 422 response includes the full `QAScore` in `details` so the client can display results. The `QA_GATE_FAILED` code is used when the caller requests finalization gate enforcement (via `?gate=true` query param). Without the query param, the route always returns 200 with the score (informational mode).

**Server-side parsing:** The API route uses `cheerio` to parse the HTML string since `DOMParser` is not available in Node.js.

### G11. Updated Component Tree

```
PreviewPanel
  ├── PreviewToolbar
  │   ├── Preview/HTML toggle (previewMode)
  │   ├── Desktop/Mobile toggle (viewportMode)
  │   ├── Chat/Canvas/HTML toggle (editingMode)
  │   ├── Undo/Redo buttons
  │   ├── VersionNavigator
  │   ├── Validation badge
  │   └── [Run QA] button + QA score badge                ← NEW
  └── Content Area
      ├── PreviewIframe (when previewMode="preview")
      │   └── CanvasEditOverlay (when editingMode="canvas")
      ├── HtmlEditor (when editingMode="html")
      ├── HtmlSourceView (when previewMode="html" AND editingMode!="html")
      └── ScorecardPanel (when isScorecardOpen)            ← NEW
```

---

## H. Step-by-Step Execution Plan

### Phase 1: Foundation (Dependencies + Exports + Types)

#### Step 1.1: Install cheerio

```bash
npm install cheerio
```

**Verify:** `npm run build` still passes. `package.json` shows `cheerio`.

---

#### Step 1.2: Export countWords and countDocumentWords from validate.ts

**File:** `src/lib/article-schema/validate.ts`

**Changes:**

1. Change `function countWords(text: string): number` (line 6) to `export function countWords(text: string): number`

2. Change `function countDocumentWords(doc: CanonicalArticleDocument): number` (line 13) to `export function countDocumentWords(doc: CanonicalArticleDocument): number`

No other changes to this file. The functions are currently only used internally; adding `export` does not break any existing code.

**Verify:** `npm run build` passes.

---

#### Step 1.3: Extend Types — ui.ts

**File:** `src/types/ui.ts`

**Changes:**

1. Add import at top:

```typescript
import type { QAScore } from "./qa";
```

2. Add to `ArticleEditorState` interface (after `htmlOverrides: HtmlOverride[];`):

```typescript
  // QA scorecard
  qaScore: QAScore | null;
  isScorecardOpen: boolean;
  pendingChatMessage: string;
```

3. Add to `ArticleEditorActions` interface (after `clearHtmlOverrides: () => void;`):

```typescript
  // QA scorecard
  setQaScore: (score: QAScore | null) => void;
  setIsScorecardOpen: (open: boolean) => void;
  setPendingChatMessage: (message: string) => void;
  runQa: () => void;
```

**Verify:** `npm run build` will fail until the store implements these (expected — continue to Phase 2).

---

### Phase 2: QA Engine Core

#### Step 2.1: Create src/lib/qa/readability.ts

**File:** `src/lib/qa/readability.ts` (new)

```typescript
/**
 * Pure-function Flesch-Kincaid readability calculator.
 * No dependencies — all computation is local.
 */

/** Count syllables in a single word using vowel-group heuristic (~90% accuracy) */
export function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;

  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Silent 'e' at end (but not "le" endings like "bottle", "table")
  if (word.endsWith("e") && !word.endsWith("le")) count--;
  // Silent 'es' / 'ed' suffixes
  if (word.endsWith("es") || word.endsWith("ed")) count--;

  return Math.max(count, 1);
}

/** Count sentences by splitting on terminal punctuation */
export function countSentences(text: string): number {
  const sentences = text
    .split(/[.!?]+(?:\s|$)/)
    .filter((s) => s.trim().length > 0);
  return Math.max(sentences.length, 1);
}

/**
 * Calculate Flesch-Kincaid Grade Level.
 * Formula: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
 *
 * Target for BWC: Grade 10–14 (luxury wine audience).
 * Below 10 = too simple. Above 14 = too academic.
 */
export function fleschKincaidGrade(text: string): number {
  const stripped = text.replace(/<[^>]*>/g, "").trim();
  const words = stripped.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;

  const totalWords = words.length;
  const totalSentences = countSentences(stripped);
  const totalSyllables = words.reduce(
    (sum, w) => sum + countSyllables(w),
    0
  );

  const grade =
    0.39 * (totalWords / totalSentences) +
    11.8 * (totalSyllables / totalWords) -
    15.59;

  return Math.round(grade * 10) / 10; // One decimal place
}
```

---

#### Step 2.2: Create src/lib/qa/checks/structure-checks.ts

**File:** `src/lib/qa/checks/structure-checks.ts` (new)

Implements checks: **F01** (H1 present), **F02** (heading hierarchy — no H4–H6 in DOM), **W01** (H1 length), **W02** (H2 count range — note: validate.ts has this as FAIL; the QA module runs it as WARN since validate.ts already enforces it), **W03** (duplicate headings).

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import type { DomAdapter } from "../engine";
import { CHECK_REGISTRY, createResult } from "../engine";

export function runStructureChecks(
  doc: CanonicalArticleDocument,
  dom: DomAdapter
): QAResult[] {
  const results: QAResult[] = [];

  // F01: Exactly 1 <h1>
  const h1s = dom.querySelectorAll("h1");
  results.push(
    createResult(
      CHECK_REGISTRY.F01,
      h1s.length === 1,
      h1s.length === 1
        ? `H1 found: "${h1s[0].textContent.slice(0, 50)}..."`
        : `Expected exactly 1 H1, found ${h1s.length}`,
      "h1",
      h1s.length !== 1
        ? "Ensure the article has exactly one H1 element (the title)."
        : null
    )
  );

  // F02: No H4, H5, H6 in the DOM; no heading level skips
  const headings = dom.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const forbiddenHeadings = headings.filter((h) =>
    ["H4", "H5", "H6"].includes(h.tagName.toUpperCase())
  );
  const hasSkip = checkHeadingSkips(headings);
  const hierarchyPassed = forbiddenHeadings.length === 0 && !hasSkip;
  results.push(
    createResult(
      CHECK_REGISTRY.F02,
      hierarchyPassed,
      hierarchyPassed
        ? "Heading hierarchy valid (H1 > H2 > H3 only, no skips)"
        : forbiddenHeadings.length > 0
          ? `Found ${forbiddenHeadings.length} forbidden heading(s): ${forbiddenHeadings.map((h) => h.tagName).join(", ")}`
          : "Heading level skip detected (e.g., H1 directly to H3)",
      forbiddenHeadings.length > 0
        ? forbiddenHeadings[0].tagName.toLowerCase()
        : null,
      !hierarchyPassed
        ? "Fix heading hierarchy: use only H1, H2, H3 in order. Never skip levels."
        : null
    )
  );

  // W01: H1 length 50–65 chars
  if (h1s.length === 1) {
    const h1Text = h1s[0].textContent.trim();
    const h1Len = h1Text.length;
    const w01Passed = h1Len >= 50 && h1Len <= 65;
    results.push(
      createResult(
        CHECK_REGISTRY.W01,
        w01Passed,
        w01Passed
          ? `H1 length: ${h1Len} chars (target: 50–65)`
          : `H1 length: ${h1Len} chars (target: 50–65)`,
        '[data-cad-path="title"]',
        !w01Passed
          ? `Adjust the H1 to be 50–65 characters. Currently ${h1Len} chars.`
          : null
      )
    );
  }

  // W03: Duplicate headings
  const headingTexts = doc.sections.map((s) => s.heading.toLowerCase().trim());
  const duplicates = headingTexts.filter(
    (text, i) => headingTexts.indexOf(text) !== i
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W03,
      duplicates.length === 0,
      duplicates.length === 0
        ? "No duplicate headings"
        : `Duplicate heading(s): "${duplicates[0]}"`,
      null,
      duplicates.length > 0
        ? `Rename the duplicate heading "${duplicates[0]}" to be unique.`
        : null
    )
  );

  return results;
}

function checkHeadingSkips(headings: { tagName: string }[]): boolean {
  let lastLevel = 0;
  for (const h of headings) {
    const level = parseInt(h.tagName.replace(/[^0-9]/g, ""), 10);
    if (lastLevel > 0 && level > lastLevel + 1) return true;
    lastLevel = level;
  }
  return false;
}
```

---

#### Step 2.3: Create src/lib/qa/checks/metadata-checks.ts

**File:** `src/lib/qa/checks/metadata-checks.ts` (new)

Implements checks: **W04** (meta title ≠ H1), **W05** (slug length 3–6 words).

Note: F03, F04, F05 are already handled by `validateCanonicalDocument()` and mapped in the engine. These check modules only add NEW checks not covered by validate.ts.

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import { CHECK_REGISTRY, createResult } from "../engine";

export function runMetadataChecks(
  doc: CanonicalArticleDocument
): QAResult[] {
  const results: QAResult[] = [];

  // W04: Meta title should differ from H1
  const titleNorm = doc.title.toLowerCase().trim();
  const metaNorm = doc.metaTitle.toLowerCase().trim();
  const w04Passed = titleNorm !== metaNorm;
  results.push(
    createResult(
      CHECK_REGISTRY.W04,
      w04Passed,
      w04Passed
        ? "Meta title differs from H1"
        : "Meta title is identical to H1 — should be similar but not identical",
      '[data-cad-path="metaTitle"]',
      !w04Passed
        ? "Rewrite the meta title to be a variation of the H1, not an exact copy."
        : null
    )
  );

  // W05: Slug length 3–6 words
  const slugWords = doc.slug
    .split("-")
    .filter((w) => w.length > 0).length;
  const w05Passed = slugWords >= 3 && slugWords <= 6;
  results.push(
    createResult(
      CHECK_REGISTRY.W05,
      w05Passed,
      w05Passed
        ? `Slug has ${slugWords} words (target: 3–6)`
        : `Slug has ${slugWords} words (target: 3–6)`,
      null,
      !w05Passed
        ? `Adjust the URL slug to be 3–6 hyphenated words. Currently ${slugWords} words.`
        : null
    )
  );

  return results;
}
```

---

#### Step 2.4: Create src/lib/qa/checks/link-checks.ts

**File:** `src/lib/qa/checks/link-checks.ts` (new)

Implements checks: **F15** (prohibited anchor text — upgraded from WARN in validate.ts to FAIL), **W06** (spoke → parent hub), **W07** (sibling spoke links), **W08** (cross-cluster link), **W10** (external target=_blank), **W11** (no competitor links), **W12** (external link spread), **W13** (source trust tiers).

Note: F07, F08, F09, W09 are handled by validate.ts mapping.

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import type { DomAdapter } from "../engine";
import { CHECK_REGISTRY, createResult } from "../engine";

const PROHIBITED_ANCHORS = ["click here", "read more", "learn more", "link", "here"];
const COMPETITOR_DOMAINS = [
  "wine.com", "vivino.com", "totalwine.com", "drizly.com",
  "winc.com", "nakedwines.com", "cellartracker.com",
];

export function runLinkChecks(
  doc: CanonicalArticleDocument,
  dom: DomAdapter
): QAResult[] {
  const results: QAResult[] = [];

  // F15: Prohibited anchor text (FAIL level)
  const prohibitedFound: string[] = [];
  for (const link of doc.internalLinks) {
    if (PROHIBITED_ANCHORS.includes(link.anchorText.toLowerCase().trim())) {
      prohibitedFound.push(link.anchorText);
    }
  }
  for (const link of doc.externalLinks) {
    if (PROHIBITED_ANCHORS.includes(link.anchorText.toLowerCase().trim())) {
      prohibitedFound.push(link.anchorText);
    }
  }
  results.push(
    createResult(
      CHECK_REGISTRY.F15,
      prohibitedFound.length === 0,
      prohibitedFound.length === 0
        ? "No prohibited anchor text found"
        : `Found prohibited anchor text: "${prohibitedFound[0]}"`,
      null,
      prohibitedFound.length > 0
        ? `Replace the generic anchor text "${prohibitedFound[0]}" with a descriptive 3-8 word phrase.`
        : null
    )
  );

  // W06: Spoke → parent hub link (only for spoke articles)
  if (doc.articleType === "spoke" && doc.hubId !== null) {
    const hasParentLink = doc.internalLinks.some(
      (l) => l.linkType === "spoke-to-hub" || l.targetArticleId === doc.hubId
    );
    results.push(
      createResult(
        CHECK_REGISTRY.W06,
        hasParentLink,
        hasParentLink
          ? "Spoke links to parent hub article"
          : "Spoke does not link to its parent hub article",
        null,
        !hasParentLink
          ? "Add at least one internal link from this spoke article to its parent hub."
          : null
      )
    );
  }

  // W07: Sibling spoke links (1–2 for spoke articles)
  if (doc.articleType === "spoke") {
    const siblingLinks = doc.internalLinks.filter(
      (l) => l.linkType === "spoke-to-sibling"
    );
    const w07Passed = siblingLinks.length >= 1;
    results.push(
      createResult(
        CHECK_REGISTRY.W07,
        w07Passed,
        w07Passed
          ? `${siblingLinks.length} sibling spoke link(s) found`
          : "No sibling spoke links found — add 1–2 links to related spokes",
        null,
        !w07Passed
          ? "Add 1–2 internal links to sibling spoke articles in the same hub."
          : null
      )
    );
  }

  // W08: Cross-cluster link (at least 1)
  const crossClusterLinks = doc.internalLinks.filter(
    (l) => l.linkType === "cross-cluster"
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W08,
      crossClusterLinks.length >= 1,
      crossClusterLinks.length >= 1
        ? `${crossClusterLinks.length} cross-cluster link(s) found`
        : "No cross-cluster links — add at least 1 link to a different hub topic",
      null,
      crossClusterLinks.length < 1
        ? "Add at least one internal link to an article in a different hub cluster."
        : null
    )
  );

  // W10: External links should have target="_blank" in rendered HTML
  const externalAnchors = dom.querySelectorAll('a[href^="http"]');
  const missingBlank = externalAnchors.filter(
    (a) => {
      const href = a.getAttribute("href") || "";
      const isExternal = !href.includes("bhutanwine.com");
      return isExternal && a.getAttribute("target") !== "_blank";
    }
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W10,
      missingBlank.length === 0,
      missingBlank.length === 0
        ? "All external links open in new tab"
        : `${missingBlank.length} external link(s) missing target="_blank"`,
      missingBlank.length > 0 ? "a[href^='http']:not([target='_blank'])" : null,
      missingBlank.length > 0
        ? "Add target=\"_blank\" to all external links."
        : null
    )
  );

  // W11: No competitor e-commerce links
  const competitorLinks = doc.externalLinks.filter((l) =>
    COMPETITOR_DOMAINS.some((domain) => l.url.includes(domain))
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W11,
      competitorLinks.length === 0,
      competitorLinks.length === 0
        ? "No competitor e-commerce links"
        : `Found competitor link: ${competitorLinks[0].url}`,
      null,
      competitorLinks.length > 0
        ? `Remove or replace the competitor link to ${competitorLinks[0].url}.`
        : null
    )
  );

  // W12: External link spread — not clustered in 1–2 sections
  const sectionIds = new Set(doc.externalLinks.map((l) => l.sectionId));
  const w12Passed = doc.externalLinks.length <= 2 || sectionIds.size >= 3;
  results.push(
    createResult(
      CHECK_REGISTRY.W12,
      w12Passed,
      w12Passed
        ? `External links spread across ${sectionIds.size} section(s)`
        : `External links clustered in only ${sectionIds.size} section(s) — spread across at least 3`,
      null,
      !w12Passed
        ? "Distribute external links more evenly across article sections."
        : null
    )
  );

  // W13: Source trust tiers — at least 1 primary source
  const hasPrimary = doc.externalLinks.some(
    (l) => l.trustTier === "primary"
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W13,
      hasPrimary,
      hasPrimary
        ? "At least 1 primary source link present"
        : "No primary source links — add at least 1 high-authority source",
      null,
      !hasPrimary
        ? "Add at least one external link to a primary source (government, academic, or industry body)."
        : null
    )
  );

  return results;
}
```

---

#### Step 2.5: Create src/lib/qa/checks/image-checks.ts

**File:** `src/lib/qa/checks/image-checks.ts` (new)

Implements checks: **W14** (image count min), **W15** (visual spacing), **W17** (captions on location images), **W20** (hero image perf attributes), **W21** (image dimensions in DOM).

Note: F11 (hero alt), F12 (no blank alt), W16 (alt text length) are handled by validate.ts mapping.

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import type { DomAdapter } from "../engine";
import { CHECK_REGISTRY, createResult } from "../engine";
import { countWords } from "@/lib/article-schema/validate";

export function runImageChecks(
  doc: CanonicalArticleDocument,
  dom: DomAdapter
): QAResult[] {
  const results: QAResult[] = [];

  // Count all images in document
  let imageCount = doc.heroImage ? 1 : 0;
  for (const section of doc.sections) {
    for (const node of section.content) {
      if (node.type === "image") imageCount++;
    }
  }

  // W14: Image count minimum
  const imgMins: Record<string, number> = { hub: 5, spoke: 3, news: 1 };
  const imgMin = imgMins[doc.articleType] || 1;
  results.push(
    createResult(
      CHECK_REGISTRY.W14,
      imageCount >= imgMin,
      imageCount >= imgMin
        ? `${imageCount} images (minimum: ${imgMin} for ${doc.articleType})`
        : `Only ${imageCount} image(s) — ${doc.articleType} articles need at least ${imgMin}`,
      null,
      imageCount < imgMin
        ? `Add more images. ${doc.articleType} articles need at least ${imgMin} images, currently has ${imageCount}.`
        : null
    )
  );

  // W15: ≤400 consecutive words without image
  let maxGap = 0;
  let currentGap = 0;
  for (const section of doc.sections) {
    currentGap += countWords(section.heading);
    for (const node of section.content) {
      if (node.type === "image") {
        maxGap = Math.max(maxGap, currentGap);
        currentGap = 0;
      } else if (node.type === "paragraph" || node.type === "pullQuote" || node.type === "callout") {
        currentGap += countWords(node.text);
      } else if (node.type === "list") {
        for (const item of node.items) {
          currentGap += countWords(item);
        }
      } else if (node.type === "keyFacts") {
        for (const fact of node.facts) {
          currentGap += countWords(fact.label) + countWords(fact.value);
        }
      } else if (node.type === "table") {
        for (const row of node.rows) {
          for (const cell of row) {
            currentGap += countWords(cell);
          }
        }
      }
    }
  }
  maxGap = Math.max(maxGap, currentGap);
  results.push(
    createResult(
      CHECK_REGISTRY.W15,
      maxGap <= 400,
      maxGap <= 400
        ? `Max consecutive words without image: ${maxGap} (limit: 400)`
        : `${maxGap} consecutive words without an image — max allowed is 400`,
      null,
      maxGap > 400
        ? `Add an image to break up the text. There are ${maxGap} consecutive words without a visual break.`
        : null
    )
  );

  // W17: Captions on location/process images
  const uncaptionedImages: string[] = [];
  for (const section of doc.sections) {
    for (const node of section.content) {
      if (node.type === "image" && node.placement.classification === "informative") {
        if (!node.placement.caption) {
          uncaptionedImages.push(node.placement.alt.slice(0, 40));
        }
      }
    }
  }
  results.push(
    createResult(
      CHECK_REGISTRY.W17,
      uncaptionedImages.length === 0,
      uncaptionedImages.length === 0
        ? "All informative images have captions"
        : `${uncaptionedImages.length} informative image(s) without caption`,
      null,
      uncaptionedImages.length > 0
        ? `Add captions to informative images. First uncaptioned: "${uncaptionedImages[0]}..."`
        : null
    )
  );

  // W20: Hero image performance — loading="eager" + fetchpriority="high"
  const heroImgs = dom.querySelectorAll("img");
  if (heroImgs.length > 0) {
    const firstImg = heroImgs[0];
    const hasEager = firstImg.getAttribute("loading") === "eager";
    const hasPriority = firstImg.getAttribute("fetchpriority") === "high";
    const w20Passed = hasEager && hasPriority;
    results.push(
      createResult(
        CHECK_REGISTRY.W20,
        w20Passed,
        w20Passed
          ? "Hero image has loading=\"eager\" and fetchpriority=\"high\""
          : `Hero image missing: ${!hasEager ? 'loading="eager"' : ""} ${!hasPriority ? 'fetchpriority="high"' : ""}`.trim(),
        "img:first-of-type",
        !w20Passed
          ? "Add loading=\"eager\" and fetchpriority=\"high\" to the hero image for optimal LCP."
          : null
      )
    );
  }

  // W21: All images have width + height attributes in DOM
  const allImgs = dom.querySelectorAll("img");
  const missingDims = allImgs.filter(
    (img) => !img.getAttribute("width") || !img.getAttribute("height")
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W21,
      missingDims.length === 0,
      missingDims.length === 0
        ? `All ${allImgs.length} images have width and height attributes`
        : `${missingDims.length} image(s) missing width/height attributes (CLS risk)`,
      missingDims.length > 0 ? "img:not([width])" : null,
      missingDims.length > 0
        ? "Add explicit width and height attributes to all images to prevent layout shift."
        : null
    )
  );

  return results;
}
```

---

#### Step 2.6: Create src/lib/qa/checks/content-checks.ts

**File:** `src/lib/qa/checks/content-checks.ts` (new)

Implements checks: **W22** (no hardcoded volatile data), **W23** (banned superlatives), **W24** (main entity placement), **W26** (citable paragraphs).

Note: F06 (word count) is handled by validate.ts mapping.

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import { CHECK_REGISTRY, createResult } from "../engine";

const HARDCODED_PATTERNS = [
  /\$\d[\d,]*\.?\d*/g,           // Dollar amounts: $XXX, $X,XXX.XX
  /\d+\.?\d*%/g,                 // Percentages: XX.X%
];

const BANNED_SUPERLATIVES = [
  "best winery", "finest wines", "greatest wine", "most exclusive",
  "unmatched quality", "world's best", "finest winery", "number one",
  "top-rated winery", "leading winery", "premium quality",
];

export function runContentChecks(
  doc: CanonicalArticleDocument
): QAResult[] {
  const results: QAResult[] = [];

  // Collect all text content for scanning
  const allText = collectAllText(doc);

  // W22: No hardcoded volatile data ($XXX, XX.X%)
  const hardcodedMatches: string[] = [];
  for (const pattern of HARDCODED_PATTERNS) {
    const matches = allText.match(pattern);
    if (matches) hardcodedMatches.push(...matches);
  }
  results.push(
    createResult(
      CHECK_REGISTRY.W22,
      hardcodedMatches.length === 0,
      hardcodedMatches.length === 0
        ? "No hardcoded volatile data found"
        : `Found ${hardcodedMatches.length} hardcoded value(s): ${hardcodedMatches.slice(0, 3).join(", ")}`,
      null,
      hardcodedMatches.length > 0
        ? `Replace hardcoded values (${hardcodedMatches[0]}) with data pulled from the knowledge base.`
        : null
    )
  );

  // W23: Banned superlatives
  const textLower = allText.toLowerCase();
  const foundSuperlatives = BANNED_SUPERLATIVES.filter((phrase) =>
    textLower.includes(phrase)
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W23,
      foundSuperlatives.length === 0,
      foundSuperlatives.length === 0
        ? "No banned superlatives found"
        : `Found banned phrase(s): "${foundSuperlatives[0]}"`,
      null,
      foundSuperlatives.length > 0
        ? `Remove or replace the superlative "${foundSuperlatives[0]}". Use specific, provable claims instead.`
        : null
    )
  );

  // W24: Main entity placement — should appear in H1, exec summary, meta title, first 100 words
  const entity = doc.title
    .split(/[\s—–:,|]+/)
    .slice(0, 3)
    .join(" ")
    .toLowerCase()
    .trim();
  // Use the content_map main_entity if available via the slug or a simpler heuristic
  const entityInH1 = doc.title.toLowerCase().includes(entity);
  const entityInExecSummary = doc.executiveSummary.toLowerCase().includes(entity);
  const entityInMeta = doc.metaTitle.toLowerCase().includes(entity);
  // First 100 words of body
  const firstSection = doc.sections[0];
  const firstContent = firstSection
    ? firstSection.content
        .filter((n): n is { type: "paragraph"; text: string } & Record<string, unknown> => n.type === "paragraph")
        .map((n) => n.text)
        .join(" ")
        .split(/\s+/)
        .slice(0, 100)
        .join(" ")
        .toLowerCase()
    : "";
  const entityInFirst100 = firstContent.includes(entity);
  const entityLocations = [entityInH1, entityInExecSummary, entityInMeta, entityInFirst100];
  const entityCount = entityLocations.filter(Boolean).length;
  results.push(
    createResult(
      CHECK_REGISTRY.W24,
      entityCount >= 3,
      entityCount >= 3
        ? `Main entity appears in ${entityCount}/4 required positions`
        : `Main entity only in ${entityCount}/4 positions (H1: ${entityInH1 ? "yes" : "no"}, Summary: ${entityInExecSummary ? "yes" : "no"}, Meta: ${entityInMeta ? "yes" : "no"}, First 100w: ${entityInFirst100 ? "yes" : "no"})`,
      null,
      entityCount < 3
        ? "Ensure the main entity appears in the H1, executive summary, meta title, and first 100 words."
        : null
    )
  );

  // W26: Citable paragraphs — ≥3 standalone factual paragraphs (30+ words, no links/quotes)
  let citableCount = 0;
  for (const section of doc.sections) {
    for (const node of section.content) {
      if (node.type === "paragraph") {
        const text = node.text.replace(/<[^>]*>/g, "").trim();
        const wordCount = text.split(/\s+/).length;
        const hasLink = /<a\s/i.test(node.text);
        if (wordCount >= 30 && !hasLink) {
          citableCount++;
        }
      }
    }
  }
  results.push(
    createResult(
      CHECK_REGISTRY.W26,
      citableCount >= 3,
      citableCount >= 3
        ? `${citableCount} citable paragraphs found (minimum: 3)`
        : `Only ${citableCount} citable paragraph(s) — need at least 3 standalone factual paragraphs (30+ words, no embedded links)`,
      null,
      citableCount < 3
        ? "Add more standalone factual paragraphs (30+ words, no embedded links) to improve citability."
        : null
    )
  );

  return results;
}

/** Collect all visible text from the canonical document */
function collectAllText(doc: CanonicalArticleDocument): string {
  const parts: string[] = [
    doc.title,
    doc.executiveSummary,
  ];
  for (const section of doc.sections) {
    parts.push(section.heading);
    for (const node of section.content) {
      switch (node.type) {
        case "paragraph":
        case "pullQuote":
        case "callout":
          parts.push(node.text);
          break;
        case "list":
          parts.push(...node.items);
          break;
        case "keyFacts":
          for (const fact of node.facts) {
            parts.push(fact.label, fact.value);
          }
          break;
        case "table":
          for (const row of node.rows) {
            parts.push(...row);
          }
          break;
      }
    }
  }
  for (const faq of doc.faq) {
    parts.push(faq.question, faq.answer);
  }
  return parts.join(" ").replace(/<[^>]*>/g, "");
}
```

---

#### Step 2.7: Create src/lib/qa/checks/schema-checks.ts

**File:** `src/lib/qa/checks/schema-checks.ts` (new)

Implements checks: **W18** (FAQPage schema sync — additional DOM-level check), **W19** (data-nosnippet on pricing/legal content).

Note: F10 (BlogPosting), F13 (author), F14 (dates), F17 (canonical URL) are handled by validate.ts mapping.

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import type { DomAdapter } from "../engine";
import { CHECK_REGISTRY, createResult } from "../engine";

export function runSchemaChecks(
  doc: CanonicalArticleDocument,
  dom: DomAdapter
): QAResult[] {
  const results: QAResult[] = [];

  // W19: data-nosnippet on sensitive content (pricing, legal)
  if (doc.dataNosnippetSections.length > 0) {
    const nosnippetElements = dom.querySelectorAll("[data-nosnippet]");
    const w19Passed = nosnippetElements.length >= doc.dataNosnippetSections.length;
    results.push(
      createResult(
        CHECK_REGISTRY.W19,
        w19Passed,
        w19Passed
          ? `${nosnippetElements.length} data-nosnippet element(s) found for ${doc.dataNosnippetSections.length} marked section(s)`
          : `Expected ${doc.dataNosnippetSections.length} data-nosnippet element(s), found ${nosnippetElements.length}`,
        "[data-nosnippet]",
        !w19Passed
          ? "Add data-nosnippet attribute to sections containing pricing or legal content."
          : null
      )
    );
  }

  return results;
}
```

---

#### Step 2.8: Create src/lib/qa/engine.ts

**File:** `src/lib/qa/engine.ts` (new)

This is the core orchestrator. It calls `validateCanonicalDocument()`, maps results, runs all check modules, deduplicates, and produces the final `QAScore`.

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { QACheck, QAResult, QAScore } from "@/types/qa";
import { validateCanonicalDocument } from "@/lib/article-schema/validate";
import { runStructureChecks } from "./checks/structure-checks";
import { runMetadataChecks } from "./checks/metadata-checks";
import { runLinkChecks } from "./checks/link-checks";
import { runImageChecks } from "./checks/image-checks";
import { runContentChecks } from "./checks/content-checks";
import { runSchemaChecks } from "./checks/schema-checks";
import { fleschKincaidGrade } from "./readability";
import { countDocumentWords } from "@/lib/article-schema/validate";

// ================================================================
// DOM Adapter interface — abstracts browser DOMParser vs cheerio
// ================================================================

export interface DomElement {
  tagName: string;
  getAttribute(name: string): string | null;
  textContent: string;
}

export interface DomAdapter {
  querySelectorAll(selector: string): DomElement[];
  querySelector(selector: string): DomElement | null;
}

// Browser adapter (for client-side usage)
export class BrowserDomAdapter implements DomAdapter {
  private doc: Document;
  constructor(html: string) {
    this.doc = new DOMParser().parseFromString(html, "text/html");
  }
  querySelectorAll(selector: string): DomElement[] {
    try {
      return Array.from(this.doc.querySelectorAll(selector)).map(
        (el) => ({
          tagName: el.tagName,
          getAttribute: (name: string) => el.getAttribute(name),
          textContent: el.textContent || "",
        })
      );
    } catch {
      return [];
    }
  }
  querySelector(selector: string): DomElement | null {
    try {
      const el = this.doc.querySelector(selector);
      if (!el) return null;
      return {
        tagName: el.tagName,
        getAttribute: (name: string) => el.getAttribute(name),
        textContent: el.textContent || "",
      };
    } catch {
      return null;
    }
  }
}

// ================================================================
// Check Registry — central definition of all checks
// ================================================================

export const CHECK_REGISTRY: Record<string, QACheck> = {
  // FAIL-level (17)
  F01: { id: "F01", name: "H1 present", severity: "fail", rule: "Exactly 1 <h1>", category: "structure" },
  F02: { id: "F02", name: "Heading hierarchy", severity: "fail", rule: "No skips, no H4–H6", category: "structure" },
  F03: { id: "F03", name: "Executive summary", severity: "fail", rule: "Present, 25–40 words", category: "metadata" },
  F04: { id: "F04", name: "Meta title", severity: "fail", rule: "50–60 characters", category: "metadata" },
  F05: { id: "F05", name: "Meta description", severity: "fail", rule: "150–160 characters", category: "metadata" },
  F06: { id: "F06", name: "Word count", severity: "fail", rule: "Hub≥2500, Spoke≥1200, News≥600", category: "content" },
  F07: { id: "F07", name: "Internal links min", severity: "fail", rule: "Hub≥8, Spoke≥5, News≥3", category: "links" },
  F08: { id: "F08", name: "Core page links", severity: "fail", rule: "Hub≥4, Spoke≥3, News≥2", category: "links" },
  F09: { id: "F09", name: "External links min", severity: "fail", rule: "Hub≥5, Spoke≥3, News≥2", category: "links" },
  F10: { id: "F10", name: "BlogPosting schema", severity: "fail", rule: "Required fields present", category: "schema" },
  F11: { id: "F11", name: "Hero image alt", severity: "fail", rule: "Non-empty, descriptive alt text", category: "images" },
  F12: { id: "F12", name: "No blank alt", severity: "fail", rule: "Every <img> has alt", category: "images" },
  F13: { id: "F13", name: "Author byline", severity: "fail", rule: "Name + credentials", category: "schema" },
  F14: { id: "F14", name: "Publication date", severity: "fail", rule: "Valid ISO 8601", category: "schema" },
  F15: { id: "F15", name: "Prohibited anchor text", severity: "fail", rule: "No generic anchors", category: "links" },
  F16: { id: "F16", name: "Internal links valid", severity: "fail", rule: "All in registry (deferred)", category: "links" },
  F17: { id: "F17", name: "Canonical URL", severity: "fail", rule: "bhutanwine.com domain", category: "schema" },

  // WARN-level (26)
  W01: { id: "W01", name: "H1 length", severity: "warn", rule: "50–65 chars", category: "structure" },
  W02: { id: "W02", name: "H2 count range", severity: "warn", rule: "Hub 5–8, Spoke 3–5, News 2–3", category: "structure" },
  W03: { id: "W03", name: "Duplicate headings", severity: "warn", rule: "No identical text", category: "structure" },
  W04: { id: "W04", name: "Meta title ≠ H1", severity: "warn", rule: "Similar but not identical", category: "metadata" },
  W05: { id: "W05", name: "Slug length", severity: "warn", rule: "3–6 words", category: "metadata" },
  W06: { id: "W06", name: "Spoke → parent hub", severity: "warn", rule: "At least 1", category: "links" },
  W07: { id: "W07", name: "Sibling spoke links", severity: "warn", rule: "1–2", category: "links" },
  W08: { id: "W08", name: "Cross-cluster link", severity: "warn", rule: "At least 1", category: "links" },
  W09: { id: "W09", name: "Anchor text length", severity: "warn", rule: "3–8 words", category: "links" },
  W10: { id: "W10", name: "External target=_blank", severity: "warn", rule: "All external links", category: "links" },
  W11: { id: "W11", name: "No competitor links", severity: "warn", rule: "No winery storefronts", category: "links" },
  W12: { id: "W12", name: "External link spread", severity: "warn", rule: "≥3 sections", category: "links" },
  W13: { id: "W13", name: "Source trust tiers", severity: "warn", rule: "≥1 primary source", category: "links" },
  W14: { id: "W14", name: "Image count min", severity: "warn", rule: "Hub≥5, Spoke≥3, News≥1", category: "images" },
  W15: { id: "W15", name: "Visual spacing", severity: "warn", rule: "≤400 words between images", category: "images" },
  W16: { id: "W16", name: "Alt text length", severity: "warn", rule: "10–25 words informative", category: "images" },
  W17: { id: "W17", name: "Captions on locations", severity: "warn", rule: "Informative images", category: "images" },
  W18: { id: "W18", name: "FAQPage schema sync", severity: "warn", rule: "Present iff FAQ exists", category: "schema" },
  W19: { id: "W19", name: "data-nosnippet", severity: "warn", rule: "Pricing/legal content", category: "schema" },
  W20: { id: "W20", name: "Hero image perf", severity: "warn", rule: "eager + high priority", category: "images" },
  W21: { id: "W21", name: "Image dimensions", severity: "warn", rule: "width + height on all", category: "images" },
  W22: { id: "W22", name: "No hardcoded data", severity: "warn", rule: "No $XXX or XX.X%", category: "content" },
  W23: { id: "W23", name: "Banned superlatives", severity: "warn", rule: "No 'best winery' etc.", category: "content" },
  W24: { id: "W24", name: "Main entity placement", severity: "warn", rule: "H1, summary, meta, first 100w", category: "content" },
  W25: { id: "W25", name: "Reading level", severity: "warn", rule: "FK Grade 10–14", category: "readability" },
  W26: { id: "W26", name: "Citable paragraphs", severity: "warn", rule: "≥3 standalone", category: "content" },
};

// ================================================================
// Helper: create a QAResult
// ================================================================

export function createResult(
  check: QACheck,
  passed: boolean,
  message: string,
  elementPath: string | null,
  fixSuggestion: string | null
): QAResult {
  return {
    check,
    passed,
    score: passed ? 1 : check.severity === "fail" ? 0 : 0.5,
    message,
    elementPath,
    fixSuggestion,
  };
}

// ================================================================
// Validation → QAResult mapping
// ================================================================

/** Map a validation error path to a QA check ID */
function mapPathToCheckId(path: string): string {
  if (path === "executiveSummary") return "F03";
  if (path === "metaTitle") return "F04";
  if (path === "metaDescription") return "F05";
  if (path === "sections" && path.includes("H2")) return "W02"; // H2 count
  if (path.includes("headingLevel")) return "F02";
  if (path === "sections") return "F06"; // word count (path = "sections" for word count check)
  if (path === "internalLinks") return "F07";
  if (path === "externalLinks") return "F09";
  if (path === "schema.blogPosting") return "F10";
  if (path === "schema.faqPage") return "W18";
  if (path === "author") return "F13";
  if (path === "publishDate") return "F14";
  if (path === "modifiedDate") return "F14";
  if (path === "canonicalUrl") return "F17";
  if (path.includes(".alt")) return "F12";
  if (path.includes("width/height")) return "W21";
  return "F02"; // fallback
}

/** Map a validation error path to an element path for highlighting */
function mapPathToElementPath(path: string): string | null {
  if (path === "executiveSummary") return '[data-cad-path="executiveSummary"]';
  if (path === "metaTitle") return null; // Not visible in preview
  if (path === "metaDescription") return null;
  if (path.startsWith("sections[")) return `[data-cad-path="${path.replace(/\.headingLevel$/, ".heading")}"]`;
  if (path.startsWith("heroImage")) return "figure:first-of-type";
  return null;
}

/** Generate fix suggestion text for a check */
function generateFixSuggestion(checkId: string, message: string): string | null {
  const suggestions: Record<string, string> = {
    F02: "Fix heading hierarchy: use only H1, H2, H3 in order.",
    F03: "Rewrite the executive summary to be 25–40 words.",
    F04: "Adjust the meta title to be 50–60 characters.",
    F05: "Adjust the meta description to be 150–160 characters.",
    F06: "Add more content to meet the word count minimum.",
    F07: "Add more internal links to meet the minimum.",
    F08: "Add more core page links (bhutanwine.com pages).",
    F09: "Add more external source links.",
    F10: "Enable BlogPosting schema markup.",
    F11: "Add descriptive alt text to the hero image.",
    F12: "Add alt text to all images.",
    F13: "Add author name and credentials.",
    F14: "Add a valid publication date.",
    F17: "Set the canonical URL to start with https://www.bhutanwine.com/.",
    W02: "Adjust the number of H2 sections.",
  };
  return suggestions[checkId] ? `${suggestions[checkId]} ${message}` : null;
}

// ================================================================
// Main QA Engine
// ================================================================

/**
 * Run all QA checks against a canonical document and its rendered HTML.
 * This is the main entry point — call from client (with BrowserDomAdapter)
 * or from server (with CheerioDomAdapter).
 */
export function runQAChecks(
  doc: CanonicalArticleDocument,
  html: string,
  dom: DomAdapter
): QAScore {
  const allResults: QAResult[] = [];
  const coveredCheckIds = new Set<string>();

  // 1. Run existing validateCanonicalDocument and map results
  const validation = validateCanonicalDocument(doc);
  for (const err of validation.errors) {
    const checkId = mapPathToCheckId(err.path);
    if (!coveredCheckIds.has(checkId)) {
      coveredCheckIds.add(checkId);
      const check = CHECK_REGISTRY[checkId];
      if (check) {
        allResults.push(
          createResult(
            check,
            false,
            err.message,
            mapPathToElementPath(err.path),
            generateFixSuggestion(checkId, err.message)
          )
        );
      }
    }
  }
  for (const warn of validation.warnings) {
    allResults.push(
      createResult(
        CHECK_REGISTRY.W09,
        false,
        warn,
        null,
        null
      )
    );
    coveredCheckIds.add("W09");
  }

  // Mark validation-covered checks as passed if no error was found
  const validationCheckIds = [
    "F03", "F04", "F05", "F06", "F07", "F08", "F09",
    "F10", "F11", "F12", "F13", "F14", "F17", "W02", "W09", "W18",
  ];
  for (const id of validationCheckIds) {
    if (!coveredCheckIds.has(id) && CHECK_REGISTRY[id]) {
      coveredCheckIds.add(id);
      allResults.push(
        createResult(CHECK_REGISTRY[id], true, `${CHECK_REGISTRY[id].name}: passed`, null, null)
      );
    }
  }

  // 2. Run additional check modules (skip checks already covered)
  const structureResults = runStructureChecks(doc, dom);
  const metadataResults = runMetadataChecks(doc);
  const linkResults = runLinkChecks(doc, dom);
  const imageResults = runImageChecks(doc, dom);
  const contentResults = runContentChecks(doc);
  const schemaResults = runSchemaChecks(doc, dom);

  // Add results, skipping any check IDs already covered by validation mapping
  for (const result of [
    ...structureResults,
    ...metadataResults,
    ...linkResults,
    ...imageResults,
    ...contentResults,
    ...schemaResults,
  ]) {
    if (!coveredCheckIds.has(result.check.id)) {
      coveredCheckIds.add(result.check.id);
      allResults.push(result);
    }
  }

  // 3. Readability check (W25)
  if (!coveredCheckIds.has("W25")) {
    const allText = collectPlainText(doc);
    const fkGrade = fleschKincaidGrade(allText);
    const w25Passed = fkGrade >= 10 && fkGrade <= 14;
    allResults.push(
      createResult(
        CHECK_REGISTRY.W25,
        w25Passed,
        w25Passed
          ? `Flesch-Kincaid Grade: ${fkGrade} (target: 10–14)`
          : `Flesch-Kincaid Grade: ${fkGrade} (target: 10–14) — ${fkGrade < 10 ? "too simple" : "too complex"}`,
        null,
        !w25Passed
          ? fkGrade < 10
            ? "Increase sentence complexity and vocabulary to reach Grade 10+ reading level."
            : "Simplify some sentences to bring reading level below Grade 14."
          : null
      )
    );
  }

  // 4. F16 placeholder (deferred to Guide 11 — always passes for now)
  if (!coveredCheckIds.has("F16")) {
    allResults.push(
      createResult(
        CHECK_REGISTRY.F16,
        true,
        "Internal link validation deferred to finalization (Guide 11)",
        null,
        null
      )
    );
  }

  // 5. Calculate score
  const total = allResults.reduce((sum, r) => sum + r.score, 0);
  const possible = allResults.length;
  const failCount = allResults.filter((r) => !r.passed && r.check.severity === "fail").length;
  const warnCount = allResults.filter((r) => !r.passed && r.check.severity === "warn").length;
  const passCount = allResults.filter((r) => r.passed).length;

  return {
    total,
    possible,
    failCount,
    warnCount,
    passCount,
    results: allResults,
    canFinalize: failCount === 0,
  };
}

/** Collect all plain text from the document for readability analysis */
function collectPlainText(doc: CanonicalArticleDocument): string {
  const parts: string[] = [doc.executiveSummary];
  for (const section of doc.sections) {
    for (const node of section.content) {
      switch (node.type) {
        case "paragraph":
        case "pullQuote":
        case "callout":
          parts.push(node.text);
          break;
        case "list":
          parts.push(...node.items);
          break;
      }
    }
  }
  return parts.join(" ").replace(/<[^>]*>/g, "");
}
```

---

#### Step 2.9: Create src/lib/qa/index.ts

**File:** `src/lib/qa/index.ts` (new)

```typescript
export { runQAChecks, CHECK_REGISTRY, BrowserDomAdapter } from "./engine";
export type { DomAdapter, DomElement } from "./engine";
export { fleschKincaidGrade, countSyllables, countSentences } from "./readability";
```

**Verify:** `npm run build` — may still fail until store is updated (Phase 3).

---

### Phase 3: Store Extension

#### Step 3.1: Update article-store.ts

**File:** `src/lib/store/article-store.ts`

**Changes:**

1. Add imports at top:

```typescript
import type { QAScore } from "@/types/qa";
import { runQAChecks, BrowserDomAdapter } from "@/lib/qa";
```

2. Add to `initialState` (after `htmlOverrides: [],`):

```typescript
  qaScore: null,
  isScorecardOpen: false,
  pendingChatMessage: "",
```

3. Add to the actions object (after `clearHtmlOverrides`):

```typescript
    // === QA Scorecard ===

    setQaScore: (score: QAScore | null) => set({ qaScore: score }),

    setIsScorecardOpen: (open: boolean) => {
      const state = get();
      // Close canvas editing when opening scorecard (mutually exclusive)
      if (open && state.isCanvasEditing) {
        state.setIsCanvasEditing(false);
      }
      set({ isScorecardOpen: open });
    },

    setPendingChatMessage: (message: string) =>
      set({ pendingChatMessage: message }),

    runQa: () => {
      const state = get();
      if (!state.currentDocument || !state.currentHtml) return;
      const dom = new BrowserDomAdapter(state.currentHtml);
      const score = runQAChecks(state.currentDocument, state.currentHtml, dom);
      set({ qaScore: score, isScorecardOpen: true });
    },
```

4. Add to `setSelectedArticle` reset block (add `qaScore: null, isScorecardOpen: false, pendingChatMessage: ""`).

5. Add to `resetEditor` — already covered by `set(initialState)` since initialState now includes the new fields.

6. Add selectors at bottom:

```typescript
export function selectQaScore(state: ArticleEditorState): QAScore | null {
  return state.qaScore;
}

export function selectIsScorecardOpen(state: ArticleEditorState): boolean {
  return state.isScorecardOpen;
}
```

**Verify:** `npm run build` passes. All 13 existing routes + 16 compiled routes still work.

---

### Phase 4: Scorecard UI

#### Step 4.1: Create src/components/scorecard/ScorecardItem.tsx

**File:** `src/components/scorecard/ScorecardItem.tsx` (new)

```typescript
"use client";

import { CheckCircle, XCircle, AlertTriangle, MessageSquare, Pencil } from "lucide-react";
import type { QAResult } from "@/types/qa";

interface ScorecardItemProps {
  result: QAResult;
  onHighlight: (elementPath: string | null, severity: "fail" | "warn") => void;
  onFixInChat: (suggestion: string) => void;
  onFixInCanvas: (elementPath: string | null) => void;
}

export function ScorecardItem({
  result,
  onHighlight,
  onFixInChat,
  onFixInCanvas,
}: ScorecardItemProps) {
  const { check, passed, message, elementPath, fixSuggestion } = result;

  const bgColor = passed
    ? "#f0fdf4"
    : check.severity === "fail"
      ? "#fef2f2"
      : "#fefce8";

  const iconColor = passed
    ? "#15803d"
    : check.severity === "fail"
      ? "#b91c1c"
      : "#a16207";

  const iconSize = { width: "14px", height: "14px" };

  return (
    <div
      style={{
        padding: "8px 12px",
        background: bgColor,
        borderRadius: "6px",
        marginBottom: "4px",
        cursor: elementPath ? "pointer" : "default",
      }}
      onClick={() => {
        if (elementPath && !passed) {
          onHighlight(elementPath, check.severity as "fail" | "warn");
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <div style={{ flexShrink: 0, marginTop: "1px" }}>
          {passed ? (
            <CheckCircle style={{ ...iconSize, color: iconColor }} />
          ) : check.severity === "fail" ? (
            <XCircle style={{ ...iconSize, color: iconColor }} />
          ) : (
            <AlertTriangle style={{ ...iconSize, color: iconColor }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{
              fontSize: "10px",
              fontWeight: 600,
              color: iconColor,
              background: passed ? "#dcfce7" : check.severity === "fail" ? "#fecaca" : "#fef08a",
              padding: "1px 5px",
              borderRadius: "3px",
            }}>
              {check.id}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#242323" }}>
              {check.name}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#414141", marginTop: "2px", lineHeight: "1.4" }}>
            {message}
          </div>
          {!passed && fixSuggestion && (
            <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFixInChat(fixSuggestion);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  fontSize: "10px",
                  fontWeight: 500,
                  background: "#ffffff",
                  border: "1px solid #cccccc",
                  borderRadius: "4px",
                  cursor: "pointer",
                  color: "#414141",
                }}
              >
                <MessageSquare style={{ width: "10px", height: "10px" }} />
                Fix in Chat
              </button>
              {elementPath && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFixInCanvas(elementPath);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    fontSize: "10px",
                    fontWeight: 500,
                    background: "#ffffff",
                    border: "1px solid #cccccc",
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: "#414141",
                  }}
                >
                  <Pencil style={{ width: "10px", height: "10px" }} />
                  Fix in Canvas
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

#### Step 4.2: Create src/components/scorecard/ScorecardPanel.tsx

**File:** `src/components/scorecard/ScorecardPanel.tsx` (new)

```typescript
"use client";

import { useCallback, useEffect } from "react";
import { X, RotateCw, Shield } from "lucide-react";
import { useArticleStore, selectQaScore, selectIsScorecardOpen } from "@/lib/store/article-store";
import { ScorecardItem } from "./ScorecardItem";
import type { QAResult } from "@/types/qa";

export function ScorecardPanel() {
  const qaScore = useArticleStore(selectQaScore);
  const isScorecardOpen = useArticleStore(selectIsScorecardOpen);
  const {
    setIsScorecardOpen,
    setEditingMode,
    setPendingChatMessage,
    runQa,
  } = useArticleStore();

  // Inject highlight styles into iframe on mount
  useEffect(() => {
    if (!isScorecardOpen) return;
    const iframe = (window as unknown as Record<string, unknown>).__bwcIframeRef as HTMLIFrameElement | null;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    // Inject styles if not already present
    if (!doc.getElementById("bwc-qa-highlight")) {
      const style = doc.createElement("style");
      style.id = "bwc-qa-highlight";
      style.textContent = `
        .bwc-qa-highlight-fail {
          outline: 3px solid #ef4444 !important;
          outline-offset: 4px !important;
          background-color: rgba(239, 68, 68, 0.05) !important;
          transition: outline-color 0.2s, background-color 0.2s;
        }
        .bwc-qa-highlight-warn {
          outline: 3px solid #f59e0b !important;
          outline-offset: 4px !important;
          background-color: rgba(245, 158, 11, 0.05) !important;
          transition: outline-color 0.2s, background-color 0.2s;
        }
      `;
      doc.head.appendChild(style);
    }

    // Cleanup highlights on unmount
    return () => {
      if (!doc) return;
      doc.querySelectorAll(".bwc-qa-highlight-fail, .bwc-qa-highlight-warn").forEach((el) => {
        el.classList.remove("bwc-qa-highlight-fail", "bwc-qa-highlight-warn");
      });
    };
  }, [isScorecardOpen]);

  const handleHighlight = useCallback(
    (elementPath: string | null, severity: "fail" | "warn") => {
      if (!elementPath) return;
      const iframe = (window as unknown as Record<string, unknown>).__bwcIframeRef as HTMLIFrameElement | null;
      const doc = iframe?.contentDocument;
      if (!doc) return;

      // Clear previous highlights
      doc.querySelectorAll(".bwc-qa-highlight-fail, .bwc-qa-highlight-warn").forEach((el) => {
        el.classList.remove("bwc-qa-highlight-fail", "bwc-qa-highlight-warn");
      });

      // Try data-cad-path first, then CSS selector
      let target = doc.querySelector(`[data-cad-path="${elementPath}"]`);
      if (!target) {
        try {
          target = doc.querySelector(elementPath);
        } catch {
          // Invalid selector — ignore
        }
      }

      if (target) {
        const className = severity === "fail" ? "bwc-qa-highlight-fail" : "bwc-qa-highlight-warn";
        target.classList.add(className);
        target.scrollIntoView({ behavior: "smooth", block: "center" });

        // Auto-remove after 4 seconds
        setTimeout(() => {
          target?.classList.remove(className);
        }, 4000);
      }
    },
    []
  );

  const handleFixInChat = useCallback(
    (suggestion: string) => {
      setIsScorecardOpen(false);
      setEditingMode("chat");
      setPendingChatMessage(suggestion);
    },
    [setIsScorecardOpen, setEditingMode, setPendingChatMessage]
  );

  const handleFixInCanvas = useCallback(
    (elementPath: string | null) => {
      setIsScorecardOpen(false);
      setEditingMode("canvas");
      // Highlight will be applied after canvas overlay mounts
      if (elementPath) {
        setTimeout(() => handleHighlight(elementPath, "warn"), 500);
      }
    },
    [setIsScorecardOpen, setEditingMode, handleHighlight]
  );

  if (!isScorecardOpen || !qaScore) return null;

  // Group results by severity
  const failResults = qaScore.results.filter(
    (r) => !r.passed && r.check.severity === "fail"
  );
  const warnResults = qaScore.results.filter(
    (r) => !r.passed && r.check.severity === "warn"
  );
  const passResults = qaScore.results.filter((r) => r.passed);

  const scorePercent = qaScore.possible > 0
    ? Math.round((qaScore.total / qaScore.possible) * 100)
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: "380px",
        height: "100%",
        background: "#ffffff",
        borderLeft: "2px solid #e8e6e6",
        boxShadow: "-4px 0 12px rgba(0,0,0,0.1)",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #e8e6e6",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield style={{ width: "18px", height: "18px", color: "#bc9b5d" }} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#242323" }}>
              Article Scorecard
            </span>
          </div>
          <button
            onClick={() => setIsScorecardOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "4px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#414141",
            }}
          >
            <X style={{ width: "16px", height: "16px" }} />
          </button>
        </div>

        {/* Score summary */}
        <div style={{ marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "#242323" }}>
              {qaScore.total}/{qaScore.possible}
            </span>
            <span style={{
              fontSize: "12px",
              fontWeight: 600,
              color: qaScore.canFinalize ? "#15803d" : "#b91c1c",
              background: qaScore.canFinalize ? "#f0fdf4" : "#fef2f2",
              padding: "2px 8px",
              borderRadius: "999px",
            }}>
              {qaScore.canFinalize ? "Can finalize" : "Blocked"}
            </span>
          </div>
        </div>

        {/* Score bar */}
        <div style={{ height: "6px", background: "#e8e6e6", borderRadius: "3px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${scorePercent}%`,
              background: qaScore.canFinalize ? "#bc9b5d" : "#b91c1c",
              borderRadius: "3px",
              transition: "width 0.3s",
            }}
          />
        </div>
        <div style={{ fontSize: "11px", color: "#414141", marginTop: "4px" }}>
          {qaScore.passCount} passed, {qaScore.failCount} failed, {qaScore.warnCount} warnings
        </div>
      </div>

      {/* Scrollable results */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {/* FAIL section */}
        {failResults.length > 0 && (
          <ResultSection
            title={`BLOCKERS (${failResults.length})`}
            titleColor="#b91c1c"
            results={failResults}
            onHighlight={handleHighlight}
            onFixInChat={handleFixInChat}
            onFixInCanvas={handleFixInCanvas}
          />
        )}

        {/* WARN section */}
        {warnResults.length > 0 && (
          <ResultSection
            title={`WARNINGS (${warnResults.length})`}
            titleColor="#a16207"
            results={warnResults}
            onHighlight={handleHighlight}
            onFixInChat={handleFixInChat}
            onFixInCanvas={handleFixInCanvas}
          />
        )}

        {/* PASS section (collapsed by default) */}
        {passResults.length > 0 && (
          <CollapsibleSection
            title={`PASSED (${passResults.length})`}
            titleColor="#15803d"
            results={passResults}
            onHighlight={handleHighlight}
            onFixInChat={handleFixInChat}
            onFixInCanvas={handleFixInCanvas}
          />
        )}
      </div>

      {/* Footer actions */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #e8e6e6",
          display: "flex",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        <button
          onClick={runQa}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            fontSize: "12px",
            fontWeight: 500,
            background: "#bc9b5d",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          <RotateCw style={{ width: "12px", height: "12px" }} />
          Re-run QA
        </button>
        <button
          onClick={() => setIsScorecardOpen(false)}
          style={{
            padding: "6px 14px",
            fontSize: "12px",
            fontWeight: 500,
            background: "#ffffff",
            color: "#414141",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ================================================================
// Sub-components
// ================================================================

function ResultSection({
  title,
  titleColor,
  results,
  onHighlight,
  onFixInChat,
  onFixInCanvas,
}: {
  title: string;
  titleColor: string;
  results: QAResult[];
  onHighlight: (path: string | null, severity: "fail" | "warn") => void;
  onFixInChat: (suggestion: string) => void;
  onFixInCanvas: (path: string | null) => void;
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{
        fontSize: "11px",
        fontWeight: 700,
        color: titleColor,
        textTransform: "uppercase" as const,
        letterSpacing: "0.5px",
        marginBottom: "8px",
      }}>
        {title}
      </div>
      {results.map((result, i) => (
        <ScorecardItem
          key={`${result.check.id}-${i}`}
          result={result}
          onHighlight={onHighlight}
          onFixInChat={onFixInChat}
          onFixInCanvas={onFixInCanvas}
        />
      ))}
    </div>
  );
}

function CollapsibleSection({
  title,
  titleColor,
  results,
  onHighlight,
  onFixInChat,
  onFixInCanvas,
}: {
  title: string;
  titleColor: string;
  results: QAResult[];
  onHighlight: (path: string | null, severity: "fail" | "warn") => void;
  onFixInChat: (suggestion: string) => void;
  onFixInCanvas: (path: string | null) => void;
}) {
  return (
    <details style={{ marginBottom: "16px" }}>
      <summary style={{
        fontSize: "11px",
        fontWeight: 700,
        color: titleColor,
        textTransform: "uppercase" as const,
        letterSpacing: "0.5px",
        marginBottom: "8px",
        cursor: "pointer",
        listStyle: "none",
        display: "flex",
        alignItems: "center",
        gap: "4px",
      }}>
        <span style={{ fontSize: "10px" }}>&#9654;</span> {title}
      </summary>
      {results.map((result, i) => (
        <ScorecardItem
          key={`${result.check.id}-${i}`}
          result={result}
          onHighlight={onHighlight}
          onFixInChat={onFixInChat}
          onFixInCanvas={onFixInCanvas}
        />
      ))}
    </details>
  );
}
```

---

#### Step 4.3: Create src/components/scorecard/index.ts

**File:** `src/components/scorecard/index.ts` (new)

```typescript
export { ScorecardPanel } from "./ScorecardPanel";
export { ScorecardItem } from "./ScorecardItem";
```

---

### Phase 5: Integrate into Existing UI

#### Step 5.1: Update PreviewToolbar — Add Run QA Button

**File:** `src/components/preview/PreviewToolbar.tsx`

**Changes:**

1. Add imports:

```typescript
import { Shield } from "lucide-react";
import { selectQaScore } from "@/lib/store/article-store";
```

2. Inside the component, add store access:

```typescript
const qaScore = useArticleStore(selectQaScore);
const { runQa, setIsScorecardOpen } = useArticleStore();
const currentDocument = useArticleStore((s) => s.currentDocument);
```

3. Add the "Run QA" button BEFORE the validation badge (after the spacer `<div style={{ flex: 1 }} />`):

```tsx
{/* QA Scorecard button */}
{currentDocument && (
  <button
    onClick={runQa}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "4px 10px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: 500,
      background: qaScore
        ? qaScore.canFinalize
          ? "#f0fdf4"
          : "#fef2f2"
        : "#f7f7f7",
      color: qaScore
        ? qaScore.canFinalize
          ? "#15803d"
          : "#b91c1c"
        : "#414141",
      border: "1px solid #cccccc",
      cursor: "pointer",
    }}
  >
    <Shield style={iconSize} />
    {qaScore
      ? `QA ${qaScore.total}/${qaScore.possible}`
      : "Run QA"}
  </button>
)}
```

If `qaScore` already exists, clicking the button re-runs QA. The button also shows the current score as a quick indicator.

Add a second click handler: if qaScore exists but scorecard is closed, clicking opens it:

```typescript
onClick={() => {
  if (qaScore) {
    setIsScorecardOpen(true);
  }
  runQa();
}}
```

---

#### Step 5.2: Update PreviewPanel — Mount ScorecardPanel

**File:** `src/components/preview/PreviewPanel.tsx`

**Changes:**

1. Add import:

```typescript
import { ScorecardPanel } from "@/components/scorecard";
```

2. Mount the scorecard overlay inside the content area `<div>` (after `HtmlSourceView`, at the end of the content area div):

```tsx
<div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
  {editingMode === "html" ? (
    <HtmlEditor />
  ) : previewMode === "preview" ? (
    <>
      <PreviewIframe />
      {editingMode === "canvas" && <CanvasEditOverlay />}
    </>
  ) : (
    <HtmlSourceView />
  )}
  <ScorecardPanel />
</div>
```

The `ScorecardPanel` renders `null` when `isScorecardOpen` is false, so it's safe to always mount it. When open, it overlays the right side of the preview area.

---

#### Step 5.3: Wire Up pendingChatMessage in MessageInput

**File:** `src/components/chat/MessageInput.tsx`

The `pendingChatMessage` store field pre-populates the chat input when a user clicks "Fix in Chat" from the scorecard. The `MessageInput` component should:

1. Subscribe to `pendingChatMessage` from the store
2. When it changes to a non-empty string, set the local input value and clear the store field
3. This makes it a one-time pre-population — the user can edit before sending

Add to the component:

```typescript
const pendingChatMessage = useArticleStore((s) => s.pendingChatMessage);
const { setPendingChatMessage } = useArticleStore();

useEffect(() => {
  if (pendingChatMessage) {
    setInputValue(pendingChatMessage);
    setPendingChatMessage("");
  }
}, [pendingChatMessage, setPendingChatMessage]);
```

If `MessageInput` does not currently have a `setInputValue` local state setter, add one. The component likely uses `useState` for the input value — just wire the effect into it.

**Verify:** `npm run build` passes. All routes compile.

---

### Phase 6: API Route

#### Step 6.1: Create src/app/api/articles/qa/route.ts

**File:** `src/app/api/articles/qa/route.ts` (new)

```typescript
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { ApiResponse } from "@/types/api";
import type { QAScore } from "@/types/qa";
import type { CanonicalArticleDocument } from "@/types/article";
import { CanonicalArticleDocumentSchema } from "@/lib/article-schema/schema";
import { runQAChecks } from "@/lib/qa";
import type { DomAdapter, DomElement } from "@/lib/qa";

// Cheerio-based DOM adapter for server-side HTML parsing
class CheerioDomAdapter implements DomAdapter {
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
          tagName: (el as cheerio.Element).tagName?.toUpperCase() || "",
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
      const el = $el.get(0) as cheerio.Element;
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body
    if (!body.document || !body.html) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body must include 'document' and 'html' fields",
          },
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // Validate the document structure
    const parsed = CanonicalArticleDocumentSchema.safeParse(body.document);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid document structure",
            details: parsed.error.issues,
          },
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    const doc = parsed.data as CanonicalArticleDocument;
    const html = body.html as string;

    // Run QA checks with cheerio adapter
    const dom = new CheerioDomAdapter(html);
    const qaScore = runQAChecks(doc, html, dom);

    // Check if gate enforcement is requested
    const url = new URL(request.url);
    const gateMode = url.searchParams.get("gate") === "true";

    if (gateMode && !qaScore.canFinalize) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "QA_GATE_FAILED",
            message: `Article has ${qaScore.failCount} FAIL-level issue(s) that block finalization`,
            details: qaScore,
          },
        } as ApiResponse<never>,
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: qaScore,
    } as ApiResponse<QAScore>);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "QA check failed",
        },
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}
```

**Verify:** `npm run build` passes. Route compiles as the 14th API route (17 total compiled routes).

---

### Phase 7: Verification Gates

#### Gate 1: Type Check

```bash
npx tsc --noEmit
```

**Expected:** 0 errors.

---

#### Gate 2: Build Check

```bash
npm run build
```

**Expected:** 17 routes compiled. 0 errors.

---

#### Gate 3: API Route Test

```bash
curl -X POST http://localhost:3000/api/articles/qa \
  -H "Content-Type: application/json" \
  -d '{"document": <sample-canonical-doc>, "html": "<html>..."}'
```

**Expected:** Returns `{ success: true, data: { total: N, possible: M, ... } }`.

Test with `?gate=true`:

```bash
curl -X POST "http://localhost:3000/api/articles/qa?gate=true" \
  -H "Content-Type: application/json" \
  -d '{"document": <doc-with-fail-checks>, "html": "..."}'
```

**Expected:** Returns 422 with `{ success: false, error: { code: "QA_GATE_FAILED", ... } }`.

---

#### Gate 4: UI Functional Test

1. Open the app, log in, select an article from content map
2. Click "Generate" and wait for article to render
3. Click **Run QA** in the toolbar
4. Verify the ScorecardPanel slides out from the right
5. Verify FAIL items appear in red, WARN in amber, PASS in green
6. Click a FAIL item — verify the element highlights in the iframe with a red outline
7. Click "Fix in Chat" — verify scorecard closes, mode switches to Chat, input pre-populated
8. Click "Fix in Canvas" — verify scorecard closes, mode switches to Canvas
9. Click "Re-run QA" — verify score updates
10. Click "Dismiss" — verify scorecard closes

---

#### Gate 5: Documentation Update

After all code passes gates 1–4:

1. Run `npm run gen:api-routes` to update the generated API routes inventory
2. Update `docs/ARCHITECTURE.md` — add the QA & Scoring Layer section describing:
   - QA engine architecture (wrap-and-extend)
   - Check registry (17 FAIL + 26 WARN)
   - Scorecard UI component
   - API route at POST /api/articles/qa
3. Commit all changes with: `feat: Guide 8 — QA Scorecard & Article Scoring System`

---

## I. Deferred Work (Guide 11+)

The following QA features are intentionally deferred and will be completed in later guides:

| Feature | Deferred To | Reason |
|---|---|---|
| F16: Internal link registry validation | Guide 11 | Requires DB query against content_map + internal_links tables during finalization |
| W27: External link liveness (HTTP 200) | Guide 11 | Requires async network requests; too slow for interactive QA |
| QA score persistence to article_html | Guide 11 | Part of the finalization flow — writes qa_score and qa_failures columns |
| QA gate enforcement in finalization | Guide 11 | The `?gate=true` API route param is ready; Guide 11 calls it during finalize |
| Admin override for FAIL checks | Guide 11 | Admin can force-finalize despite FAIL checks (with audit log) |

The `F16` check currently returns `passed: true` with a message noting it's deferred. The `?gate=true` query parameter on the API route is ready for Guide 11 to use.
