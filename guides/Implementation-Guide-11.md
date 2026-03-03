# Implementation Guide 11: Finalization, Publishing Flow & Link Backfilling

**Guide Version:** 1.0
**Date:** 2026-03-02
**Depends On:** Guides 1-10 (ALL complete)
**Exploration Report:** `guides/exploration-results-11.md`

---

## A. Objective

Build the final "Launch Pad" for the BWC Content Engine. This guide implements:

1. **Finalization Pipeline** — Atomic transaction that promotes photos to Cloudinary CDN, re-renders with CDN URLs, and commits both the canonical document and rendered HTML to permanent storage.
2. **QA Gate Enforcement** — Server-side QA check that blocks finalization if any FAIL-level issues exist.
3. **Version History** — DB-backed version storage with a GET endpoint to load stored versions.
4. **Wix Export UI** — Copy for Wix buttons (title, meta description, production HTML) and Download .html.
5. **Publishing & Backfill** — Mark articles as published, activate internal links, and generate a Backfill Link Report identifying which existing articles should now link to the new one.
6. **Store Integration** — New `finalizeArticle`, `publishArticle`, and `loadFinalizedArticle` actions in the Zustand store.

After this guide, you can generate an article, edit it, finalize it to permanent storage, copy the HTML for Wix, and publish it.

---

## B. Scope

### In Scope
- Finalize button flow with QA gate
- Drive → Cloudinary photo promotion during finalization
- Atomic dual-commit (article_documents + article_html + content_map status update)
- Version history API and VersionNavigator DB integration
- ExportPanel component (Copy HTML / Meta Title / Meta Description / Download .html)
- Mark as Published flow with URL input
- Internal link activation on publish
- Backfill Link Report (keyword/entity overlap)
- Lead capture route stub
- Re-edit flow (load finalized article into editor)

### Out of Scope
- Wix Crawler / Site Reconciliation (Guide 12)
- Lead capture form rendering inside articles (Phase 3+)
- External link re-verification during finalization
- Admin override for QA gate (defer to Phase 2 polish)

---

## C. Depends On

| Guide | What This Guide Uses |
|---|---|
| 1 | Prisma schema (ArticleDocument, ArticleHtml, ContentMap, InternalLink, Photo), auth helpers |
| 2 | Content Map CRUD, seed data |
| 4 | Article Renderer (`renderArticle`), Zod validation |
| 5 | Orchestration layer (generation pipeline) |
| 6 | Split-pane UI, PreviewToolbar, Zustand store |
| 7 | HTML overrides, undo/redo |
| 8 | QA engine (`runQAChecks`, `CheerioDomAdapter`, `canFinalize`) |
| 9 | Cloudinary upload pipeline (`uploadToCloudinary`, `downloadFromDrive`) |
| 10 | Content Map Dashboard, link graph |

---

## D. Shared Contracts Referenced

### Database Tables
- `article_documents` — Stores CanonicalArticleDocument JSON per version
- `article_html` — Stores rendered HTML per version
- `content_map` — Status updates (planned → drafting → finalized → published)
- `internal_links` — `isActive` flag toggled on publish
- `photos` — `uploadedToCdn` checked during finalization
- `article_photos` — Photo-article associations

### TypeScript Interfaces
- `CanonicalArticleDocument` (`src/types/article.ts`)
- `RendererInput`, `RendererOutput`, `HtmlOverride` (`src/types/renderer.ts`)
- `QAScore`, `QAResult` (`src/types/qa.ts`)
- `Photo`, `PhotoManifest` (`src/types/photo.ts`)
- `ArticleEditorState`, `ArticleEditorActions`, `ArticleVersion` (`src/types/ui.ts`)
- `ApiResponse<T>`, `ErrorCode` (`src/types/api.ts`)

### API Route Patterns
- Response format: `{ success: true, data }` / `{ success: false, error: { code, message } }`
- Auth: `requireRole("admin", "editor")` throws `AUTH_REQUIRED` / `AUTH_FORBIDDEN`
- Validation: Zod `.safeParse()` with `VALIDATION_ERROR` response
- Dynamic params: `{ params }: { params: Promise<{ id: string }> }` (Next.js 15)

---

## E. Existing Constraints to Preserve

1. **Renderer is a pure function** — `renderArticle()` takes `RendererInput` and returns `RendererOutput`. No DB calls inside. Finalization calls it after photo promotion.
2. **QA checks are deterministic** — `runQAChecks()` operates on `(doc, html, dom)`. No LLM calls. Server-side finalization uses `CheerioDomAdapter`.
3. **Photo upload flow exists** — `downloadFromDrive()` + `uploadToCloudinary()` + DB update. Finalization reuses these, not re-implements.
4. **CDN URL swap is automatic** — The renderer's `renderImage()` already checks `cloudinaryPublicId` and calls `buildCloudinaryUrl()`. After photo promotion, re-rendering produces CDN URLs.
5. **Zustand store pattern** — Async actions use `set({ loading: true })` → `fetch()` → `get()` for fresh state → `set({ result, loading: false })`.
6. **Inline styles, not Tailwind** — All existing components use inline style objects with `lucide-react` icons.

