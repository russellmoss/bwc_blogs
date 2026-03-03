# Guide: HTML Import — Paste/Upload External HTML for QA + Finalization

**Guide type:** Standalone feature addition (not part of the sequential Guide 1–12 build order)
**Estimated execution time:** 2–4 hours for Claude Code
**Dependencies:** Guide 1 (schema), Guide 4 (renderer), Guide 6 (UI shell), Guide 7 (HTML mode), Guide 8 (QA scorecard), Guide 11 (finalization)

---

## A. Objective

Build an HTML Import feature that allows users to paste or upload externally-edited HTML into the BWC Content Engine, preview it, run QA checks, and finalize it — storing the result in the same `article_html` + `article_documents` tables used by the standard generation flow.

**Why this exists:** The real-world workflow involves generating initial HTML in the app, downloading it, refining it in Claude Projects or another browser-based tool, and then bringing the polished HTML back for QA validation and Wix-ready finalization. Without this feature, users must manually re-enter edits or skip QA entirely.

---

## B. Scope

### In scope
- "Import HTML" button in the toolbar (next to existing "Copy HTML" / "Download .html")
- Import modal with two ingress methods: paste textarea + file upload (.html)
- Article association: user must select which content map entry this HTML belongs to
- Preview rendering: imported HTML displays immediately in the iframe
- HTML mode editing: imported HTML loads into the code editor for further tweaks
- QA scorecard execution against imported HTML (HTML-level checks work fully; canonical-doc-level checks run against extracted metadata)
- Synthetic canonical document construction from imported HTML (best-effort metadata extraction)
- Finalization via the existing `/api/articles/[id]/finalize` route (with minor extension for import-sourced articles)
- Source tracking: finalized imports are tagged as `source: "html-import"` in the canonical doc so the system knows the HTML was the primary artifact

### Out of scope
- Full reverse-parse of HTML back into a complete CanonicalArticleDocument (this is a significant NLP/parsing project — we extract metadata only)
- Automatic Cloudinary photo upload from imported HTML (user should have CDN URLs already or handle photos separately)
- Chat mode iteration on imported HTML (Chat mode requires a canonical doc; after import, Chat is disabled with a tooltip explaining why)
- Canvas Edit mode on imported HTML (Canvas Edit requires `data-cad-path` attributes that only the renderer injects)

---

## C. Existing Constraints to Preserve

1. **Standard generation flow is untouched.** The import feature is additive — it doesn't modify any existing generation, rendering, or finalization logic.
2. **QA scorecard contract is preserved.** QA checks that need a canonical doc receive the synthetic one. Checks that can't run meaningfully on an import are skipped (severity downgraded to INFO with explanation).
3. **Finalization route contract is preserved.** The existing `/api/articles/[id]/finalize` route accepts `{ document, html, htmlOverrides, notes }`. We construct all four fields.
4. **Database schema is unchanged.** No Prisma migrations. The `canonicalDoc` JSON field is flexible enough to hold a synthetic import-sourced document. The `articleHtml.htmlContent` field stores the imported HTML as-is.
5. **Undo/redo stack works.** Importing HTML pushes the current state (if any) to the undo stack before replacing it.

---

## D. Technical Design

### D1. State Model: Import Mode

The article store gains a new boolean flag: `isImportedHtml`. When `true`:
- Chat mode is disabled (button grayed, tooltip: "Chat requires a generated article. Use HTML mode to edit imported HTML.")
- Canvas Edit mode is disabled (same treatment — no `data-cad-path` attributes exist)
- HTML mode is the default and only active editing mode
- QA scorecard runs in "import mode" (see D4)
- Finalization uses the synthetic canonical doc

```typescript
// Addition to ArticleEditorState in src/types/ui.ts
isImportedHtml: boolean;
importSource: 'paste' | 'upload' | null;
```

### D2. Synthetic Canonical Document Construction

When HTML is imported, we extract what we can to build a synthetic `CanonicalArticleDocument`. This is NOT a full reverse parse — it's metadata extraction so QA checks and the finalization route have a valid document.

