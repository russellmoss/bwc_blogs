# Implementation Guide 7: Canvas Edit + HTML Mode + Undo/Redo

**Guide type:** Critical-path implementation
**Depends on:** Guides 4 (renderer with data-cad-path), 6 (UI shell)
**Milestone:** M4 — "Full editing"
**Last updated:** 2026-03-02

---

## A. Objective

Build the two additional editing modes (Canvas Edit and HTML Mode) and the unified undo/redo system. When this guide completes, a user can:

1. Click the **Canvas** toggle to enter Canvas Edit mode
2. Click directly into any text element in the preview iframe and type — headings, paragraphs, list items, captions, key facts, table cells
3. See edits reflected in the canonical document (not raw HTML)
4. Click the **HTML** toggle to open a syntax-highlighted CodeMirror editor showing the rendered HTML source
5. Edit HTML source directly with syntax highlighting and line numbers
6. Use **Undo/Redo** buttons (or Ctrl+Z / Ctrl+Y) to step through edit history across all three modes
7. Switch freely between Chat, Canvas, and HTML modes — all edits persist through the canonical document

This is the point where the editor becomes a full editing environment, not just a generator-and-viewer.

---

## B. Scope

### In Scope
- Renderer patch: add `data-cad-path` to 11 missing element types in `components.ts`
- New types: `UndoEntry` interface, extended `ArticleEditorState` and `ArticleEditorActions`
- Store extension: undo/redo stacks, canvas edit actions, `isCanvasEditing` flag, `htmlOverrides` tracking
- Undo/redo manager: `src/lib/undo-redo/undo-manager.ts` — pure function helpers
- Canvas edit overlay: `src/components/canvas-edit/CanvasEditOverlay.tsx` — contenteditable injection, debounced sync, locked-element overlays
- HTML editor: `src/components/html-editor/HtmlEditor.tsx` — CodeMirror 6 with syntax highlighting
- Toolbar update: add Chat/Canvas/HTML editing mode switcher and Undo/Redo buttons to `PreviewToolbar`
- PreviewIframe enhancement: add `useRef`, `onLoad` handler, expose DOM access
- PreviewPanel update: route to canvas overlay and HTML editor based on `editingMode`
- Install CodeMirror 6 packages

### Out of Scope
- QA Scorecard overlay and click-to-highlight (Guide 8)
- "Fix in Canvas" action from QA scorecard (Guide 8)
- Photo Manager and Cloudinary upload UI (Guide 9)
- Content Map Dashboard table/hub views (Guide 10)
- Article persistence to database, finalization flow (Guide 11)
- Reverse mapping from HTML edits back to canonical doc fields (future iteration — for MVP, HTML edits create overrides only)
- Rich text toolbar in canvas mode (bold/italic/link buttons — future iteration)

---

## C. Depends On

| Guide | What This Guide Uses From It |
|---|---|
| 4 | `renderArticle()` from `@/lib/renderer`, `data-cad-path` attributes on rendered elements, `HtmlOverride` type, `RendererInput.htmlOverrides` |
| 6 | `useArticleStore`, `PreviewIframe`, `PreviewPanel`, `PreviewToolbar`, `HtmlSourceView`, `ArticleEditorState`, `ArticleEditorActions`, `EditingMode` type |

All dependencies verified present and working (see `exploration-results.md` §3).

---

## D. Shared Contracts Referenced

### Types (from `src/types/`)
- `CanonicalArticleDocument` — `src/types/article.ts`
- `HtmlOverride`, `RendererInput` — `src/types/renderer.ts`
- `EditingMode`, `ArticleEditorState`, `ArticleEditorActions` — `src/types/ui.ts`
- `ValidationResult` — `src/types/api.ts`

### Library Modules
- `renderArticle`, `TEMPLATE_VERSION` — `@/lib/renderer`
- `useArticleStore`, `selectEffectiveHtml` — `@/lib/store/article-store`

### Architecture Doc References
- §3F (line 634): Three Editing Modes — full spec for Canvas Edit, HTML Mode, mode switching
- §3G (line 706): State Flow diagram — how modes interact with canonical document
- §3H (line 744): Typical user flow mixing all three modes

---

## E. Existing Constraints to Preserve

1. **`npm run build` must continue to pass** with zero errors after every phase
2. **All 16 existing API routes** must remain functional — this guide creates NO new routes
3. **Do not modify** files owned by Guides 1–5 except `src/lib/renderer/components.ts` (add data-cad-path attributes)
4. **Import conventions**: `@/` path alias, `import type` for type-only imports, named exports only (never default)
5. **Styling**: Inline `style={{}}` with hex color strings. Gold active: `#bc9b5d`, text: `#414141`, dark bg: `#1a1a1a`
6. **Store pattern**: `create<State & Actions>((set, get) => ({...}))`, selectors as standalone exports
7. **Renderer is pure**: No DB calls, no API calls, no side effects in `components.ts` or `renderer.ts`
8. **iframe sandbox**: Keep `allow-same-origin`. Do NOT add `allow-scripts` — canvas edit uses direct DOM access from parent, not scripts inside the iframe
9. **previewMode vs editingMode**: These are separate concerns. `previewMode` ("preview" | "html") controls what the right panel shows. `editingMode` ("chat" | "canvas" | "html") controls which editing mode is active. Do not merge them.

---

## F. Files Created / Modified

### New Files (8 total)