---

## F. Files Created / Modified

### New Files (11)

| File | Purpose |
|---|---|
| `src/lib/finalization/index.ts` | Core finalization logic: photo promotion, atomic commit, backfill report |
| `src/app/api/articles/[id]/route.ts` | GET article detail, PATCH update |
| `src/app/api/articles/[id]/finalize/route.ts` | POST finalization pipeline |
| `src/app/api/articles/[id]/publish/route.ts` | POST mark as published + backfill |
| `src/app/api/articles/[id]/html/route.ts` | GET stored rendered HTML |
| `src/app/api/articles/[id]/versions/route.ts` | GET version history |
| `src/app/api/capture/route.ts` | POST lead capture stub |
| `src/components/finalization/ExportPanel.tsx` | Copy for Wix / Download buttons |
| `src/components/finalization/FinalizeButton.tsx` | Finalize button with progress modal |
| `src/components/finalization/PublishButton.tsx` | Mark as Published button with modal |
| `scripts/test-guide-11.ts` | Integration test script |

### Modified Files (5)

| File | Changes |
|---|---|
| `src/types/ui.ts` | Add finalization state fields and action signatures |
| `src/types/api.ts` | Add `FINALIZATION_FAILED` error code |
| `src/types/index.ts` | Re-export new finalization types |
| `src/lib/store/article-store.ts` | Add `finalizeArticle`, `publishArticle`, `loadFinalizedArticle` actions |
| `src/components/preview/PreviewToolbar.tsx` | Add Finalize and Publish buttons |

---

## G. Technical Design

### G1. Finalization Pipeline (Server-Side)

```
POST /api/articles/[id]/finalize
  Body: { document, html, htmlOverrides, notes? }

Step 1 — QA Gate
  Import runQAChecks + CheerioDomAdapter
  Run server-side QA on the submitted document + html
  If canFinalize === false → return 422 QA_GATE_FAILED with qaScore

Step 2 — Photo Promotion
  Find all ImagePlacement nodes in document (heroImage + sections[].content[].placement)
  For each with photoId !== null and uploadedToCdn === false:
    Download from Drive → Upload to Cloudinary → Update photos table
    Update the ImagePlacement node: set cloudinaryPublicId from result
  Return the modified document with CDN-ready ImagePlacement nodes

Step 3 — Final Render
  Call renderArticle({ document: updatedDoc, htmlOverrides, templateVersion })
  The renderer now produces HTML with CDN URLs

Step 4 — Determine Version
  Query MAX(version) from article_documents WHERE articleId = id
  nextVersion = (maxVersion || 0) + 1

Step 5 — Atomic Commit (prisma.$transaction)
  a. Create article_documents row:
     { articleId, version: nextVersion, canonicalDoc: JSON, htmlOverrides: JSON, finalizedBy: user.email }
  b. Create article_html row:
     { articleId, version: nextVersion, documentVersion: nextVersion,
       htmlContent: rendered.html, metaTitle, metaDescription, schemaJson,
       qaScore: "total/possible", qaFailures: score.failCount }
  c. Update content_map:
     { status: "finalized", wordCount: rendered.wordCount, qaScore: "total/possible" }

Step 6 — Response
  Return { documentVersion, htmlVersion, qaScore, cdnPhotosUploaded, finalHtml }
```

### G2. Publish Flow

```
POST /api/articles/[id]/publish
  Body: { publishedUrl }

Step 1 — Validate article has been finalized (check article_documents has rows)

Step 2 — Update content_map:
  { status: "published", publishedDate: now(), publishedUrl }

Step 3 — Activate Internal Links:
  UPDATE internal_links SET is_active = true
  WHERE (sourceArticleId = id OR targetArticleId = id)
  AND the other article also has status = "published"

Step 4 — Generate Backfill Report:
  Query all OTHER published articles
  For each, check targetKeywords / mainEntity overlap with current article
  Return BackfillSuggestion[] with:
    - existingArticleId, existingArticleTitle, existingArticleUrl
    - suggestedAnchorText (from matching keyword)
    - reason ("Shares keyword: high-altitude viticulture")

Step 5 — Response
  Return { status, publishedDate, activatedLinks, backfillReport }
```

### G3. Version History API

```
GET /api/articles/[id]/versions
  Returns list of stored versions from article_documents + article_html
  Each entry: { version, finalizedAt, finalizedBy, qaScore, qaFailures, notes }

GET /api/articles/[id]/html?version=N
  Returns the stored HTML for a specific version
  If no version param, returns the latest

GET /api/articles/[id]
  Returns the stored canonical doc for the latest version
  Includes content_map metadata
```

### G4. ExportPanel Component

```
ExportPanel (shown after finalization)
  ├── Copy Meta Title    → navigator.clipboard.writeText(metaTitle)
  ├── Copy Meta Desc     → navigator.clipboard.writeText(metaDescription)
  ├── Copy HTML for Wix  → navigator.clipboard.writeText(cleanedHtml)
  │   (cleanedHtml = strip <!DOCTYPE>, <html>, <head>, keep <body> inner content)
  └── Download .html     → create Blob, trigger download as "{slug}.html"
```

