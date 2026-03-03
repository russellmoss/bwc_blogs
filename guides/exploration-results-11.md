# Exploration Results — Guide 11: Finalization Flow + Version History

**Date:** 2026-03-02
**Previous Guide Completed:** Guide 10 (Content Map Dashboard + Blog Registry)
**Target:** Guide 11 — Finalization, Publishing Flow & Link Backfilling
**Focus:** Draft-to-Final transition, atomic Drive→CDN URL swap, dual DB commit

---

## 1. Current Build State

### Guides Complete (1–10)

| Guide | Title | Status |
|---|---|---|
| 1 | Foundation (DB, Auth, Scaffold) | ✅ Complete |
| 2 | Content Map (CSV Import, CRUD, Seed) | ✅ Complete |
| 3 | Onyx RAG Integration | ✅ Complete |
| 4 | Canonical Article Schema + Renderer | ✅ Complete |
| 5 | Orchestration Layer + Claude API | ✅ Complete |
| 6 | Split-Pane UI + Chat Mode | ✅ Complete |
| 7 | Canvas Edit + HTML Mode + Undo/Redo | ✅ Complete |
| 8 | QA Scorecard + Targeted Fixes | ✅ Complete (8 + 8B) |
| 9 | Photo Pipeline (Drive→Cloudinary) | ✅ Complete |
| 10 | Content Map Dashboard + Blog Registry | ✅ Complete |

### Summary Inventory

| Category | Count |
|---|---|
| Prisma models | 9 (User, ContentMap, ArticleDocument, ArticleHtml, InternalLink, Photo, ArticlePhoto, Lead, LeadEvent) |
| API routes | 22 route files |
| TypeScript type files | 10 files in `src/types/` |
| Components | 18+ (chat, preview, canvas-edit, html-editor, scorecard, photo-manager, dashboard, layout) |
| Lib modules | 13 directories in `src/lib/` |
| Dashboard pages | 4 (`/dashboard`, `/dashboard/photos`, `/dashboard/content-map`, `/dashboard/settings`) |

### Data State

| Table | Rows |
|---|---|
| users | 2 |
| content_map | 39 (8 hubs + 31 spokes) |
| article_documents | 0 |
| article_html | 0 |
| internal_links | 10 (core page seeds) |
| photos | 7 |
| article_photos | 0 |
| leads | 0 |

### Integration Health

| Service | Status |
|---|---|
| Neon Postgres | ✅ Connected, all tables accessible |
| Onyx CE | ✅ Health OK (admin API has auth issue — pre-existing) |
| Claude API | ✅ Working, `claude-sonnet-4-5-20250929` |
| Cloudinary | ✅ Credentials valid, 64 resources, CDN delivery works |
| Vercel | ✅ Deployed, health endpoint returns 200 |
| TypeScript | ✅ `tsc --noEmit` passes with zero errors |
| Build | ✅ `npm run build` completes cleanly |

---

## 2. Next Guide Target

### Guide 11: Finalization Flow + Version History

**From Orchestration Doc §7:**

> The "Finalize Article" button flow — QA gate, Cloudinary upload trigger, dual commit (canonical doc + rendered HTML), version management, Copy/Download buttons, Mark as Published, and the re-edit flow.

**Key Decisions (from §7):**
- Finalization blocked if any FAIL-level QA checks unresolved (unless admin override)
- On finalize: upload new photos to Cloudinary → re-render with CDN URLs → commit both `article_documents` and `article_html` rows → update `content_map` status
- Version numbering: auto-increment on re-finalization
- Re-edit: loads most recent canonical doc into editor state, preserves HTML overrides
- Mark as Published: updates status, activates internal links, generates backfill report

**Guide 11 Owns (from §5E):**
- `src/app/api/articles/[id]/` — all routes under this path
- `src/app/api/capture/` — lead capture endpoint
- `src/lib/finalization/` — finalization logic module

**Routes to Create (from §5C):**