| File | Purpose |
|---|---|
| `src/components/canvas-edit/CanvasEditOverlay.tsx` | Canvas edit mode controller — contenteditable injection, event listeners, debounced sync |
| `src/components/canvas-edit/LockedElementOverlay.tsx` | Visual overlay for non-editable elements (images, schema blocks) |
| `src/components/canvas-edit/index.ts` | Re-exports |
| `src/components/html-editor/HtmlEditor.tsx` | Dynamic import wrapper for CodeMirror (SSR-safe) |
| `src/components/html-editor/HtmlEditorInner.tsx` | Actual CodeMirror 6 editor component |
| `src/components/html-editor/index.ts` | Re-exports |
| `src/lib/undo-redo/undo-manager.ts` | Pure function helpers for undo/redo stack management |
| `src/lib/undo-redo/index.ts` | Re-exports |

### Modified Files (7 total)

| File | Change |
|---|---|
| `src/lib/renderer/components.ts` | Add `data-cad-path` to 11 missing element types; add `dataCadPrefix` param to `renderImage()` and `renderAuthorBio()` |
| `src/types/ui.ts` | Add `UndoEntry` interface; extend `ArticleEditorState` with 4 new fields; extend `ArticleEditorActions` with 7 new actions |
| `src/lib/store/article-store.ts` | Implement new state fields and actions for undo/redo, canvas edit, HTML overrides |
| `src/components/preview/PreviewIframe.tsx` | Add `useRef<HTMLIFrameElement>`, `onLoad` handler, expose ref via callback; suppress re-render when `isCanvasEditing` |
| `src/components/preview/PreviewToolbar.tsx` | Add Chat/Canvas/HTML editing mode toggle group; add Undo/Redo buttons |
| `src/components/preview/PreviewPanel.tsx` | Import canvas edit overlay and HTML editor; route rendering based on `editingMode` |
| `package.json` | Add `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-html`, `@codemirror/theme-one-dark` |

---

## G. Technical Design

### G1. Renderer data-cad-path Patch

The renderer must emit `data-cad-path` on ALL editable text elements so canvas edit can map DOM edits back to canonical document fields. Currently 9 elements have paths; 11 are missing.

**Patching strategy:**
- Convert `for...of` loops to indexed `for` loops where array index is needed for the path
- Add `dataCadPrefix` parameter to `renderImage()` and `renderAuthorBio()` so they can receive their path context from the caller
- Keep `escapeHtml()` for text content, do NOT escape data-cad-path values (developer-generated paths)

**Complete data-cad-path map after patch:**
```
title                                    → <h1>
executiveSummary                         → <p>
sections[N].heading                      → <h2>/<h3>
sections[N].content[M].text             → <p> (paragraph, pullQuote, callout)
sections[N].content[M].attribution      → <cite> (pullQuote)
sections[N].content[M].title            → <h3> (keyFacts)
sections[N].content[M].facts[K].label   → <dt> (keyFacts)      ← NEW
sections[N].content[M].facts[K].value   → <dd> (keyFacts)      ← NEW
sections[N].content[M].items[K]         → <li> (list)           ← NEW
sections[N].content[M].headers[K]       → <th> (table)          ← NEW
sections[N].content[M].rows[R][C]       → <td> (table)          ← NEW
sections[N].content[M].caption          → <caption> (table)     ← NEW
heroImage.caption                        → <figcaption>          ← NEW
sections[N].content[M].placement.caption → <figcaption>          ← NEW
author.name                              → <p> (author bio)      ← NEW
author.credentials                       → <p> (author bio)      ← NEW
author.bio                               → <p> (author bio)      ← NEW
faq[N].question                          → <h3>
faq[N].answer                            → <p>
```

### G2. Undo/Redo Architecture

**Snapshot-based design** (matches existing `versionHistory` pattern):

```
UndoEntry = {
  document: CanonicalArticleDocument   // full deep copy
  html: string                         // rendered HTML at that point
  htmlOverrides: HtmlOverride[]        // active overrides
  timestamp: string                    // ISO timestamp
  label: string                        // e.g. "Canvas edit", "HTML edit", "Chat edit"
}
```

**Stack behavior:**
- `pushUndo()` — called BEFORE any mutation. Snapshots current state, pushes to `undoStack`, clears `redoStack`.
- `undo()` — pops `undoStack`, pushes current state to `redoStack`, restores popped entry.
- `redo()` — pops `redoStack`, pushes current state to `undoStack`, restores popped entry.
- Stack depth limit: 50 entries. Oldest entries dropped when limit exceeded.
- `structuredClone()` used for deep copying documents.

**Cross-mode consistency:** Every mutation from any mode (Chat `completeGeneration`, Canvas `applyCanvasEdit`, HTML override) calls `pushUndo()` first. This creates a unified timeline.

### G3. Canvas Edit Mode

**Activation flow:**
1. User clicks "Canvas" in editing mode toggle
2. `setEditingMode("canvas")` fires, `setIsCanvasEditing(true)` fires
3. `CanvasEditOverlay` mounts, accesses `iframeRef.current.contentDocument`
4. Injects `contenteditable="true"` on all elements with `data-cad-path`
5. Adds `focus`/`input`/`blur` event listeners on the contentDocument
6. Non-editable elements (images, `<figure>`, schema blocks, structural containers) get a subtle locked overlay on hover

**Edit sync flow (300ms debounce):**
1. User types in a contenteditable element
2. `input` event fires on the element
3. Debounce timer starts (300ms)
4. After 300ms of no input:
   a. Read `data-cad-path` attribute from the edited element
   b. Read `innerHTML` from the element (preserves inline `<a>`, `<strong>`, `<em>`)
   c. Call `pushUndo()` then `applyCanvasEdit(cadPath, newHtml)`
   d. Store updates `currentDocument` at the matching path
   e. `currentHtml` is NOT re-rendered (iframe re-render suppressed by `isCanvasEditing`)