### G5. Store Actions

```typescript
// In article-store.ts:

finalizeArticle: async () => {
  // 1. Set isFinalizing=true
  // 2. POST /api/articles/[id]/finalize with current doc, html, overrides
  // 3. On success: update state with final HTML, version, QA score
  // 4. Set isFinalizing=false
}

publishArticle: async (url: string) => {
  // 1. Set isPublishing=true
  // 2. POST /api/articles/[id]/publish with publishedUrl
  // 3. On success: update selectedArticle status
  // 4. Set isPublishing=false
}

loadFinalizedArticle: async (articleId: number) => {
  // 1. GET /api/articles/[id] (loads latest canonical doc)
  // 2. Re-render HTML from loaded doc
  // 3. Set document, html, selectedArticle into store
  // 4. GET /api/articles/[id]/versions (load version history)
}
```

---

## H. Step-by-Step Execution Plan

### Phase 1: Types & Finalization Library

**Step 1.1 — Add finalization types to `src/types/ui.ts`**

Add these fields to `ArticleEditorState`:
```typescript
// Finalization state
isFinalizing: boolean;
isPublishing: boolean;
finalizationError: string | null;
lastFinalizedVersion: number | null;
```

Add these actions to `ArticleEditorActions`:
```typescript
// Finalization actions
finalizeArticle: () => Promise<void>;
publishArticle: (url: string) => Promise<void>;
loadFinalizedArticle: (articleId: number) => Promise<void>;
```

**Step 1.2 — Add FINALIZATION_FAILED to `src/types/api.ts`**

Add `"FINALIZATION_FAILED"` to the `ErrorCode` union.

**Step 1.3 — Create `src/lib/finalization/index.ts`**

This is the core finalization library. It exports three functions:

```typescript
import { prisma } from "@/lib/db";
import { renderArticle } from "@/lib/renderer";
import { TEMPLATE_VERSION } from "@/lib/renderer/compiled-template";
import { runQAChecks, CheerioDomAdapter } from "@/lib/qa";
import { downloadFromDrive } from "@/lib/cloudinary/drive-downloader";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import type { CanonicalArticleDocument, ImagePlacement } from "@/types/article";
import type { HtmlOverride, RendererOutput } from "@/types/renderer";
import type { QAScore } from "@/types/qa";

// ---------- Photo Promotion ----------

interface PhotoPromotionResult {
  updatedDocument: CanonicalArticleDocument;
  photosUploaded: number;
}

export async function promotePendingPhotos(
  document: CanonicalArticleDocument
): Promise<PhotoPromotionResult> {
  let updatedDoc = structuredClone(document);
  let photosUploaded = 0;

  // Collect all ImagePlacement nodes
  const placements: { ref: ImagePlacement; path: string }[] = [];

  if (updatedDoc.heroImage?.photoId) {
    placements.push({ ref: updatedDoc.heroImage, path: "heroImage" });
  }

  for (let si = 0; si < updatedDoc.sections.length; si++) {
    for (let ci = 0; ci < updatedDoc.sections[si].content.length; ci++) {
      const node = updatedDoc.sections[si].content[ci];
      if (node.type === "image" && node.placement.photoId) {
        placements.push({
          ref: node.placement,
          path: `sections[${si}].content[${ci}].placement`,
        });
      }
    }
  }

  // Upload each un-promoted photo
  for (const { ref } of placements) {
    if (!ref.photoId) continue;

    const photo = await prisma.photo.findUnique({
      where: { id: ref.photoId },
    });
    if (!photo) continue;

    if (photo.uploadedToCdn && photo.cloudinaryPublicId) {
      // Already on CDN — just update the document node
      ref.cloudinaryPublicId = photo.cloudinaryPublicId;
      ref.src = photo.cloudinaryUrl || ref.src;
      continue;
    }

    if (!photo.driveFileId) continue; // Can't upload without Drive source

    // Download from Drive and upload to Cloudinary
    const buffer = await downloadFromDrive(photo.driveFileId);
    const baseName = photo.filename.replace(/\.[^.]+$/, "");
    const category = photo.category || "uncategorized";
    const publicId = `blog/${category}/${baseName}`;

    const result = await uploadToCloudinary(buffer, { publicId });

    // Update photos table
    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        cloudinaryPublicId: result.publicId,
        cloudinaryUrl: result.secureUrl,
        widthPx: result.width,
        heightPx: result.height,
        uploadedToCdn: true,
      },
    });

    // Update the document node
    ref.cloudinaryPublicId = result.publicId;
    ref.src = result.secureUrl;
    if (result.width) ref.width = result.width;
    if (result.height) ref.height = result.height;
    photosUploaded++;
  }

  return { updatedDocument: updatedDoc, photosUploaded };
}

// ---------- Atomic Commit ----------

interface CommitResult {
  documentVersion: number;
  htmlVersion: number;
  rendererOutput: RendererOutput;
  qaScore: QAScore;
}

export async function commitFinalization(
  articleId: number,
  document: CanonicalArticleDocument,
  htmlOverrides: HtmlOverride[] | null,
  userEmail: string,
  notes?: string
): Promise<CommitResult> {
  // 1. Final render
  const rendererOutput = renderArticle({
    document,
    htmlOverrides,
    templateVersion: TEMPLATE_VERSION,
  });

  // 2. Server-side QA
  const dom = new CheerioDomAdapter(rendererOutput.html);
  const qaScore = runQAChecks(document, rendererOutput.html, dom);

  if (!qaScore.canFinalize) {
    const err = new Error(
      `QA_GATE_FAILED: ${qaScore.failCount} FAIL-level issue(s) block finalization`
    );
    (err as any).qaScore = qaScore;
    throw err;
  }

  // 3. Determine next version
  const latestDoc = await prisma.articleDocument.findFirst({
    where: { articleId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latestDoc?.version || 0) + 1;

  // 4. Atomic commit
  await prisma.$transaction(async (tx) => {
    await tx.articleDocument.create({
      data: {
        articleId,
        version: nextVersion,
        canonicalDoc: document as any,
        htmlOverrides: htmlOverrides as any,
        finalizedBy: userEmail,
        notes: notes || null,
      },
    });

    await tx.articleHtml.create({
      data: {
        articleId,
        version: nextVersion,
        documentVersion: nextVersion,
        htmlContent: rendererOutput.html,
        metaTitle: rendererOutput.metaTitle,
        metaDescription: rendererOutput.metaDescription,
        schemaJson: rendererOutput.schemaJson,
        qaScore: `${qaScore.total}/${qaScore.possible}`,
        qaFailures: qaScore.failCount,
        finalizedBy: userEmail,
        notes: notes || null,
      },
    });

    await tx.contentMap.update({
      where: { id: articleId },
      data: {
        status: "finalized",
        wordCount: rendererOutput.wordCount,
        qaScore: `${qaScore.total}/${qaScore.possible}`,
      },
    });
  });

  return {
    documentVersion: nextVersion,
    htmlVersion: nextVersion,
    rendererOutput,
    qaScore,
  };
}

// ---------- Backfill Report ----------

export interface BackfillSuggestion {
  existingArticleId: number;
  existingArticleTitle: string;
  existingArticleSlug: string | null;
  existingArticleUrl: string | null;
  suggestedAnchorText: string;
  reason: string;
}

export async function generateBackfillReport(
  articleId: number
): Promise<BackfillSuggestion[]> {
  // Get the newly published article
  const article = await prisma.contentMap.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      slug: true,
      mainEntity: true,
      targetKeywords: true,
      hubName: true,
    },
  });
  if (!article) return [];

  // Get all OTHER published articles
  const published = await prisma.contentMap.findMany({
    where: {
      status: "published",
      id: { not: articleId },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      publishedUrl: true,
      mainEntity: true,
      targetKeywords: true,
      hubName: true,
    },
  });

  const suggestions: BackfillSuggestion[] = [];
  const articleKeywords = new Set(
    article.targetKeywords.map((k) => k.toLowerCase())
  );
  const articleEntity = article.mainEntity.toLowerCase();

  for (const other of published) {
    const otherKeywords = other.targetKeywords.map((k) => k.toLowerCase());
    const otherEntity = other.mainEntity.toLowerCase();

    // Check keyword overlap
    const sharedKeywords = otherKeywords.filter((k) => articleKeywords.has(k));

    // Check entity overlap
    const entityMatch =
      otherEntity.includes(articleEntity) ||
      articleEntity.includes(otherEntity);

    // Check same hub
    const sameHub = other.hubName === article.hubName;

    if (sharedKeywords.length > 0 || entityMatch || sameHub) {
      const reason = sharedKeywords.length > 0
        ? `Shares keyword: ${sharedKeywords[0]}`
        : entityMatch
          ? `Related entity: ${other.mainEntity}`
          : `Same hub: ${other.hubName}`;

      suggestions.push({
        existingArticleId: other.id,
        existingArticleTitle: other.title,
        existingArticleSlug: other.slug,
        existingArticleUrl: other.publishedUrl,
        suggestedAnchorText: article.title.length > 60
          ? article.title.substring(0, 57) + "..."
          : article.title,
        reason,
      });
    }
  }

  return suggestions;
}

// ---------- Link Activation ----------

export async function activateLinks(articleId: number): Promise<number> {
  // Get all published article IDs
  const publishedArticles = await prisma.contentMap.findMany({
    where: { status: "published" },
    select: { id: true },
  });
  const publishedIds = new Set(publishedArticles.map((a) => a.id));

  // Find links involving this article where BOTH ends are published
  const links = await prisma.internalLink.findMany({
    where: {
      OR: [
        { sourceArticleId: articleId },
        { targetArticleId: articleId },
      ],
      isActive: false,
    },
  });

  let activated = 0;
  for (const link of links) {
    const sourceOk = !link.sourceArticleId || publishedIds.has(link.sourceArticleId);
    const targetOk = !link.targetArticleId || publishedIds.has(link.targetArticleId);
    // Core page links (targetCorePage != null) are always activatable
    const isCorePageLink = !!link.targetCorePage;

    if ((sourceOk && targetOk) || isCorePageLink) {
      await prisma.internalLink.update({
        where: { id: link.id },
        data: { isActive: true },
      });
      activated++;
    }
  }

  return activated;
}
```