**Extraction targets (from HTML DOM parsing):**

| Field | Extraction method |
|-------|-------------------|
| `title` | First `<h1>` text content |
| `metaTitle` | `<title>` tag or `<meta property="og:title">` |
| `metaDescription` | `<meta name="description">` content |
| `canonicalUrl` | `<link rel="canonical">` href |
| `publishDate` | `<meta property="article:published_time">` or schema JSON |
| `modifiedDate` | Current ISO timestamp |
| `author` | Schema JSON `author` field, or default BWC author |
| `executiveSummary` | `<meta name="description">` content (reused) |
| `sections` | H2/H3 headings mapped to minimal section stubs (heading text only, no content nodes) |
| `heroImage` | First `<img>` in the article body |
| `internalLinks` | All `<a>` hrefs matching `bhutanwine.com` |
| `externalLinks` | All `<a>` hrefs not matching `bhutanwine.com` and not `#` anchors |
| `schema` | Parsed from `<script type="application/ld+json">` if present |
| `faq` | Parsed from FAQ schema JSON if present |

**Synthetic document marker:**

```typescript
{
  version: "1.0-import",  // Signals this is a synthetic doc
  // ... extracted fields ...
  _importMeta: {
    source: "paste" | "upload",
    importedAt: string,  // ISO timestamp
    originalFilename: string | null,  // For file uploads
    extractionCoverage: string[],  // Which fields were successfully extracted
  }
}
```

### D3. Import Modal UI

A modal triggered by an "Import HTML" button in the preview toolbar.

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Import HTML                                        [X] │
│                                                         │
│  Select Article:                                        │
│  [Dropdown: content map entries, searchable]            │
│                                                         │
│  ─── Paste HTML ───────────────────────────────────     │
│  ┌───────────────────────────────────────────────┐      │
│  │ <textarea placeholder="Paste your HTML...">   │      │
│  │                                               │      │
│  │                                               │      │
│  │                                               │      │
│  └───────────────────────────────────────────────┘      │
│                                                         │
│  ─── OR Upload File ───────────────────────────────     │
│  [Choose .html file]  filename.html (42 KB)             │
│                                                         │
│  [Cancel]                        [Import & Preview →]   │
└─────────────────────────────────────────────────────────┘
```

**Validation before import:**
- HTML must be non-empty
- Must contain at least one `<h1>` or `<body>` tag (basic HTML check)
- Article must be selected from content map
- If article already has a finalized version, show warning: "This article already has a finalized version. Importing will create a new draft that you can finalize as a new version."

### D4. QA Scorecard in Import Mode

The QA engine already receives `(doc: CanonicalArticleDocument, html: string, dom: DomAdapter)`. For imported HTML:
- `html` = the imported HTML string (full fidelity)
- `dom` = parsed from the imported HTML (full fidelity)
- `doc` = the synthetic canonical document (partial fidelity)

**Check behavior by category:**

| Category | Runs against | Import behavior |
|----------|-------------|-----------------|
| Structure (F01, F02, W01, W03) | HTML DOM | **Full fidelity** — works identically |
| Metadata (F03, F04, F05) | Canonical doc | **Partial** — uses extracted meta title/desc. Executive summary may be missing → downgrade F03 to WARN with note "Could not extract executive summary from imported HTML" |
| Content (F06) | HTML DOM | **Full fidelity** — word count from DOM text |
| Links (F07, F08, F09) | Canonical doc + DOM | **Partial for canonical, full for DOM** — we extract links from `<a>` tags. Link type classification (hub/spoke/core-page) may be incomplete |
| Schema (F10) | HTML DOM | **Full fidelity** — parses `<script type="application/ld+json">` |
| Images (F11, F12, W21) | HTML DOM | **Full fidelity** — checks `<img>` alt attributes |
| Author (F13) | Canonical doc | **Partial** — extracted from schema JSON if present |
| Dates (F14) | Canonical doc | **Partial** — extracted from meta tags/schema |
| Canonical URL (F17) | Canonical doc | **Partial** — extracted from `<link rel="canonical">` |
| Brand/Voice (W-level) | HTML DOM text | **Full fidelity** — banned phrases, superlatives, reading level |

**Implementation:** Add an `isImported: boolean` parameter to `runQAChecks()`. When `true`, checks that can't run meaningfully get their severity downgraded from FAIL to INFO with a message explaining why. The user sees these as grayed-out items in the scorecard with the label "Not applicable for imported HTML."

**Critically:** The QA gate for finalization still applies. HTML-level FAILs (heading hierarchy, word count, missing alt text, schema issues) still block finalization. Only canonical-doc-dependent FAILs that couldn't be extracted are downgraded.

### D5. Finalization Path for Imported HTML

The existing finalization route at `/api/articles/[id]/finalize` expects:

```typescript
{
  document: CanonicalArticleDocument,  // The synthetic doc
  html: string,                         // The imported HTML (used as-is)
  htmlOverrides: HtmlOverride[] | null, // null for imports
  notes: string                         // "Imported from external editing"
}
```

**Key difference from standard flow:** The standard finalization route calls `renderArticle()` to produce the final HTML from the canonical doc. For imports, we need to **skip the re-render** and use the imported HTML directly.

**Implementation approach:** Add an optional `skipRender: boolean` field to the finalize request. When `true`:
- Skip `renderArticle()` call
- Use the submitted `html` directly as the finalized HTML
- Still run server-side QA (the imported HTML is QA'd against the synthetic doc)
- Still extract `metaTitle`, `metaDescription`, `schemaJson`, `wordCount` from the HTML
- Still run the QA gate (FAILs block finalization)
- Commit to DB identically

### D6. HTML Metadata Extraction Utility

A new utility module that parses HTML and extracts structured metadata:

**File:** `src/lib/html-import/extract-metadata.ts`

```typescript
interface ExtractedMetadata {
  title: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  publishDate: string | null;
  authorName: string | null;
  authorCredentials: string | null;
  schemaJson: Record<string, unknown> | null;
  faqItems: { question: string; answer: string }[] | null;
  sections: { heading: string; level: 2 | 3 }[];
  heroImageSrc: string | null;
  heroImageAlt: string | null;
  internalLinks: { url: string; anchorText: string }[];
  externalLinks: { url: string; anchorText: string }[];
  wordCount: number;
  extractionCoverage: string[];  // Which fields were found
}