5. On mode switch away from canvas: set `isCanvasEditing(false)`, re-render iframe from canonical doc

**Focus/blur UX:**
- On `focus`: add thin blue outline (`2px solid #3b82f6`) to the focused element
- On `blur`: remove outline, trigger final sync if pending

**Locked elements:** Elements without `data-cad-path` (images, `<figure>`, `<nav>`, `<script>`, JSON-LD blocks) get a semi-transparent overlay with a lock icon on hover, indicating "use Chat mode for this edit."

### G4. HTML Mode

**Design:** Replace the read-only `<pre>` in `HtmlSourceView` with a full CodeMirror 6 editor.

**Component split for SSR safety:**
- `HtmlEditor.tsx` — wrapper that uses `next/dynamic` with `{ ssr: false }` to load the inner component
- `HtmlEditorInner.tsx` — the actual CodeMirror component (only runs in browser)

**Sync strategy (MVP — one-directional to overrides):**
1. CodeMirror shows `selectEffectiveHtml` (the current rendered HTML)
2. User edits the HTML source
3. On change (500ms debounce): the full edited HTML is stored as a single `HtmlOverride` with path `"__full_html"` and reason `"HTML mode edit"`
4. This override replaces the entire rendered output on next render cycle
5. On mode switch away from HTML: the override is applied

**NOT in MVP scope:** Reverse-mapping HTML text edits back to canonical document fields. This is complex and deferred. For now, HTML edits are override-only.

**CodeMirror configuration:**
- Extensions: `html()` language, `oneDark` theme, `lineNumbers()`, `EditorView.lineWrapping`
- Dark theme matching existing code view (`#1a1a1a` background)
- Copy HTML button preserved from current `HtmlSourceView`

### G5. Updated Component Tree

```
PreviewPanel
  ├── PreviewToolbar
  │   ├── Preview/HTML toggle (previewMode)
  │   ├── Desktop/Mobile toggle (viewportMode)
  │   ├── Chat/Canvas/HTML toggle (editingMode)    ← NEW
  │   ├── Undo/Redo buttons                        ← NEW
  │   ├── VersionNavigator
  │   └── Validation badge
  └── Content Area
      ├── PreviewIframe (when previewMode="preview")
      │   └── CanvasEditOverlay (when editingMode="canvas")  ← NEW
      ├── HtmlEditor (when editingMode="html")               ← NEW
      └── HtmlSourceView (when previewMode="html" AND editingMode!="html")
```

### G6. cadPath Resolution Helper

The `applyCanvasEdit(cadPath, newText)` action needs to resolve a dot-notation path like `sections[2].content[1].text` to a field on the canonical document. This is implemented in `src/lib/undo-redo/undo-manager.ts` as a pure function:

```typescript
function setByPath(obj: any, path: string, value: any): any {
  // Deep clone, parse path segments, walk object, set value
  // Handles: "title", "sections[0].heading", "sections[0].content[1].facts[2].label"
}
```

---

## H. Step-by-Step Execution Plan

### Phase 1: Foundation (Renderer Patch + Types + Dependencies)

#### Step 1.1: Install CodeMirror Dependencies

```bash
npm install @codemirror/view @codemirror/state @codemirror/lang-html @codemirror/theme-one-dark
```

**Verify:** `npm run build` still passes. Check `package.json` shows all four packages.

---

#### Step 1.2: Patch Renderer — Add Missing data-cad-path Attributes

**File:** `src/lib/renderer/components.ts`

**Changes:**

1. **Add `dataCadPrefix` parameter to `renderImage()`** (line 29):

```typescript
function renderImage(
  placement: ImagePlacement,
  isHero: boolean,
  dataCadPrefix?: string
): string {
```

2. **Add `data-cad-path` to figcaption** (line 61-63):

```typescript
  if (!isDecorative && placement.caption) {
    const captionPath = dataCadPrefix ? ` data-cad-path="${dataCadPrefix}.caption"` : "";
    html += `\n    <figcaption${captionPath}>${escapeHtml(placement.caption)}</figcaption>`;
  }
```

3. **Patch keyFacts loop** — convert `for...of` to indexed loop (lines 98-100):

```typescript
    case "keyFacts": {
      let html = `<aside class="bwc-key-facts">
    <h3 class="bwc-key-facts__title" data-cad-path="${path}.title">${escapeHtml(node.title)}</h3>
    <dl class="bwc-key-facts__list">`;
      for (let k = 0; k < node.facts.length; k++) {
        const fact = node.facts[k];
        html += `\n      <dt data-cad-path="${path}.facts[${k}].label">${escapeHtml(fact.label)}</dt><dd data-cad-path="${path}.facts[${k}].value">${escapeHtml(fact.value)}</dd>`;
      }
      html += "\n    </dl>\n  </aside>";
      return html;
    }
```

4. **Patch table** — add data-cad-path to caption, th, td (lines 105-127):

```typescript
    case "table": {
      let html = "<table>";
      if (node.caption) {
        html += `\n    <caption data-cad-path="${path}.caption">${escapeHtml(node.caption)}</caption>`;
      }
      if (node.headers.length > 0) {
        html += "\n    <thead><tr>";
        for (let k = 0; k < node.headers.length; k++) {
          html += `<th data-cad-path="${path}.headers[${k}]">${escapeHtml(node.headers[k])}</th>`;
        }
        html += "</tr></thead>";
      }
      html += "\n    <tbody>";
      for (let r = 0; r < node.rows.length; r++) {
        html += "\n      <tr>";
        for (let c = 0; c < node.rows[r].length; c++) {
          html += `<td data-cad-path="${path}.rows[${r}][${c}]">${escapeHtml(node.rows[r][c])}</td>`;
        }
        html += "</tr>";
      }
      html += "\n    </tbody>\n  </table>";
      return html;
    }
```