| Route | Method | Purpose |
|---|---|---|
| `/api/articles/[id]` | GET, PATCH | Article detail + partial update |
| `/api/articles/[id]/finalize` | POST | Full finalization flow |
| `/api/articles/[id]/publish` | POST | Mark as published |
| `/api/articles/[id]/html` | GET | Retrieve rendered HTML |
| `/api/articles/[id]/versions` | GET | Version history list |
| `/api/capture` | POST | Lead capture from Wix (phase 3+, stub only) |

**Architecture Doc Sections to Reference:**
- §3F: Automated Image Pipeline (Cloudinary upload on finalization) — lines 1340–1424
- §4 Step 8: Finalize and Commit — lines 2566–2587
- §4 Step 9: Publication Detection — lines 2588–2601
- §3L: QA Scorecard — lines 2220–2414 (finalization gate logic)
- §3D: Content Map Dashboard / Article Detail Panel — lines 880–935

---

## 3. Dependencies Satisfied

### 3A. QA Gate — ✅ READY

**File:** `src/app/api/articles/qa/route.ts`

The QA route **already supports `?gate=true`** parameter:

```typescript
// Lines 51-66
const url = new URL(request.url);
const gateMode = url.searchParams.get("gate") === "true";

if (gateMode && !qaScore.canFinalize) {
  return NextResponse.json({
    success: false,
    error: {
      code: "QA_GATE_FAILED",
      message: `Article has ${qaScore.failCount} FAIL-level issue(s) that block finalization`,
      details: qaScore,
    },
  }, { status: 422 });
}
```

**Key interface:** `QAScore` has `canFinalize: boolean`, `failCount: number`, `warnCount: number`, `total: number`, `possible: number`.