function extractMetadataFromHtml(html: string): ExtractedMetadata;
```

This utility is used both client-side (for preview and pre-QA) and server-side (in the finalization route for metadata extraction).

### D7. Import API Route

**Route:** `POST /api/articles/[id]/import-html`

This route is optional — the import can be handled entirely client-side with the existing finalize route. However, a dedicated import route provides:
- Server-side HTML sanitization (DOMPurify)
- Metadata extraction
- Synthetic canonical doc construction
- Validation that the article exists and user has permission

**Request:**
```typescript
{
  html: string;
  source: "paste" | "upload";
  filename: string | null;  // For uploads
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    syntheticDocument: CanonicalArticleDocument;
    extractedMetadata: ExtractedMetadata;
    sanitizedHtml: string;
    warnings: string[];  // e.g., "Could not extract meta description"
  }
}
```

---

## E. Step-by-Step Execution Plan

### Phase 1: Types and Utilities (no UI changes)

**Step 1.1:** Add import-related fields to `src/types/ui.ts`

Add to `ArticleEditorState`:
```typescript
isImportedHtml: boolean;
importSource: 'paste' | 'upload' | null;
```

Add to `ArticleEditorActions`:
```typescript
importHtml: (html: string, articleId: number, source: 'paste' | 'upload', filename?: string) => void;
clearImport: () => void;
```

Update `initialState` in article-store with the new fields defaulting to `false` and `null`.

**Step 1.2:** Create `src/lib/html-import/extract-metadata.ts`

Implement the `extractMetadataFromHtml()` function. Use `cheerio` (already likely available server-side) for parsing. For client-side usage, use `DOMParser`.

Create a shared extraction logic that works with both:
- A `CheerioExtractor` class for server-side
- A `BrowserExtractor` class for client-side

Both implement:
```typescript
interface HtmlExtractor {
  querySelector(selector: string): { textContent: string; getAttribute(name: string): string | null } | null;
  querySelectorAll(selector: string): { textContent: string; getAttribute(name: string): string | null; tagName: string }[];
  getBodyText(): string;
}
```

**Step 1.3:** Create `src/lib/html-import/build-synthetic-doc.ts`

Implement `buildSyntheticDocument(metadata: ExtractedMetadata, contentMapEntry: ContentMapEntry): CanonicalArticleDocument`

This constructs a minimal but valid canonical document from extracted metadata + the content map entry (which provides `articleType`, `slug`, `hubId`, `hubName`, etc.).

Key logic:
- Use content map entry for: `articleId`, `slug`, `articleType`, `hubId`, `canonicalUrl` (constructed from slug)
- Use extracted metadata for: `title`, `metaTitle`, `metaDescription`, `author`, `sections` (heading stubs), `heroImage`, links, schema
- Fill unextractable fields with safe defaults (empty arrays, placeholder strings)
- Set `version: "1.0-import"` to mark as synthetic
- Add `_importMeta` object with extraction details

**Verification:** Write a unit test or inline test script that takes a sample BWC blog HTML and confirms the synthetic document passes Zod validation (using the existing `CanonicalArticleDocumentSchema`).

### Phase 2: QA Engine Extension

**Step 2.1:** Modify `src/lib/qa/engine.ts` — `runQAChecks()` signature

Add optional `options` parameter:

```typescript
interface QARunOptions {
  isImported?: boolean;
}