5. **Patch list** — add data-cad-path to li (lines 129-138):

```typescript
    case "list": {
      const tag = node.ordered ? "ol" : "ul";
      let html = `<${tag}>`;
      for (let k = 0; k < node.items.length; k++) {
        // List items may contain inline HTML — pass through
        html += `\n    <li data-cad-path="${path}.items[${k}]">${node.items[k]}</li>`;
      }
      html += `\n  </${tag}>`;
      return html;
    }
```

6. **Pass dataCadPrefix to renderImage() in `renderContentNode`** (line 82):

```typescript
    case "image":
      return renderImage(node.placement, false, `${path}.placement`);
```

7. **Add dataCadPrefix parameter to `renderAuthorBio()`** and add data-cad-path to bio elements:

```typescript
export function renderAuthorBio(doc: CanonicalArticleDocument): string {
  const authorName = doc.author.linkedinUrl
    ? `<a href="${escapeHtml(doc.author.linkedinUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(doc.author.name)}</a>`
    : escapeHtml(doc.author.name);

  let html = `<footer class="bwc-author-bio">
    <p class="bwc-author-bio__name" data-cad-path="author.name">${authorName}</p>
    <p class="bwc-author-bio__credentials" data-cad-path="author.credentials">${escapeHtml(doc.author.credentials)}</p>`;

  if (doc.author.bio) {
    html += `\n    <p data-cad-path="author.bio">${escapeHtml(doc.author.bio)}</p>`;
  }

  html += "\n  </footer>";
  return html;
}
```

8. **Pass dataCadPrefix to renderImage() in `renderHeroImage()`** (line 165-168):

```typescript
export function renderHeroImage(doc: CanonicalArticleDocument): string {
  if (!doc.heroImage) return "";
  return renderImage(doc.heroImage, true, "heroImage");
}
```

**Verify:** `npm run build` passes. `npx tsc --noEmit` passes. No behavioral change — just additional HTML attributes.

---

#### Step 1.3: Extend Type Definitions

**File:** `src/types/ui.ts`

Add `UndoEntry` interface after the `ArticleVersion` interface:

```typescript
// === Undo/Redo ===

export interface UndoEntry {
  document: CanonicalArticleDocument;
  html: string;
  htmlOverrides: HtmlOverride[];
  timestamp: string;
  label: string;
}
```

Add to `ArticleEditorState` (after `editingMode`):

```typescript
  // Undo/Redo
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

  // Canvas edit
  isCanvasEditing: boolean;
  htmlOverrides: HtmlOverride[];
```

Add to `ArticleEditorActions` (after `setEditingMode`):

```typescript
  // Undo/Redo
  pushUndo: (label: string) => void;
  undo: () => void;
  redo: () => void;

  // Canvas edit
  applyCanvasEdit: (cadPath: string, newText: string) => void;
  setIsCanvasEditing: (active: boolean) => void;

  // HTML overrides
  applyHtmlOverride: (override: HtmlOverride) => void;
  clearHtmlOverrides: () => void;
```

Add the `HtmlOverride` import at the top of the file:

```typescript
import type { HtmlOverride } from "./renderer";
```

**Verify:** `npx tsc --noEmit` will fail (store doesn't implement new actions yet). That's expected — Step 1.4 fixes it.

---

#### Step 1.4: Create Undo/Redo Manager

**File:** `src/lib/undo-redo/undo-manager.ts`

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { UndoEntry } from "@/types/ui";
import type { HtmlOverride } from "@/types/renderer";

const MAX_UNDO_DEPTH = 50;

/** Create a snapshot of the current editor state */
export function createUndoEntry(
  document: CanonicalArticleDocument,
  html: string,
  htmlOverrides: HtmlOverride[],
  label: string
): UndoEntry {
  return {
    document: structuredClone(document),
    html,
    htmlOverrides: structuredClone(htmlOverrides),
    timestamp: new Date().toISOString(),
    label,
  };
}

/** Push an entry onto the undo stack, enforcing depth limit */
export function pushToStack(stack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  const newStack = [...stack, entry];
  if (newStack.length > MAX_UNDO_DEPTH) {
    return newStack.slice(newStack.length - MAX_UNDO_DEPTH);
  }
  return newStack;
}

/** Pop the top entry from a stack, returning [poppedEntry, remainingStack] */
export function popFromStack(stack: UndoEntry[]): [UndoEntry | null, UndoEntry[]] {
  if (stack.length === 0) return [null, stack];
  const newStack = stack.slice(0, -1);
  const entry = stack[stack.length - 1];
  return [entry, newStack];
}

/**
 * Resolve a dot-notation data-cad-path to set a value on a canonical document.
 * Returns a deep-cloned document with the value set at the specified path.
 *
 * Supports: "title", "sections[0].heading", "sections[0].content[1].text",
 * "sections[0].content[1].facts[2].label", "faq[0].question", "author.name", etc.
 */
export function setByPath(
  doc: CanonicalArticleDocument,
  cadPath: string,
  value: string
): CanonicalArticleDocument {
  const clone = structuredClone(doc);

  // Parse path into segments: "sections[0].content[1].text" → ["sections", 0, "content", 1, "text"]
  const segments: (string | number)[] = [];
  const regex = /([a-zA-Z_]+)|\[(\d+)\]/g;
  let match;
  while ((match = regex.exec(cadPath)) !== null) {
    if (match[1] !== undefined) {
      segments.push(match[1]);
    } else if (match[2] !== undefined) {
      segments.push(parseInt(match[2], 10));
    }
  }

  if (segments.length === 0) return clone;

  // Walk the object to the parent of the target field
  let current: any = clone;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (current[seg] === undefined) return clone; // path doesn't exist, return unchanged
    current = current[seg];
  }

  // Set the value
  const lastSeg = segments[segments.length - 1];
  current[lastSeg] = value;

  return clone;
}
```