**Verification:** Run `npx tsc --noEmit` — should pass with zero errors.

---

### Phase 2: API Routes

**Step 2.1 — Create `src/app/api/articles/[id]/finalize/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { promotePendingPhotos, commitFinalization } from "@/lib/finalization";
import type { CanonicalArticleDocument } from "@/types/article";
import type { HtmlOverride } from "@/types/renderer";
import { z } from "zod";

const FinalizeSchema = z.object({
  document: z.record(z.any()),
  html: z.string().min(1),
  htmlOverrides: z.array(z.object({
    path: z.string(),
    html: z.string(),
    reason: z.string(),
  })).nullable().default(null),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("admin", "editor");
    const { id } = await params;
    const articleId = parseInt(id, 10);

    const body = await request.json();
    const parsed = FinalizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const document = parsed.data.document as unknown as CanonicalArticleDocument;
    const htmlOverrides = parsed.data.htmlOverrides as HtmlOverride[] | null;

    // Step 1: Promote photos to CDN
    const { updatedDocument, photosUploaded } = await promotePendingPhotos(document);

    // Step 2: Commit (includes final render + QA gate + atomic DB write)
    const result = await commitFinalization(
      articleId,
      updatedDocument,
      htmlOverrides,
      user.email,
      parsed.data.notes
    );

    return NextResponse.json({
      success: true,
      data: {
        documentVersion: result.documentVersion,
        htmlVersion: result.htmlVersion,
        qaScore: result.qaScore,
        cdnPhotosUploaded: photosUploaded,
        finalHtml: result.rendererOutput.html,
        metaTitle: result.rendererOutput.metaTitle,
        metaDescription: result.rendererOutput.metaDescription,
        wordCount: result.rendererOutput.wordCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.startsWith("QA_GATE_FAILED")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "QA_GATE_FAILED",
            message,
            details: (error as any).qaScore || null,
          },
        },
        { status: 422 }
      );
    }
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }
    if (message.startsWith("CLOUDINARY_ERROR")) {
      return NextResponse.json(
        { success: false, error: { code: "CLOUDINARY_ERROR", message } },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "FINALIZATION_FAILED", message } },
      { status: 500 }
    );
  }
}
```