export function runQAChecks(
  doc: CanonicalArticleDocument,
  html: string,
  dom: DomAdapter,
  options?: QARunOptions
): QAScore
```

**Step 2.2:** Create `src/lib/qa/import-adjustments.ts`

Define which checks get downgraded for imports:

```typescript
// Checks that depend on canonical doc fields we can't reliably extract
const IMPORT_DOWNGRADE_CHECKS: Record<string, string> = {
  'F03': 'Executive summary not extractable from imported HTML',
  // F04, F05 — CAN extract from <meta> tags, so they stay as-is
  // F07, F08 — CAN extract from <a> tags, but classification may be incomplete
  // Add others as testing reveals
};

export function adjustForImport(results: QAResult[]): QAResult[] {
  return results.map(r => {
    if (IMPORT_DOWNGRADE_CHECKS[r.checkId] && r.status === 'fail') {
      return {
        ...r,
        status: 'info',
        message: `${r.message} (${IMPORT_DOWNGRADE_CHECKS[r.checkId]})`,
      };
    }
    return r;
  });
}
```

**Step 2.3:** Wire the adjustment into `runQAChecks()`:

After all checks run, if `options?.isImported`, apply `adjustForImport()` before computing the final score.

### Phase 3: Finalization Route Extension

**Step 3.1:** Modify the Zod schema in `/api/articles/[id]/finalize/route.ts`:

Add `skipRender: z.boolean().optional().default(false)` to `FinalizeSchema`.

**Step 3.2:** In the route handler, before calling `commitFinalization()`:

```typescript
if (parsed.data.skipRender) {
  // Import path: use submitted HTML directly, extract metadata from it
  const extractedMeta = extractMetadataFromHtml(parsed.data.html);
  const rendererOutput: RendererOutput = {
    html: parsed.data.html,
    metaTitle: extractedMeta.metaTitle || document.metaTitle || '',
    metaDescription: extractedMeta.metaDescription || document.metaDescription || '',
    schemaJson: extractedMeta.schemaJson ? JSON.stringify(extractedMeta.schemaJson) : '{}',
    wordCount: extractedMeta.wordCount,
  };
  // Pass to commitFinalization with this rendererOutput instead of calling renderArticle()
}
```

This requires a small refactor: `commitFinalization()` currently calls `renderArticle()` internally. Factor out the render step so the caller can provide a pre-built `RendererOutput`.

**Step 3.3:** Refactor `commitFinalization()` in `src/lib/finalization/index.ts`:

Change signature to accept an optional `preRenderedOutput`:

```typescript
export async function commitFinalization(
  articleId: number,
  document: CanonicalArticleDocument,
  htmlOverrides: HtmlOverride[] | null,
  userEmail: string,
  notes?: string,
  preRenderedOutput?: RendererOutput  // NEW: skip render if provided
): Promise<CommitResult>
```

If `preRenderedOutput` is provided, use it instead of calling `renderArticle()`.

### Phase 4: Import Modal UI

**Step 4.1:** Create `src/components/import/ImportHtmlModal.tsx`

A modal component with:
- Article selector dropdown (fetches from `/api/content-map?status=planned,drafting,finalized`)
- Textarea for paste (monospace font, min-height 200px)
- File upload input (accepts `.html`, `.htm`)
- "Import & Preview" button
- Cancel button
- Loading state during metadata extraction
- Warning display (e.g., "Could not extract meta description — you may need to add it manually")

**Step 4.2:** Create `src/components/import/ImportButton.tsx`

A toolbar button that opens the modal. Placed in `PreviewToolbar` next to the existing Copy HTML / Download .html buttons.

Icon: Upload icon from lucide-react.
Label: "Import HTML"

**Step 4.3:** Wire import action in article store

Add `importHtml()` action to `src/lib/store/article-store.ts`:

```typescript
importHtml: (html: string, articleId: number, source: 'paste' | 'upload', filename?: string) => {
  const state = get();

  // Push current state to undo if exists
  if (state.currentDocument) {
    const entry = createUndoEntry(
      state.currentDocument,
      state.currentHtml,
      state.htmlOverrides,
      'Before HTML import'
    );
    set({ undoStack: pushToStack(state.undoStack, entry) });
  }

  // Extract metadata from HTML
  const metadata = extractMetadataFromHtmlBrowser(html);

  // Build synthetic canonical doc (needs content map entry)
  const contentMapEntry = state.selectedArticle;
  if (!contentMapEntry) return;

  const syntheticDoc = buildSyntheticDocument(metadata, contentMapEntry);

  set({
    currentDocument: syntheticDoc,
    currentHtml: html,
    htmlOverrides: [],
    isImportedHtml: true,
    importSource: source,
    editingMode: 'html',  // Force HTML mode
    previewMode: 'preview',
    qaScore: null,  // Clear stale QA
    redoStack: [],  // Clear redo on new import
  });
},