**File:** `src/lib/undo-redo/index.ts`

```typescript
export { createUndoEntry, pushToStack, popFromStack, setByPath } from "./undo-manager";
```

**Verify:** `npx tsc --noEmit` — still expects store updates. Continue to next step.

---

### Phase 2: Store Extension

#### Step 2.1: Update Zustand Store

**File:** `src/lib/store/article-store.ts`

Add imports at the top:

```typescript
import type { HtmlOverride } from "@/types/renderer";
import type { UndoEntry } from "@/types/ui";
import { createUndoEntry, pushToStack, popFromStack, setByPath } from "@/lib/undo-redo";
import { renderArticle } from "@/lib/renderer";
import { TEMPLATE_VERSION } from "@/lib/renderer/compiled-template";
```

Add to `initialState`:

```typescript
  undoStack: [],
  redoStack: [],
  isCanvasEditing: false,
  htmlOverrides: [],
```

Add these actions inside the `create()` call, after the `setEditingMode` action:

```typescript
    // === Undo/Redo ===

    pushUndo: (label: string) => {
      const state = get();
      if (!state.currentDocument) return;
      const entry = createUndoEntry(
        state.currentDocument,
        state.currentHtml,
        state.htmlOverrides,
        label
      );
      set({
        undoStack: pushToStack(state.undoStack, entry),
        redoStack: [], // clear redo on new edit
      });
    },

    undo: () => {
      const state = get();
      if (state.undoStack.length === 0 || !state.currentDocument) return;
      // Save current state to redo
      const currentEntry = createUndoEntry(
        state.currentDocument,
        state.currentHtml,
        state.htmlOverrides,
        "Before undo"
      );
      const [entry, newUndoStack] = popFromStack(state.undoStack);
      if (!entry) return;
      set({
        currentDocument: entry.document,
        currentHtml: entry.html,
        htmlOverrides: entry.htmlOverrides,
        undoStack: newUndoStack,
        redoStack: pushToStack(state.redoStack, currentEntry),
      });
    },

    redo: () => {
      const state = get();
      if (state.redoStack.length === 0 || !state.currentDocument) return;
      // Save current state to undo
      const currentEntry = createUndoEntry(
        state.currentDocument,
        state.currentHtml,
        state.htmlOverrides,
        "Before redo"
      );
      const [entry, newRedoStack] = popFromStack(state.redoStack);
      if (!entry) return;
      set({
        currentDocument: entry.document,
        currentHtml: entry.html,
        htmlOverrides: entry.htmlOverrides,
        redoStack: newRedoStack,
        undoStack: pushToStack(state.undoStack, currentEntry),
      });
    },

    // === Canvas Edit ===

    applyCanvasEdit: (cadPath: string, newText: string) => {
      const state = get();
      if (!state.currentDocument) return;
      const updatedDoc = setByPath(state.currentDocument, cadPath, newText);
      // Do NOT re-render HTML here — isCanvasEditing suppresses iframe updates
      set({ currentDocument: updatedDoc });
    },

    setIsCanvasEditing: (active: boolean) => {
      const state = get();
      if (!active && state.currentDocument) {
        // Leaving canvas mode — re-render HTML from canonical doc
        const result = renderArticle({
          document: state.currentDocument,
          htmlOverrides: state.htmlOverrides.length > 0 ? state.htmlOverrides : null,
          templateVersion: TEMPLATE_VERSION,
        });
        set({ isCanvasEditing: false, currentHtml: result.html });
      } else {
        set({ isCanvasEditing: active });
      }
    },

    // === HTML Overrides ===

    applyHtmlOverride: (override: HtmlOverride) =>
      set((state) => {
        const existing = state.htmlOverrides.findIndex((o) => o.path === override.path);
        const newOverrides = [...state.htmlOverrides];
        if (existing >= 0) {
          newOverrides[existing] = override;
        } else {
          newOverrides.push(override);
        }
        return { htmlOverrides: newOverrides };
      }),

    clearHtmlOverrides: () => set({ htmlOverrides: [] }),
```

Also update the existing `completeGeneration` action to push undo before replacing:

In the `completeGeneration` action, add at the very beginning of the `set((state) => {` callback, before the `const newHistory = [...]` line:

```typescript
    completeGeneration: (response: GenerateArticleResponse) =>
      set((state) => {
        // Push undo before replacing document
        let newUndoStack = state.undoStack;
        if (state.currentDocument) {
          const entry = createUndoEntry(
            state.currentDocument,
            state.currentHtml,
            state.htmlOverrides,
            `v${state.versionHistory.length + 1} — Chat edit`
          );
          newUndoStack = pushToStack(state.undoStack, entry);
        }

        const newHistory = [...state.versionHistory];
        // ... rest of existing logic unchanged ...

        return {
          // ... existing return fields ...
          undoStack: newUndoStack,
          redoStack: [], // clear redo on new edit
        };
      }),
```

Add new selectors at the bottom of the file:

```typescript
export function selectCanUndo(state: ArticleEditorState): boolean {
  return state.undoStack.length > 0;
}

export function selectCanRedo(state: ArticleEditorState): boolean {
  return state.redoStack.length > 0;
}
```

Update `resetEditor` to include new fields:

```typescript
    resetEditor: () => set(initialState),
```

This already works since `initialState` will include the new fields with their defaults.

**Verify:** `npx tsc --noEmit` passes. `npm run build` passes.

---

### Phase 3: UI Components

#### Step 3.1: Update PreviewToolbar — Add Editing Mode Toggle + Undo/Redo

**File:** `src/components/preview/PreviewToolbar.tsx`

Add imports:

```typescript
import { MessageSquare, Pencil, Undo2, Redo2 } from "lucide-react";
import { selectCanUndo, selectCanRedo } from "@/lib/store/article-store";
```

Add to the destructured store access (line 42-47):

```typescript
  const {
    previewMode,
    setPreviewMode,
    viewportMode,
    setViewportMode,
    editingMode,
    setEditingMode,
    pushUndo,
    undo,
    redo,
  } = useArticleStore();
  const validationResult = useArticleStore(selectEffectiveValidation);
  const canUndo = useArticleStore(selectCanUndo);
  const canRedo = useArticleStore(selectCanRedo);
```

Add after the Desktop/Mobile toggle group (after line 95), before `{/* Version history navigator */}`:

```tsx
      {/* Editing mode toggle */}
      <div style={{ display: "flex", borderRadius: "6px", border: "1px solid #cccccc", overflow: "hidden" }}>
        <ToggleButton
          active={editingMode === "chat"}
          onClick={() => setEditingMode("chat")}
          icon={<MessageSquare style={iconSize} />}
          label="Chat"
        />
        <ToggleButton
          active={editingMode === "canvas"}
          onClick={() => setEditingMode("canvas")}
          icon={<Pencil style={iconSize} />}
          label="Canvas"
        />
        <ToggleButton
          active={editingMode === "html"}
          onClick={() => setEditingMode("html")}
          icon={<Code style={iconSize} />}
          label="HTML"
        />
      </div>

      {/* Undo / Redo */}
      <div style={{ display: "flex", gap: "2px" }}>
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "4px 6px",
            background: "transparent",
            border: "none",
            cursor: canUndo ? "pointer" : "default",
            opacity: canUndo ? 1 : 0.3,
            color: "#414141",
          }}
        >
          <Undo2 style={iconSize} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "4px 6px",
            background: "transparent",
            border: "none",
            cursor: canRedo ? "pointer" : "default",
            opacity: canRedo ? 1 : 0.3,
            color: "#414141",
          }}
        >
          <Redo2 style={iconSize} />
        </button>
      </div>
```

**Verify:** `npm run build` passes. The editing mode toggle and undo/redo buttons appear in the toolbar.

---

#### Step 3.2: Update PreviewIframe — Add Ref + Re-render Suppression

**File:** `src/components/preview/PreviewIframe.tsx`

Replace the entire file:

```typescript
"use client";

import { useRef, useCallback } from "react";
import { useArticleStore, selectEffectiveHtml } from "@/lib/store/article-store";

export function PreviewIframe() {
  const viewportMode = useArticleStore((s) => s.viewportMode);
  const isCanvasEditing = useArticleStore((s) => s.isCanvasEditing);
  const currentHtml = useArticleStore(selectEffectiveHtml);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastHtmlRef = useRef<string>("");

  // Expose iframe ref for canvas edit overlay
  const setIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    (iframeRef as React.MutableRefObject<HTMLIFrameElement | null>).current = el;
    // Store ref globally for CanvasEditOverlay to access
    if (typeof window !== "undefined") {
      (window as any).__bwcIframeRef = el;
    }
  }, []);

  // Determine which HTML to render — suppress updates during canvas editing
  const displayHtml = isCanvasEditing ? lastHtmlRef.current : currentHtml;
  if (!isCanvasEditing) {
    lastHtmlRef.current = currentHtml;
  }

  if (!currentHtml) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f7f7" }}>
        <p className="text-[#414141] text-sm">
          Preview will appear here after generation
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", justifyContent: "center", background: "#e8e6e6", overflow: "auto", padding: "16px" }}>
      <div
        style={{
          width: viewportMode === "mobile" ? "375px" : "100%",
          maxWidth: viewportMode === "desktop" ? "1200px" : "375px",
          height: "100%",
          background: "#ffffff",
          boxShadow: "0 10px 15px -3px rgba(0,0,0,.1)",
          transition: "all 300ms",
        }}
      >
        <iframe
          ref={setIframeRef}
          srcDoc={displayHtml}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Article preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
```

**Key changes:**
- Added `useRef` for iframe element
- Exposed ref globally via `window.__bwcIframeRef` for CanvasEditOverlay
- Added `isCanvasEditing` suppression — when true, iframe keeps showing the last HTML, preventing re-render destruction of contenteditable state

**Verify:** `npm run build` passes. Preview still works normally.

---

#### Step 3.3: Create Canvas Edit Overlay

**File:** `src/components/canvas-edit/CanvasEditOverlay.tsx`

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useArticleStore } from "@/lib/store/article-store";

const DEBOUNCE_MS = 300;