**NOTE:** The QA route is missing `requireRole()` auth check (line 9 jumps straight to `try`). This is a pre-existing bug — Guide 11 should note this but not fix it (Guide 8's scope).

### 3B. Cloudinary Upload Pipeline — ✅ READY

The full Drive→Cloudinary→DB chain exists:

| Module | File | Function | Status |
|---|---|---|---|
| Drive download | `src/lib/cloudinary/drive-downloader.ts` | `downloadFromDrive(driveFileId): Buffer` | ✅ Working |
| Cloudinary upload | `src/lib/cloudinary/upload.ts` | `uploadToCloudinary(buffer, opts): CloudinaryUploadResult` | ✅ Working |
| CDN URL builder | `src/lib/renderer/cloudinary.ts` | `buildCloudinaryUrl(publicId, transforms): string` | ✅ Working |
| Upload route | `src/app/api/photos/upload/route.ts` | POST with `{ photoId }` | ✅ Working |
| Barrel export | `src/lib/cloudinary/index.ts` | Re-exports all | ✅ |

**Upload Route Flow** (existing pattern at `/api/photos/upload`):
1. Find photo by ID → check `uploadedToCdn` (skip if already done)
2. Download from Drive using `driveFileId`
3. Build publicId: `blog/{category}/{filename-without-extension}`
4. Upload to Cloudinary → get `publicId`, `secureUrl`, `width`, `height`
5. Update `photos` table: set `cloudinaryPublicId`, `cloudinaryUrl`, `widthPx`, `heightPx`, `uploadedToCdn=true`

**Critical: The renderer already handles the CDN URL swap.** In `src/lib/renderer/components.ts` lines 34-39:

```typescript
const src = placement.cloudinaryPublicId
  ? buildCloudinaryUrl(placement.cloudinaryPublicId, { width: placement.width || 1200 })
  : placement.src;
```

This means the finalization flow needs to:
1. Upload all article photos to Cloudinary (using existing upload pipeline)
2. Update `ImagePlacement` nodes in the canonical doc with `cloudinaryPublicId`
3. Re-render — the renderer will automatically use CDN URLs

### 3C. Article Storage Tables — ✅ SCHEMA READY, EMPTY

**`ArticleDocument` model** (`prisma/schema.prisma` lines 76-90):
- `id` (autoincrement), `articleId` (FK→content_map), `version` (default 1)
- `canonicalDoc` (Json — stores full CanonicalArticleDocument)
- `htmlOverrides` (Json? — stores HTML override patches)
- `finalizedAt`, `finalizedBy`, `notes`
- Unique constraint: `(articleId, version)`

**`ArticleHtml` model** (`prisma/schema.prisma` lines 92-111):
- `id` (autoincrement), `articleId` (FK→content_map), `version` (default 1)
- `documentVersion` (references which ArticleDocument version it was rendered from)
- `htmlContent` (Text — the complete rendered HTML)
- `metaTitle`, `metaDescription`, `schemaJson`
- `finalizedAt`, `finalizedBy`
- `qaScore` (string, e.g. "48/52"), `qaFailures` (int, must be 0 to finalize)
- `notes`
- Unique constraint: `(articleId, version)`

### 3D. Internal Links — ✅ SCHEMA READY

**`InternalLink` model** (`prisma/schema.prisma` lines 117-131):
- `sourceArticleId`, `targetArticleId` (both FK→content_map, nullable)
- `targetCorePage` (for core BWC pages)
- `anchorText`, `linkType` (hub-to-spoke, spoke-to-hub, spoke-to-sibling, cross-cluster, to-core-page)
- `isActive` (default false — set to true when both articles are published)
- 10 rows currently (core page seeds)

**Backfill logic requires:** When article X is published, find all other published articles whose `targetKeywords` or `mainEntity` overlap with X's topics, and suggest new `InternalLink` rows with recommended anchor text and section placement.

### 3E. Content Map PATCH — ✅ READY

**File:** `src/app/api/content-map/[id]/route.ts`

The PATCH handler accepts ALL fields needed for finalization and publishing:
- `status` (enum: planned, drafting, finalized, published, needs_update) ✅
- `publishedDate` (datetime, nullable) ✅
- `publishedUrl` (URL, nullable) ✅
- `wordCount` (int, nullable) ✅
- `qaScore` (string, nullable) ✅

**Gap:** The PATCH is a simple single-table update — no transaction. Guide 11's finalization flow should use `prisma.$transaction()` to atomically write:
1. `article_documents` row
2. `article_html` row
3. `content_map` status update

### 3F. Renderer — ✅ READY

**File:** `src/lib/renderer/index.ts` (exports `renderArticle()`)

The renderer accepts `RendererInput` and returns `RendererOutput`:
```typescript
interface RendererInput {
  document: CanonicalArticleDocument;
  htmlOverrides: HtmlOverride[] | null;
  templateVersion: string;
}

interface RendererOutput {
  html: string;
  metaTitle: string;
  metaDescription: string;
  schemaJson: string;
  wordCount: number;
}
```

This is exactly what Guide 11 needs — call `renderArticle()` one final time after CDN URL promotion, then store all fields from `RendererOutput` into the `ArticleHtml` row.

### 3G. Zustand Store — ✅ READY (needs extension)

**File:** `src/lib/store/article-store.ts`

Current state shape has 22 fields including:
- `currentDocument: CanonicalArticleDocument | null`
- `currentHtml: string`
- `versionHistory: ArticleVersion[]` (in-memory only)
- `qaScore: QAScore | null`
- `htmlOverrides: HtmlOverride[]`

**Missing for Guide 11:**
- `isFinalizing: boolean` — loading state for finalization flow
- `isPublishing: boolean` — loading state for mark-as-published
- `finalizationError: string | null`
- `finalizeArticle: () => Promise<void>` — calls `/api/articles/[id]/finalize`
- `publishArticle: (url: string) => Promise<void>` — calls `/api/articles/[id]/publish`
- `loadFinalizedArticle: (articleId: number) => Promise<void>` — loads from DB for re-edit

### 3H. Preview Components — ✅ READY (needs new modal)

Existing components:
- `PreviewPanel.tsx` — orchestrates preview pane
- `PreviewToolbar.tsx` — mode/viewport controls
- `PreviewIframe.tsx` — sandboxed iframe rendering
- `VersionNavigator.tsx` — version history strip (in-memory versions)
- `HtmlSourceView.tsx` — syntax-highlighted HTML view

**Missing for Guide 11:**
- `FinalizeModal.tsx` — triggered by "Finalize Article" button, shows progress steps
- `ExportPanel.tsx` — Copy HTML, Copy Meta Title, Copy Meta Description, Download .html
- `PublishModal.tsx` — "Mark as Published" form (enter URL, confirm)

---

## 4. Dependencies Missing or Mismatched

### 4A. Files That MUST Be Created

**New API Routes:**
1. `src/app/api/articles/[id]/route.ts` — GET (article detail with versions), PATCH (update)
2. `src/app/api/articles/[id]/finalize/route.ts` — POST (full finalization pipeline)
3. `src/app/api/articles/[id]/publish/route.ts` — POST (mark as published + backfill report)
4. `src/app/api/articles/[id]/html/route.ts` — GET (retrieve stored HTML by version)
5. `src/app/api/articles/[id]/versions/route.ts` — GET (list all versions with metadata)
6. `src/app/api/capture/route.ts` — POST (lead capture stub, full impl deferred)

**New Lib Module:**
7. `src/lib/finalization/index.ts` — Core finalization logic:
   - `promotePendingPhotos(articleId, document)` — upload un-CDN'd photos, return updated doc
   - `commitFinalization(articleId, document, html, rendererOutput, user)` — atomic DB writes
   - `generateBackfillReport(articleId)` — find articles that should link to the new post
   - `activateLinks(articleId)` — set `isActive=true` on all InternalLink rows involving this article

**New Components:**
8. `src/components/finalization/FinalizeModal.tsx` — step-by-step progress modal
9. `src/components/finalization/ExportPanel.tsx` — Copy/Download buttons
10. `src/components/finalization/PublishModal.tsx` — Mark as Published form
11. `src/components/finalization/BackfillReport.tsx` — show suggested link insertions

### 4B. Types That MUST Be Added

Add to `src/types/article.ts` or a new `src/types/finalization.ts`:

```typescript
// Finalization request/response
interface FinalizeArticleRequest {
  articleId: number;
  document: CanonicalArticleDocument;
  html: string;
  htmlOverrides: HtmlOverride[] | null;
  notes?: string;
}

interface FinalizeArticleResponse {
  documentVersion: number;
  htmlVersion: number;
  qaScore: QAScore;
  cdnPhotosUploaded: number;
  finalHtml: string;
}

// Publish request/response
interface PublishArticleRequest {
  publishedUrl: string;
}

interface PublishArticleResponse {
  status: "published";
  publishedDate: string;
  activatedLinks: number;
  backfillReport: BackfillSuggestion[];
}

// Backfill link report
interface BackfillSuggestion {
  existingArticleId: number;
  existingArticleTitle: string;
  existingArticleUrl: string | null;
  suggestedAnchorText: string;
  suggestedSectionId: string;
  reason: string; // e.g. "Shares keyword: high-altitude viticulture"
}

// Version history (DB-backed)
interface StoredArticleVersion {
  version: number;
  documentVersion: number;
  finalizedAt: string;
  finalizedBy: string | null;
  qaScore: string | null;
  qaFailures: number;
  notes: string | null;
}
```

### 4C. Types That Need Extension

**`ArticleEditorState`** (in `src/types/ui.ts`):
- Add `isFinalizing: boolean`
- Add `isPublishing: boolean`
- Add `finalizationError: string | null`

**`ArticleEditorActions`** (in `src/types/ui.ts`):
- Add `finalizeArticle: () => Promise<void>`
- Add `publishArticle: (url: string) => Promise<void>`
- Add `loadFinalizedArticle: (articleId: number) => Promise<void>`

**`ErrorCode`** (in `src/types/api.ts`):
- Already includes `QA_GATE_FAILED` and `CLOUDINARY_ERROR` ✅
- May need `FINALIZATION_FAILED` for transactional failures

### 4D. Files That MUST Be Modified

1. **`src/types/ui.ts`** — Add finalization state/actions (see 4C above)
2. **`src/types/index.ts`** — Re-export new types
3. **`src/lib/store/article-store.ts`** — Add finalization actions and state
4. **`src/components/preview/PreviewToolbar.tsx`** — Add "Finalize Article" button
5. **`src/components/chat/ChatPanel.tsx`** — Add finalization status display
6. **`src/components/layout/AppShell.tsx`** — May need article status indicator

---

## 5. Established Patterns to Follow

### 5A. API Route Handler Template

From `src/app/api/content-map/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const MySchema = z.object({ /* fields */ });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor");
    const { id } = await params;
    const body = await request.json();
    const parsed = MySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    // ... business logic ...

    return NextResponse.json({ success: true, data: result });
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

### 5B. Prisma Select Pattern

Always use `select:` to whitelist fields. From `src/app/api/content-map/[id]/route.ts`:

```typescript
const contentMapSelect = {
  id: true, hubName: true, articleType: true, title: true, slug: true,
  /* ... all fields ... */
};

const entry = await prisma.contentMap.findUnique({
  where: { id: parseInt(id, 10) },
  select: contentMapSelect,
});
```

### 5C. Cloudinary Upload Pattern

From `src/app/api/photos/upload/route.ts`:

```typescript
// 1. Fetch photo from DB
const photo = await prisma.photo.findUnique({ where: { id: photoId } });
if (photo.uploadedToCdn) return photo; // skip if already on CDN

// 2. Download from Drive
const buffer = await downloadFromDrive(photo.driveFileId);

// 3. Build public ID
const publicId = `blog/${category}/${baseName}`;

// 4. Upload
const result = await uploadToCloudinary(buffer, { publicId });

// 5. Update DB
await prisma.photo.update({
  where: { id: photoId },
  data: {
    cloudinaryPublicId: result.publicId,
    cloudinaryUrl: result.secureUrl,
    widthPx: result.width,
    heightPx: result.height,
    uploadedToCdn: true,
  },
});
```

### 5D. Zustand Action Pattern

From `src/lib/store/article-store.ts`:

```typescript
// Sync action
setDocument: (doc: CanonicalArticleDocument) => set({ currentDocument: doc }),

// Async action with loading state
applyQaFix: async (checkIds: string[]) => {
  set({ isApplyingFix: true, statusMessage: "Applying QA fixes..." });
  try {
    const response = await fetch("/api/articles/qa/fix", { /* ... */ });
    const result = await response.json();
    // Re-read fresh state after async gap
    const freshState = get();
    set({ /* update state */ isApplyingFix: false, statusMessage: "" });
  } catch (error) {
    set({ isApplyingFix: false, statusMessage: `Failed: ${error.message}` });
  }
},
```

### 5E. Component Pattern (Dashboard)

- Styling: **inline style objects** (not Tailwind utility classes)
- Data fetching: `useEffect` + `fetch()` on mount
- Icons: `lucide-react`
- Auth: `useSession()` from `next-auth/react`
- Global state: Zustand store
- Brand gold: `#bc9b5d`
- Response format: `{ success: true, data }` / `{ success: false, error: { code, message } }`

### 5F. Dynamic Route Params (Next.js 15)

```typescript
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // Must await params in Next.js 15
  const numericId = parseInt(id, 10);
}
```

---

## 6. Integration Readiness

| Service | Guide 11 Uses It For | Status |
|---|---|---|
| **Neon Postgres** | Write article_documents + article_html, update content_map | ✅ Verified |
| **Cloudinary** | Upload photos on finalization, CDN URL construction | ✅ Verified (credentials work, 64 existing resources) |
| **QA Engine** | Finalization gate — block if FAIL-level checks | ✅ `?gate=true` parameter works |
| **Article Renderer** | Final render with CDN URLs | ✅ `renderArticle()` ready |
| **Prisma** | Transaction support for atomic writes | ✅ `prisma.$transaction()` available |

### Known Quirks

1. **Cloudinary upload is slow** — Google Drive download + Cloudinary upload can take 2–5s per image. Articles with 5+ images need progress feedback.
2. **QA route lacks auth** — Pre-existing bug in Guide 8. The finalization endpoint should run QA checks server-side directly (import `runQAChecks` + `CheerioDomAdapter`), not call the QA API route.
3. **No Prisma transaction examples in codebase** — Guide 11 will be the first to use `prisma.$transaction()`.
4. **Drive download requires public sharing** — `downloadFromDrive()` uses direct URL download. If photos aren't shared with "Anyone with the link," download will fail.

---

## 7. Risks and Blockers

### RISK-1: Prisma Transaction Complexity (MEDIUM)
**Issue:** No existing code uses `prisma.$transaction()`. Guide 11 introduces the first transactional write pattern.
**Mitigation:** Use Prisma's interactive transaction API:
```typescript
await prisma.$transaction(async (tx) => {
  const docRow = await tx.articleDocument.create({ data: { ... } });
  const htmlRow = await tx.articleHtml.create({ data: { ... } });
  await tx.contentMap.update({ where: { id: articleId }, data: { status: "finalized", ... } });
});
```

### RISK-2: CDN Upload Timeout on Large Articles (MEDIUM)
**Issue:** Finalizing an article with many un-uploaded photos could hit Vercel's serverless function timeout (default 60s on Hobby, 300s on Pro).
**Mitigation:** Upload photos sequentially with progress reporting. Consider uploading photos lazily in the Photo Manager (Guide 9 already has the route) and only verifying they're on CDN during finalization.

### RISK-3: Backfill Report Algorithm Complexity (LOW)
**Issue:** The backfill link report needs to find articles that should now link to the newly published post. This requires keyword/entity matching across all published articles.
**Mitigation:** Start simple — match on `mainEntity` and `targetKeywords` overlap. Don't try semantic matching in v1.

### RISK-4: Re-edit Flow State Restoration (MEDIUM)
**Issue:** When a user clicks "Edit in Chat" on a finalized article, the system must load the stored `CanonicalArticleDocument` from DB, re-render HTML, and restore the editor state — including HTML overrides.
**Mitigation:** The `ArticleDocument` table stores `canonicalDoc` (JSON) and `htmlOverrides` (JSON). Load these into the Zustand store via `setDocument()` + apply overrides.

### No Blockers
All required services are operational. No environment variables are missing. The schema is complete. The codebase compiles cleanly.

---

## 8. Deviations from Plan

### 8A. QA Route Missing Auth (Pre-existing)
The orchestration doc assumes all routes have auth. `src/app/api/articles/qa/route.ts` has no `requireRole()` call. Guide 11's finalization endpoint should call QA logic directly (server-side import) rather than hitting the API route, which sidesteps this issue.

### 8B. Onyx Admin API Auth Issue (Pre-existing)
Onyx admin endpoints return 403 with API key auth. This doesn't affect Guide 11 directly, but the "re-verify external links" step during finalization that the architecture doc describes may need adjustment if Onyx search is unreliable.

### 8C. Photo Upload Already Has a Route
The orchestration doc describes the upload as part of finalization, but Guide 9 already created `/api/photos/upload` as a standalone route. Guide 11 should reuse this logic (import from `src/lib/cloudinary/`) rather than re-implement.

### 8D. Version History is In-Memory Only
The current `ArticleVersion` type and `versionHistory` array in the Zustand store are **session-scoped** (in-memory). Guide 11 needs to bridge this to the DB-backed `article_documents` and `article_html` tables. The `VersionNavigator` component will need to fetch from DB, not just read store state.

### 8E. Content Map PATCH is Not Transactional
The orchestration doc implies the finalization flow updates the content_map atomically with the article writes. The existing PATCH route is a standalone handler. Guide 11's `/api/articles/[id]/finalize` endpoint should handle all writes in a single Prisma transaction, not call the PATCH route separately.

---

## 9. Finalization Flow — Detailed Sequence

Based on architecture doc §4 Step 8 and the current codebase state, here is the exact flow:

```
User clicks "Finalize Article"
  │
  ├─ 1. GATE CHECK: Call runQAChecks(document, html, dom)
  │     └─ If canFinalize === false → BLOCK, show QA scorecard
  │
  ├─ 2. PHOTO PROMOTION: For each ImagePlacement in document:
  │     ├─ Look up Photo by photoId
  │     ├─ If uploadedToCdn === false:
  │     │   ├─ downloadFromDrive(driveFileId) → Buffer
  │     │   ├─ uploadToCloudinary(buffer, { publicId }) → result
  │     │   └─ Update photos table (cloudinaryPublicId, cloudinaryUrl, etc.)
  │     └─ Update ImagePlacement node: set cloudinaryPublicId from photos table
  │
  ├─ 3. FINAL RENDER: renderArticle({ document, htmlOverrides, templateVersion })
  │     └─ Renderer uses cloudinaryPublicId → buildCloudinaryUrl() → CDN URLs in HTML
  │
  ├─ 4. ATOMIC COMMIT (prisma.$transaction):
  │     ├─ a. Get next version number: MAX(version) + 1 for this articleId
  │     ├─ b. Write article_documents row (canonicalDoc, htmlOverrides, version, user)
  │     ├─ c. Write article_html row (htmlContent, metaTitle, metaDescription, schemaJson, qaScore, qaFailures, documentVersion)
  │     └─ d. Update content_map: status → "finalized", wordCount, qaScore, updatedAt
  │
  └─ 5. RESPOND: Return finalHtml, version numbers, QA score
         └─ UI shows ExportPanel: [Copy HTML] [Copy Meta Title] [Download .html]
```

```
User clicks "Mark as Published"
  │
  ├─ 1. Accept publishedUrl from user
  │
  ├─ 2. UPDATE content_map: status → "published", publishedDate, publishedUrl
  │
  ├─ 3. ACTIVATE LINKS: UPDATE internal_links SET is_active = true
  │     WHERE sourceArticleId = articleId OR targetArticleId = articleId
  │     AND both articles have status = "published"
  │
  └─ 4. BACKFILL REPORT: Query all other published articles
        ├─ Match on overlapping mainEntity / targetKeywords
        └─ Return BackfillSuggestion[] with anchor text and section recommendations
```

---

## 10. Key File Paths Reference

### Files to CREATE
```
src/app/api/articles/[id]/route.ts
src/app/api/articles/[id]/finalize/route.ts
src/app/api/articles/[id]/publish/route.ts
src/app/api/articles/[id]/html/route.ts
src/app/api/articles/[id]/versions/route.ts
src/app/api/capture/route.ts
src/lib/finalization/index.ts
src/components/finalization/FinalizeModal.tsx
src/components/finalization/ExportPanel.tsx
src/components/finalization/PublishModal.tsx
src/components/finalization/BackfillReport.tsx
```

### Files to MODIFY
```
src/types/ui.ts                              — Add finalization state/actions
src/types/api.ts                             — Add FINALIZATION_FAILED error code (if needed)
src/types/index.ts                           — Re-export new types
src/lib/store/article-store.ts               — Add finalize/publish actions
src/components/preview/PreviewToolbar.tsx     — Add "Finalize Article" button
```

### Files to REFERENCE (read-only)
```
src/app/api/articles/qa/route.ts             — QA gate pattern
src/app/api/photos/upload/route.ts           — Drive→Cloudinary pattern
src/app/api/content-map/[id]/route.ts        — PATCH handler pattern
src/lib/cloudinary/upload.ts                 — uploadToCloudinary()
src/lib/cloudinary/drive-downloader.ts       — downloadFromDrive()
src/lib/renderer/index.ts                    — renderArticle()
src/lib/renderer/cloudinary.ts               — buildCloudinaryUrl()
src/lib/renderer/components.ts               — renderImage() with CDN URL logic
src/lib/qa/index.ts                          — runQAChecks(), CheerioDomAdapter
src/lib/store/article-store.ts               — Zustand patterns
prisma/schema.prisma                         — ArticleDocument, ArticleHtml models
```

---

*Generated by next-guide exploration for Guide 11 on 2026-03-02.*