clearImport: () => {
  set({
    isImportedHtml: false,
    importSource: null,
  });
},
```

### Phase 5: UI Behavior for Import Mode

**Step 5.1:** Disable Chat and Canvas Edit modes when `isImportedHtml` is true.

In the toolbar mode selector (wherever the `[💬 Chat] [✏️ Canvas Edit] [🔧 HTML]` buttons are rendered):

```typescript
const { isImportedHtml, editingMode, setEditingMode } = useArticleStore();

// Chat button
<button
  disabled={isImportedHtml}
  title={isImportedHtml ? "Chat requires a generated article. Use HTML mode to edit imported HTML." : "Chat with Claude to edit the article"}
  onClick={() => setEditingMode('chat')}
>
  💬 Chat
</button>

// Canvas Edit button
<button
  disabled={isImportedHtml}
  title={isImportedHtml ? "Canvas Edit requires renderer-injected attributes. Use HTML mode." : "Click directly into the preview to edit text"}
  onClick={() => setEditingMode('canvas')}
>
  ✏️ Canvas Edit
</button>
```

**Step 5.2:** Show import indicator in the toolbar

When `isImportedHtml`, show a small badge: "📥 Imported HTML" with the source and timestamp.

**Step 5.3:** Wire QA scorecard to pass `isImported` flag

In the article store's `runQa()` action, pass the flag:

```typescript
runQa: () => {
  const state = get();
  if (!state.currentDocument || !state.currentHtml) return;
  const dom = new BrowserDomAdapter(state.currentHtml);
  const score = runQAChecks(
    state.currentDocument,
    state.currentHtml,
    dom,
    { isImported: state.isImportedHtml }
  );
  set({ qaScore: score, isScorecardOpen: true });
},
```

**Step 5.4:** Wire finalization to use `skipRender` for imports

In the article store's `finalizeArticle()` action:

```typescript
finalizeArticle: async () => {
  const state = get();
  // ... existing validation ...

  const body: Record<string, unknown> = {
    document: state.currentDocument,
    html: state.currentHtml,
    htmlOverrides: state.htmlOverrides.length > 0 ? state.htmlOverrides : null,
    notes: state.isImportedHtml
      ? `Imported from ${state.importSource} on ${new Date().toISOString()}`
      : undefined,
  };

  // For imports, tell the server to skip re-rendering
  if (state.isImportedHtml) {
    body.skipRender = true;
  }

  const response = await fetch(`/api/articles/${state.selectedArticleId}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // ... existing response handling ...
},
```

### Phase 6: Integration Testing

**Step 6.1:** Create test HTML fixture

Create `src/lib/html-import/__tests__/fixtures/sample-bwc-article.html` — a representative BWC blog post HTML with:
- `<h1>` title
- `<meta>` tags for title, description
- `<link rel="canonical">`
- `<script type="application/ld+json">` with BlogPosting schema
- Multiple H2/H3 sections
- Internal links to bhutanwine.com
- External links
- Images with alt text
- ~1500 words of content

**Step 6.2:** Unit tests for metadata extraction

Test `extractMetadataFromHtml()` against the fixture:
- Extracts title from H1
- Extracts meta title from `<title>` tag
- Extracts meta description
- Finds canonical URL
- Parses schema JSON
- Counts internal vs external links correctly
- Computes word count accurately

**Step 6.3:** Unit test for synthetic document construction

Test `buildSyntheticDocument()`:
- Output passes `CanonicalArticleDocumentSchema.safeParse()`
- Version is "1.0-import"
- `_importMeta` is present
- Article type comes from content map entry, not from HTML

**Step 6.4:** Integration test for import → QA flow

- Import the fixture HTML
- Run QA checks with `isImported: true`
- Verify HTML-level checks run normally
- Verify canonical-doc-dependent checks are appropriately downgraded
- Verify the QA score reflects the adjustments

---

## F. Files Created / Modified

### New files:
| File | Purpose |
|------|---------|
| `src/lib/html-import/extract-metadata.ts` | HTML metadata extraction utility |
| `src/lib/html-import/build-synthetic-doc.ts` | Constructs synthetic CanonicalArticleDocument from extracted metadata |
| `src/lib/html-import/index.ts` | Public exports |
| `src/lib/qa/import-adjustments.ts` | QA check severity adjustments for imported HTML |
| `src/components/import/ImportHtmlModal.tsx` | Import modal with paste/upload |
| `src/components/import/ImportButton.tsx` | Toolbar button to trigger import |
| `src/lib/html-import/__tests__/fixtures/sample-bwc-article.html` | Test fixture |
| `src/lib/html-import/__tests__/extract-metadata.test.ts` | Extraction tests |
| `src/lib/html-import/__tests__/build-synthetic-doc.test.ts` | Synthetic doc tests |

### Modified files:
| File | Change |
|------|--------|
| `src/types/ui.ts` | Add `isImportedHtml`, `importSource` to state; `importHtml`, `clearImport` to actions |
| `src/lib/store/article-store.ts` | Add `importHtml()` and `clearImport()` actions; wire `runQa()` and `finalizeArticle()` for import mode |
| `src/lib/qa/engine.ts` | Add `QARunOptions` parameter to `runQAChecks()`; apply import adjustments |
| `src/lib/finalization/index.ts` | Refactor `commitFinalization()` to accept optional `preRenderedOutput`; skip `renderArticle()` when provided |
| `src/app/api/articles/[id]/finalize/route.ts` | Add `skipRender` to Zod schema; handle import finalization path |
| `src/components/preview/PreviewToolbar.tsx` | Add ImportButton; disable Chat/Canvas modes when imported |

---

## G. Acceptance Criteria

1. **Paste import works:** User can paste HTML into the modal textarea, select an article, click "Import & Preview," and see the HTML rendered in the preview iframe.
2. **File upload works:** User can upload a `.html` file, see the filename displayed, and import it.
3. **Article association required:** The import button is disabled until an article is selected from the dropdown.
4. **Preview renders correctly:** The imported HTML displays in the iframe with full CSS rendering (same as standard preview).
5. **HTML mode is active:** After import, the HTML editor shows the imported source. Edits to the HTML update the preview in real time.
6. **Chat and Canvas modes are disabled:** Both buttons are grayed out with explanatory tooltips.
7. **QA scorecard runs:** User can click "Run QA Check" and see the scorecard. HTML-level checks (heading hierarchy, word count, alt text, schema) produce accurate results. Checks that can't run on imported HTML show as INFO with explanation.
8. **Finalization works:** User can click "Finalize Article" if no FAIL-level QA checks remain. The article is stored in `article_documents` and `article_html` tables. The content map status updates to "finalized."
9. **Export works:** After finalization, Copy HTML and Download .html work identically to standard-flow articles.
10. **Undo works:** If the user had a previous document state, they can undo back to it after importing.
11. **Reimport works:** User can import again over an existing import — the new HTML replaces the old one, and the old state goes to the undo stack.
12. **Import badge visible:** The toolbar shows a visual indicator that the current article is from an import, not from generation.

---

## H. Gate Checks

### Lint & Type Gate
```bash
npx tsc --noEmit          # Zero type errors
npx next lint              # Zero lint errors
```

### Integration Gate
```bash
# Test metadata extraction
npx tsx -e "
const { extractMetadataFromHtml } = require('./src/lib/html-import/extract-metadata');
const fs = require('fs');
const html = fs.readFileSync('./src/lib/html-import/__tests__/fixtures/sample-bwc-article.html', 'utf8');
const meta = extractMetadataFromHtml(html);
console.log('Title:', meta.title);
console.log('Meta Title:', meta.metaTitle);
console.log('Meta Desc:', meta.metaDescription?.slice(0, 50) + '...');
console.log('Sections:', meta.sections.length);
console.log('Internal Links:', meta.internalLinks.length);
console.log('External Links:', meta.externalLinks.length);
console.log('Word Count:', meta.wordCount);
console.log('Schema present:', !!meta.schemaJson);
console.log('Coverage:', meta.extractionCoverage);
"

# Test synthetic doc passes validation
npx tsx -e "
const { buildSyntheticDocument } = require('./src/lib/html-import/build-synthetic-doc');
const { extractMetadataFromHtml } = require('./src/lib/html-import/extract-metadata');
const { CanonicalArticleDocumentSchema } = require('./src/lib/article-schema/schema');
const fs = require('fs');
const html = fs.readFileSync('./src/lib/html-import/__tests__/fixtures/sample-bwc-article.html', 'utf8');
const meta = extractMetadataFromHtml(html);
const fakeEntry = { id: 1, articleType: 'spoke', slug: 'test-article', hubName: 'Test Hub', hubId: null };
const doc = buildSyntheticDocument(meta, fakeEntry);
const result = CanonicalArticleDocumentSchema.safeParse(doc);
console.log('Valid:', result.success);
if (!result.success) console.log('Errors:', JSON.stringify(result.error.issues, null, 2));
"
```

### Human Gate
```
1. Open the app → log in → navigate to the editor
2. Click "Import HTML" in the toolbar
3. Paste a BWC blog post HTML into the textarea
4. Select an article from the dropdown
5. Click "Import & Preview"
6. Verify: preview shows the article with correct styling
7. Verify: HTML mode editor shows the source
8. Verify: Chat and Canvas Edit buttons are grayed out with tooltips
9. Verify: "📥 Imported HTML" badge appears in toolbar
10. Click "Run QA Check"
11. Verify: scorecard appears with accurate HTML-level checks
12. Verify: unextractable checks show as INFO, not FAIL
13. Click "Finalize Article" (if no FAILs)
14. Verify: finalization succeeds, export panel appears
15. Click "Copy HTML" → paste into a blank HTML file → open in browser → verify it looks correct
16. Check database: article_documents row exists with version "1.0-import", article_html row exists with the imported HTML
```

---

## I. Risks and Failure Modes

### Risk 1: Imported HTML breaks in the preview iframe
**Likelihood:** Medium. External tools may produce HTML with different CSS or JavaScript.
**Mitigation:** The preview iframe is sandboxed. Imported HTML may not have the BWC compiled template CSS — which is expected and acceptable. The user is importing HTML they already refined externally, so they know what it looks like. If the user wants BWC styling, they should ensure the HTML includes the template's `<style>` block (which it will if they downloaded it from the app originally).

### Risk 2: Synthetic canonical document fails Zod validation
**Likelihood:** Medium. The CanonicalArticleDocument schema is strict.
**Mitigation:** The `buildSyntheticDocument()` function must produce a schema-valid document by construction. Use safe defaults for all required fields. Test thoroughly against the Zod schema. If validation still fails, fall back to a minimal valid document with empty arrays and placeholder strings.

### Risk 3: QA checks produce misleading results for imports
**Likelihood:** Low-medium. Some checks may pass/fail based on incomplete data.
**Mitigation:** The `import-adjustments.ts` module explicitly downgrades checks that can't run meaningfully. The scorecard clearly labels these as "Not applicable for imported HTML." Start with a conservative downgrade list and expand based on testing.

### Risk 4: Users try to Chat with imported HTML
**Likelihood:** High — it's natural to want to ask Claude to fix things.
**Mitigation:** Chat is disabled with a clear tooltip. Future enhancement: allow Chat to operate on imported HTML by treating the entire HTML as an override layer and having Claude return HTML patches rather than canonical doc updates. This is out of scope for this guide but is a natural follow-up.

### Risk 5: `commitFinalization` refactor breaks standard flow
**Likelihood:** Low, but high impact.
**Mitigation:** The refactor is minimal — adding an optional parameter. Standard flow passes `undefined` for `preRenderedOutput`, which means `renderArticle()` runs as before. Test both paths.

---

## J. Open Questions

None. All design decisions are specified above with strong defaults. If testing reveals issues with the synthetic document or QA adjustments, they can be fixed incrementally without architectural changes.

---

## K. Claude Code Execution Prompt

Copy this into a fresh Claude Code session:

```
Read the implementation guide at `guides/guide-html-import.md` (or wherever this file is placed in the repo).

Execute each phase in order:

Phase 1: Types and utilities (Steps 1.1–1.3)
Phase 2: QA engine extension (Steps 2.1–2.3)
Phase 3: Finalization route extension (Steps 3.1–3.3)
Phase 4: Import modal UI (Steps 4.1–4.3)
Phase 5: UI behavior for import mode (Steps 5.1–5.4)
Phase 6: Integration testing (Steps 6.1–6.4)

After each phase, run:
  npx tsc --noEmit
  npx next lint

After all phases, run the full gate checks from section H.

Stop and report at each phase completion.
Do not proceed to the next phase if the current phase has type errors or lint failures.
```

---

## L. What to Build Next

After this guide executes:
1. **Continue the sequential build** with `/next-guide` → Guide 3 (Onyx RAG Integration)
2. **Enhancement:** Allow Chat mode to operate on imported HTML (generates HTML patches instead of canonical doc updates)
3. **Enhancement:** "Re-import" button that appears when viewing a finalized article — lets the user download, edit externally, and re-import as a new version