export function CanvasEditOverlay() {
  const { applyCanvasEdit, pushUndo, setIsCanvasEditing } = useArticleStore();
  const editingMode = useArticleStore((s) => s.editingMode);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEditPathRef = useRef<string | null>(null);

  const handleInput = useCallback(
    (e: Event) => {
      const target = e.target as HTMLElement;
      const cadPath = target.getAttribute("data-cad-path");
      if (!cadPath) return;

      // Debounce the sync
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Push undo only on first edit of a new element (not every keystroke)
      if (lastEditPathRef.current !== cadPath) {
        pushUndo("Canvas edit");
        lastEditPathRef.current = cadPath;
      }

      debounceRef.current = setTimeout(() => {
        const newText = target.innerHTML;
        applyCanvasEdit(cadPath, newText);
      }, DEBOUNCE_MS);
    },
    [applyCanvasEdit, pushUndo]
  );

  const handleFocus = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute("data-cad-path")) {
      target.style.outline = "2px solid #3b82f6";
      target.style.outlineOffset = "2px";
    }
  }, []);

  const handleBlur = useCallback(
    (e: Event) => {
      const target = e.target as HTMLElement;
      target.style.outline = "";
      target.style.outlineOffset = "";

      // Flush any pending debounced edit
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        const cadPath = target.getAttribute("data-cad-path");
        if (cadPath) {
          applyCanvasEdit(cadPath, target.innerHTML);
        }
      }
      lastEditPathRef.current = null;
    },
    [applyCanvasEdit]
  );

  useEffect(() => {
    if (editingMode !== "canvas") return;

    setIsCanvasEditing(true);

    // Wait for iframe to be available
    const setupInterval = setInterval(() => {
      const iframe = (window as any).__bwcIframeRef as HTMLIFrameElement | null;
      if (!iframe?.contentDocument) return;
      clearInterval(setupInterval);

      const doc = iframe.contentDocument;

      // Inject contenteditable on all elements with data-cad-path
      const editableElements = doc.querySelectorAll("[data-cad-path]");
      editableElements.forEach((el) => {
        (el as HTMLElement).contentEditable = "true";
        (el as HTMLElement).style.cursor = "text";
      });

      // Add event listeners on the document (captures all editable elements)
      doc.addEventListener("input", handleInput, true);
      doc.addEventListener("focusin", handleFocus, true);
      doc.addEventListener("focusout", handleBlur, true);

      // Add locked overlay styles for non-editable elements
      const style = doc.createElement("style");
      style.textContent = `
        [data-cad-path]:focus {
          outline: 2px solid #3b82f6 !important;
          outline-offset: 2px !important;
        }
        [data-cad-path] {
          cursor: text;
          transition: outline 150ms;
        }
        figure:hover, img:hover {
          outline: 2px dashed #94a3b8;
          outline-offset: 2px;
          cursor: not-allowed;
        }
      `;
      doc.head.appendChild(style);
    }, 100);

    return () => {
      clearInterval(setupInterval);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Clean up: remove contenteditable, event listeners
      const iframe = (window as any).__bwcIframeRef as HTMLIFrameElement | null;
      if (iframe?.contentDocument) {
        const doc = iframe.contentDocument;
        doc.removeEventListener("input", handleInput, true);
        doc.removeEventListener("focusin", handleFocus, true);
        doc.removeEventListener("focusout", handleBlur, true);

        const editableElements = doc.querySelectorAll("[data-cad-path]");
        editableElements.forEach((el) => {
          (el as HTMLElement).contentEditable = "false";
          (el as HTMLElement).style.cursor = "";
        });
      }

      setIsCanvasEditing(false);
    };
  }, [editingMode, handleInput, handleFocus, handleBlur, setIsCanvasEditing]);

  // This component is invisible — it just manages the iframe's editing state
  if (editingMode !== "canvas") return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        padding: "8px 12px",
        background: "rgba(59, 130, 246, 0.9)",
        color: "#ffffff",
        fontSize: "11px",
        fontWeight: 500,
        borderRadius: "0 0 0 6px",
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      Canvas Edit Mode — click any text to edit
    </div>
  );
}
```

**File:** `src/components/canvas-edit/LockedElementOverlay.tsx`

```typescript
"use client";

// Locked element visual feedback is handled via CSS injection in CanvasEditOverlay.
// This file is reserved for a future richer locked-element UI (tooltip, lock icon, etc.).
export function LockedElementOverlay() {
  return null;
}
```

**File:** `src/components/canvas-edit/index.ts`

```typescript
export { CanvasEditOverlay } from "./CanvasEditOverlay";
export { LockedElementOverlay } from "./LockedElementOverlay";
```

**Verify:** `npm run build` passes.

---

#### Step 3.4: Create HTML Editor (CodeMirror)

**File:** `src/components/html-editor/HtmlEditorInner.tsx`

```typescript
"use client";

import { useRef, useEffect, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { EditorView, lineNumbers, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { html } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { useArticleStore, selectEffectiveHtml } from "@/lib/store/article-store";

export function HtmlEditorInner() {
  const currentHtml = useArticleStore(selectEffectiveHtml);
  const { applyHtmlOverride, pushUndo } = useArticleStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPushedUndoRef = useRef(false);

  const handleCopy = useCallback(async () => {
    const content = viewRef.current?.state.doc.toString() || currentHtml;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentHtml]);

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        // Push undo once per editing session (not per keystroke)
        if (!hasPushedUndoRef.current) {
          pushUndo("HTML edit");
          hasPushedUndoRef.current = true;
        }

        // Debounce the override application
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const newHtml = update.state.doc.toString();
          applyHtmlOverride({
            path: "__full_html",
            html: newHtml,
            reason: "HTML mode edit",
          });
        }, 500);
      }
    });

    const state = EditorState.create({
      doc: currentHtml,
      extensions: [
        lineNumbers(),
        html(),
        oneDark,
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      view.destroy();
      hasPushedUndoRef.current = false;
    };
  }, []); // Only create editor once

  // Update editor content when currentHtml changes externally (e.g., after generation)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentContent = view.state.doc.toString();
    if (currentContent !== currentHtml) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: currentHtml,
        },
      });
      hasPushedUndoRef.current = false;
    }
  }, [currentHtml]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 12px",
        background: "#242323",
        borderBottom: "1px solid #414141",
      }}>
        <span style={{ fontSize: "11px", color: "#94a3b8" }}>HTML Source Editor</span>
        <button
          onClick={handleCopy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#e8e6e6",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          title="Copy HTML"
        >
          {copied ? (
            <><Check style={{ width: "14px", height: "14px" }} /> Copied</>
          ) : (
            <><Copy style={{ width: "14px", height: "14px" }} /> Copy HTML</>
          )}
        </button>
      </div>
      <div ref={editorRef} style={{ flex: 1, overflow: "auto" }} />
    </div>
  );
}
```

**File:** `src/components/html-editor/HtmlEditor.tsx`

```typescript
"use client";