**Step 2.2 — Create `src/app/api/articles/[id]/publish/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { generateBackfillReport, activateLinks } from "@/lib/finalization";
import { z } from "zod";

const PublishSchema = z.object({
  publishedUrl: z.string().url(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor");
    const { id } = await params;
    const articleId = parseInt(id, 10);

    const body = await request.json();
    const parsed = PublishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "publishedUrl is required and must be a valid URL" } },
        { status: 400 }
      );
    }

    // Verify article exists and is finalized
    const article = await prisma.contentMap.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Article not found" } },
        { status: 404 }
      );
    }

    if (article.status !== "finalized" && article.status !== "published") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Article must be finalized before publishing" } },
        { status: 400 }
      );
    }

    // Update content_map
    const publishedDate = new Date();
    await prisma.contentMap.update({
      where: { id: articleId },
      data: {
        status: "published",
        publishedDate,
        publishedUrl: parsed.data.publishedUrl,
      },
    });

    // Activate internal links
    const activatedLinks = await activateLinks(articleId);

    // Generate backfill report
    const backfillReport = await generateBackfillReport(articleId);

    return NextResponse.json({
      success: true,
      data: {
        status: "published",
        publishedDate: publishedDate.toISOString(),
        activatedLinks,
        backfillReport,
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
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Insufficient permissions" } },
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

**Step 2.3 — Create `src/app/api/articles/[id]/versions/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor", "viewer");
    const { id } = await params;
    const articleId = parseInt(id, 10);

    const versions = await prisma.articleDocument.findMany({
      where: { articleId },
      orderBy: { version: "desc" },
      select: {
        version: true,
        finalizedAt: true,
        finalizedBy: true,
        notes: true,
      },
    });

    // Enrich with HTML metadata
    const htmlVersions = await prisma.articleHtml.findMany({
      where: { articleId },
      select: {
        version: true,
        qaScore: true,
        qaFailures: true,
      },
    });

    const htmlMap = new Map(htmlVersions.map((h) => [h.version, h]));

    const enriched = versions.map((v) => {
      const html = htmlMap.get(v.version);
      return {
        version: v.version,
        finalizedAt: v.finalizedAt.toISOString(),
        finalizedBy: v.finalizedBy,
        notes: v.notes,
        qaScore: html?.qaScore || null,
        qaFailures: html?.qaFailures ?? 0,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
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
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Insufficient permissions" } },
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

**Step 2.4 — Create `src/app/api/articles/[id]/html/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor", "viewer");
    const { id } = await params;
    const articleId = parseInt(id, 10);

    const url = new URL(request.url);
    const versionParam = url.searchParams.get("version");

    let htmlRow;
    if (versionParam) {
      htmlRow = await prisma.articleHtml.findUnique({
        where: {
          articleId_version: {
            articleId,
            version: parseInt(versionParam, 10),
          },
        },
      });
    } else {
      // Get latest version
      htmlRow = await prisma.articleHtml.findFirst({
        where: { articleId },
        orderBy: { version: "desc" },
      });
    }

    if (!htmlRow) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "No finalized HTML found for this article" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        articleId: htmlRow.articleId,
        version: htmlRow.version,
        documentVersion: htmlRow.documentVersion,
        htmlContent: htmlRow.htmlContent,
        metaTitle: htmlRow.metaTitle,
        metaDescription: htmlRow.metaDescription,
        schemaJson: htmlRow.schemaJson,
        qaScore: htmlRow.qaScore,
        qaFailures: htmlRow.qaFailures,
        finalizedAt: htmlRow.finalizedAt.toISOString(),
        finalizedBy: htmlRow.finalizedBy,
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
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Insufficient permissions" } },
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

**Step 2.5 — Create `src/app/api/articles/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor", "viewer");
    const { id } = await params;
    const articleId = parseInt(id, 10);

    // Get content map entry
    const article = await prisma.contentMap.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Article not found" } },
        { status: 404 }
      );
    }

    // Get latest finalized document (if any)
    const latestDoc = await prisma.articleDocument.findFirst({
      where: { articleId },
      orderBy: { version: "desc" },
    });

    // Get version count
    const versionCount = await prisma.articleDocument.count({
      where: { articleId },
    });

    return NextResponse.json({
      success: true,
      data: {
        article,
        latestDocument: latestDoc
          ? {
              version: latestDoc.version,
              canonicalDoc: latestDoc.canonicalDoc,
              htmlOverrides: latestDoc.htmlOverrides,
              finalizedAt: latestDoc.finalizedAt.toISOString(),
              finalizedBy: latestDoc.finalizedBy,
              notes: latestDoc.notes,
            }
          : null,
        versionCount,
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
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Insufficient permissions" } },
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

**Step 2.6 — Create `src/app/api/capture/route.ts` (stub)**

```typescript
import { NextRequest, NextResponse } from "next/server";

// POST /api/capture — Lead capture from Wix (stub for Phase 3+)
export async function POST(request: NextRequest) {
  // Stub: accept lead capture data but don't process yet
  const body = await request.json();

  return NextResponse.json({
    success: true,
    data: {
      received: true,
      message: "Lead capture endpoint is active. Full processing will be enabled in Phase 3.",
      timestamp: new Date().toISOString(),
    },
  });
}
```

**Verification:** Run `npx tsc --noEmit` — should pass with zero errors.

---

### Phase 3: Store Integration

**Step 3.1 — Update `src/types/ui.ts`**

Add to `ArticleEditorState`:
```typescript
isFinalizing: boolean;
isPublishing: boolean;
finalizationError: string | null;
lastFinalizedVersion: number | null;
```

Add to `ArticleEditorActions`:
```typescript
finalizeArticle: () => Promise<void>;
publishArticle: (url: string) => Promise<void>;
loadFinalizedArticle: (articleId: number) => Promise<void>;
```

**Step 3.2 — Update `src/lib/store/article-store.ts`**

Add the new state fields to `initialState`:
```typescript
isFinalizing: false,
isPublishing: false,
finalizationError: null,
lastFinalizedVersion: null,
```

Add the three new actions:

```typescript
finalizeArticle: async () => {
  const state = get();
  if (!state.currentDocument || !state.currentHtml || !state.selectedArticleId) {
    console.warn("[finalizeArticle] Missing document, HTML, or article ID");
    return;
  }

  set({ isFinalizing: true, finalizationError: null, statusMessage: "Finalizing article..." });

  try {
    const response = await fetch(`/api/articles/${state.selectedArticleId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document: state.currentDocument,
        html: state.currentHtml,
        htmlOverrides: state.htmlOverrides.length > 0 ? state.htmlOverrides : null,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      set({
        isFinalizing: false,
        finalizationError: result.error?.message || "Finalization failed",
        statusMessage: "",
      });

      // If QA gate failed, open the scorecard
      if (result.error?.code === "QA_GATE_FAILED" && result.error?.details) {
        set({ qaScore: result.error.details, isScorecardOpen: true });
      }
      return;
    }

    // Update state with finalized result
    const freshState = get();
    set({
      isFinalizing: false,
      finalizationError: null,
      statusMessage: "",
      currentHtml: result.data.finalHtml,
      qaScore: result.data.qaScore,
      lastFinalizedVersion: result.data.documentVersion,
    });

    // Update the selected article status in store
    if (freshState.selectedArticle) {
      set({
        selectedArticle: {
          ...freshState.selectedArticle,
          status: "finalized" as any,
          wordCount: result.data.wordCount,
          qaScore: `${result.data.qaScore.total}/${result.data.qaScore.possible}`,
        },
      });
    }
  } catch (error) {
    set({
      isFinalizing: false,
      finalizationError: error instanceof Error ? error.message : "Network error",
      statusMessage: "",
    });
  }
},

publishArticle: async (url: string) => {
  const state = get();
  if (!state.selectedArticleId) return;

  set({ isPublishing: true, statusMessage: "Publishing article..." });

  try {
    const response = await fetch(`/api/articles/${state.selectedArticleId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishedUrl: url }),
    });

    const result = await response.json();

    if (!result.success) {
      set({
        isPublishing: false,
        statusMessage: result.error?.message || "Publishing failed",
      });
      return;
    }

    const freshState = get();
    set({
      isPublishing: false,
      statusMessage: "",
    });

    if (freshState.selectedArticle) {
      set({
        selectedArticle: {
          ...freshState.selectedArticle,
          status: "published" as any,
          publishedDate: result.data.publishedDate,
          publishedUrl: url,
        },
      });
    }
  } catch (error) {
    set({
      isPublishing: false,
      statusMessage: error instanceof Error ? error.message : "Network error",
    });
  }
},

loadFinalizedArticle: async (articleId: number) => {
  set({ statusMessage: "Loading finalized article..." });

  try {
    const response = await fetch(`/api/articles/${articleId}`);
    const result = await response.json();

    if (!result.success || !result.data.latestDocument) {
      set({ statusMessage: "No finalized version found" });
      return;
    }

    const doc = result.data.latestDocument.canonicalDoc as CanonicalArticleDocument;
    const overrides = (result.data.latestDocument.htmlOverrides as HtmlOverride[]) || [];

    // Re-render HTML from stored document
    const rendered = renderArticle({
      document: doc,
      htmlOverrides: overrides.length > 0 ? overrides : null,
      templateVersion: TEMPLATE_VERSION,
    });

    set({
      currentDocument: doc,
      currentHtml: rendered.html,
      htmlOverrides: overrides,
      selectedArticleId: articleId,
      lastFinalizedVersion: result.data.latestDocument.version,
      statusMessage: "",
    });

    // Load version history
    const versionsResponse = await fetch(`/api/articles/${articleId}/versions`);
    const versionsResult = await versionsResponse.json();

    if (versionsResult.success) {
      // Map DB versions to in-memory ArticleVersion format
      // (The VersionNavigator can display both DB and in-memory versions)
      console.log("[loadFinalizedArticle] Loaded", versionsResult.data.length, "versions");
    }
  } catch (error) {
    set({
      statusMessage: error instanceof Error ? error.message : "Failed to load article",
    });
  }
},
```

---

### Phase 4: UI Components

**Step 4.1 — Create `src/components/finalization/ExportPanel.tsx`**

This component shows after finalization with Copy for Wix buttons.

Key features:
- Copy Meta Title button
- Copy Meta Description button
- Copy HTML for Wix button (strips `<!DOCTYPE>`, `<html>`, `<head>`, extracts `<body>` inner content)
- Download .html button (full HTML file)
- Visual feedback on copy (brief "Copied!" state)
- Uses inline styles consistent with existing components
- Uses `lucide-react` icons (Copy, Download, Check)

The "Copy HTML for Wix" function should:
1. Take the full rendered HTML
2. Extract the content between `<body>` and `</body>` tags
3. Copy that to clipboard (Wix needs just the body content, not a full HTML document)

**Step 4.2 — Create `src/components/finalization/FinalizeButton.tsx`**

This component:
- Renders a "Finalize Article" button (gold `#bc9b5d` background when QA passes)
- Disabled if `isFinalizing` or no document loaded
- On click: calls `finalizeArticle()` from store
- Shows progress indicator during finalization
- On QA gate failure: opens the scorecard overlay
- On success: transitions to show the ExportPanel

**Step 4.3 — Create `src/components/finalization/PublishButton.tsx`**

This component:
- Shows a "Mark as Published" button (only visible after finalization)
- On click: opens a modal/dropdown with a URL input field
- URL input pre-populated with `https://www.bhutanwine.com/post/{slug}`
- "Publish" confirmation button
- On success: shows activated link count and backfill report

**Step 4.4 — Update `src/components/preview/PreviewToolbar.tsx`**

Add the FinalizeButton and PublishButton to the toolbar, positioned after the QA button:

```tsx
{/* After the QA scorecard button, before the validation badge */}
{currentDocument && <FinalizeButton />}
{lastFinalizedVersion && <PublishButton />}
```

Import the new components and the `lastFinalizedVersion` from the store.

---

### Phase 5: Integration & Polish

**Step 5.1 — Wire ExportPanel into the Preview area**

When `lastFinalizedVersion` is set in the store, show the ExportPanel as a collapsible panel below the PreviewToolbar (or as a slide-out panel on the right side).

**Step 5.2 — Update `.env.example` if needed**

No new environment variables are required for Guide 11. All services (Neon, Cloudinary, Claude) are already configured.

**Step 5.3 — Run documentation generators**

```bash
npm run gen:api-routes
npm run gen:all
```

Update `docs/ARCHITECTURE.md` Finalization section if `agent-guard` doesn't auto-update.

**Step 5.4 — Create integration test script**

Create `scripts/test-guide-11.ts`:

```typescript
// Test Guide 11: Finalization, Publishing, Version History

// 1. GET /api/articles/1/versions — should return empty array (no finalization yet)
// 2. POST /api/articles/1/finalize — with a sample document
//    - Should either succeed (if QA passes) or return QA_GATE_FAILED
// 3. GET /api/articles/1/versions — should now have 1 version
// 4. GET /api/articles/1/html — should return the stored HTML
// 5. GET /api/articles/1 — should return article with latestDocument
// 6. POST /api/articles/1/publish — with a test URL
//    - Should return backfillReport and activatedLinks count
// 7. GET /api/content-map/1 — verify status is "published"
```

**Verification:** Run `npm run build` — should complete cleanly with the new routes and components.

---

## I. Gate Checks

### Lint & Type Gate

```bash
npx tsc --noEmit          # Zero type errors
npx next lint              # Zero lint errors
npx prisma validate        # Schema valid (no changes to schema)
```

### Integration Gate

```bash
npx tsx scripts/test-guide-11.ts
```

Expected output:
```
✅ GET /api/articles/1/versions → 200 (empty array or versions list)
✅ POST /api/articles/1/finalize → 200 or 422 (QA gate)
✅ GET /api/articles/1/html → 200 (stored HTML)
✅ GET /api/articles/1 → 200 (article detail with latestDocument)
✅ POST /api/articles/1/publish → 200 (published + backfill report)
```

### Human Gate

**STOP HERE and alert the user.**

Run `npm run dev` and navigate to the dashboard:

1. **Select an article** that has been generated (has a current document in the editor)
2. **Run QA** — verify all FAIL-level checks pass (or fix them)
3. **Click "Finalize Article"** — observe:
   - Progress indicator appears
   - Photos upload to Cloudinary (if any pending)
   - HTML re-renders with CDN URLs
   - Success state shows ExportPanel
4. **Test ExportPanel:**
   - Click "Copy Meta Title" → paste → verify correct
   - Click "Copy Meta Description" → paste → verify correct
   - Click "Copy HTML for Wix" → paste into an HTML file → verify it renders correctly
   - Click "Download .html" → open downloaded file → verify complete HTML
5. **Click "Mark as Published"** → enter URL → confirm → verify:
   - Content map status changes to "published"
   - Backfill report appears (may be empty if no other articles are published)
6. **Check database:** Verify `article_documents` and `article_html` have rows

---

## J. Acceptance Criteria

1. Clicking "Finalize Article" runs server-side QA and blocks if FAIL-level issues exist
2. Finalization uploads un-CDN'd photos to Cloudinary and updates the canonical document
3. Finalization re-renders HTML with CDN URLs
4. Finalization atomically writes to `article_documents`, `article_html`, and updates `content_map` status
5. Version number auto-increments on re-finalization
6. `GET /api/articles/[id]/versions` returns the version history
7. `GET /api/articles/[id]/html` returns stored rendered HTML
8. ExportPanel provides Copy (title, meta desc, HTML) and Download buttons
9. "Copy HTML for Wix" strips `<!DOCTYPE>`, `<html>`, `<head>` and copies body content only
10. "Mark as Published" updates content_map status, date, and URL
11. Publishing activates internal links where both endpoints are published
12. Publishing generates a backfill link report
13. `npm run build` passes with zero errors
14. `npx tsc --noEmit` passes with zero errors

---

## K. Risks and Failure Modes

### K1. Prisma Transaction Timeout (MEDIUM)
**Risk:** `prisma.$transaction()` has a default timeout of 5 seconds. If Cloudinary uploads are slow, the transaction may fail.
**Defense:** Photo promotion happens BEFORE the transaction. The transaction only does DB writes (fast). Upload failures are caught before the transaction starts.

### K2. QA Gate Disagreement (LOW)
**Risk:** Client-side QA (BrowserDomAdapter) and server-side QA (CheerioDomAdapter) may produce slightly different results due to DOM parsing differences.
**Defense:** Both adapters implement the same `DomAdapter` interface. If discrepancies arise, the server-side result is authoritative.

### K3. Large HTML Storage (LOW)
**Risk:** Storing full HTML in the `htmlContent` column for every version may grow large over time.
**Defense:** Postgres handles text columns well. If storage becomes an issue, implement version pruning in Phase 2.

### K4. Backfill Report False Positives (LOW)
**Risk:** Keyword overlap matching may suggest irrelevant links.
**Defense:** The backfill report is advisory only — the user reviews and decides which links to add. Start with exact keyword matching; add fuzzy/semantic matching later.

### K5. Photo Upload Failure Mid-Finalization (MEDIUM)
**Risk:** If one photo fails to upload to Cloudinary, finalization should not partially commit.
**Defense:** Photo promotion runs entirely before the DB transaction. If any upload fails, the error propagates and the transaction never starts. The user can retry.