import dynamic from "next/dynamic";

const HtmlEditorInner = dynamic(
  () => import("./HtmlEditorInner").then((m) => ({ default: m.HtmlEditorInner })),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: "100%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#94a3b8", fontSize: "13px" }}>Loading editor...</span>
      </div>
    ),
  }
);

export function HtmlEditor() {
  return <HtmlEditorInner />;
}
```

**File:** `src/components/html-editor/index.ts`

```typescript
export { HtmlEditor } from "./HtmlEditor";
```

**Verify:** `npm run build` passes. CodeMirror loads without SSR errors.

---

#### Step 3.5: Update PreviewPanel — Route to New Components

**File:** `src/components/preview/PreviewPanel.tsx`

Replace the entire file:

```typescript
"use client";

import { useArticleStore } from "@/lib/store/article-store";
import { PreviewToolbar } from "./PreviewToolbar";
import { PreviewIframe } from "./PreviewIframe";
import { HtmlSourceView } from "./HtmlSourceView";
import { CanvasEditOverlay } from "@/components/canvas-edit";
import { HtmlEditor } from "@/components/html-editor";

export function PreviewPanel() {
  const { previewMode, editingMode } = useArticleStore();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PreviewToolbar />
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
      </div>
    </div>
  );
}
```

**Verify:** `npm run build` passes. All three modes render correctly.

---

### Phase 4: Keyboard Shortcuts + Final Polish

#### Step 4.1: Add Global Keyboard Shortcuts for Undo/Redo

Add to the `CanvasEditOverlay` cleanup effect, or create a small hook in the PreviewPanel. The simplest approach is to add keyboard event handling in the PreviewToolbar or at the dashboard page level.

Add a `useEffect` inside `PreviewToolbar` for global keyboard shortcuts:

```typescript
  // Global keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);
```

Add `useEffect` to the imports from `"react"`.

**Verify:** `npm run build` passes. Ctrl+Z undoes, Ctrl+Y redoes.

---

## I. Gate Checks

### Automated Checks

| Check | Command | Expected |
|---|---|---|
| Build passes | `npm run build` | 0 errors, all routes compile |
| TypeScript clean | `npx tsc --noEmit` | 0 errors |
| data-cad-path coverage | Render a sample article, count `data-cad-path` attributes in output | 20+ attributes (vs. ~10 before) |

### Manual Gate Check (Human)

**From orchestration doc §7:**
> Click into preview, edit text. Switch to HTML mode, edit source. Undo across modes. Verify all edits persist in the canonical doc.

Test procedure:

1. **Generate an article** via Chat mode
2. **Switch to Canvas mode** — click the "Canvas" toggle
3. **Click a heading** in the preview — cursor should appear, blue outline visible
4. **Type some text** — edit the heading directly
5. **Click a paragraph** — edit it in place
6. **Verify no iframe flicker** — the iframe should NOT reload while typing (isCanvasEditing suppresses re-render)
7. **Switch back to Chat mode** — the preview should re-render with the canvas edits applied
8. **Click Undo** — the heading should revert to its original text
9. **Click Redo** — the canvas edit should reappear
10. **Switch to HTML mode** — CodeMirror editor should show the rendered HTML with syntax highlighting
11. **Edit something in the HTML** — change a word
12. **Switch back to Preview** — the HTML edit should be visible
13. **Click Undo twice** — should step back through both the HTML edit and the canvas edit
14. **Verify version history** still works — navigate to a previous version and back

### Success Criteria

- [ ] Canvas edit works on: headings, paragraphs, list items, table cells, table headers, key facts labels/values, captions, pull quotes, callouts, FAQ questions/answers, author bio fields
- [ ] Canvas edit does NOT work on (locked): images, figure containers, schema blocks, structural elements
- [ ] HTML mode shows syntax-highlighted code with line numbers
- [ ] HTML edits persist as overrides
- [ ] Undo/Redo traverses all edit types (Chat, Canvas, HTML)
- [ ] No iframe flicker during canvas editing
- [ ] Build passes with 0 errors
- [ ] All existing functionality (Chat mode, generation, version history) still works

---

## J. Deviations from Orchestration Doc

| Deviation | Rationale |
|---|---|
| `EditingMode` type already exists | Guide 6 pre-created it. No new type definition needed. |
| HtmlSourceView replacement, not creation | Guide 6 built a read-only `<pre>` view. We replace it with CodeMirror. |
| HTML edits go to overrides only (no reverse mapping) | Reverse-mapping HTML to canonical doc is complex. Deferred to future iteration. |
| iframe ref via `window.__bwcIframeRef` | Simpler than forwardRef across component boundaries. Works because PreviewIframe and CanvasEditOverlay always share the same browser window. |
| No `allow-scripts` on sandbox | Not needed. Direct DOM access via `contentDocument` works with `allow-same-origin` alone. Scripts are correctly blocked in the iframe. |
