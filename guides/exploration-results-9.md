# Exploration Results — Guide 9: Photo Pipeline & Image Management

**Generated:** 2026-03-02
**Previous guide completed:** Guide 8B (QA Scorecard Fix Engine)
**Target guide:** Guide 9 — Photo Pipeline & Image Management
**Milestone:** M6 — "Images work"

---

## 1. Current Build State

### Guides Completed: 1–8B

| Guide | Title | Status |
|---|---|---|
| 1 | Foundation (DB, Prisma, Auth, scaffold) | ✅ Complete |
| 2 | Content Map (CSV import, CRUD, seed) | ✅ Complete |
| 3 | Onyx RAG Integration | ✅ Complete |
| 4 | Canonical Article Schema + Renderer | ✅ Complete |
| 5 | Orchestration Layer + Claude API | ✅ Complete |
| 6 | Split-Pane UI + Chat Mode | ✅ Complete |
| 7 | Canvas Edit + HTML Mode + Undo/Redo | ✅ Complete |
| 8 | QA Scorecard | ✅ Complete |
| 8B | QA Scorecard Fix Engine (patch) | ✅ Complete |

### Inventory

| Resource | Count |
|---|---|
| Prisma models | 9 (User, ContentMap, ArticleDocument, ArticleHtml, InternalLink, Photo, ArticlePhoto, Lead, LeadEvent) |
| API routes | 17 route files |
| Type files | 13 files in `src/types/` |
| Lib modules | 56 files across 11 directories in `src/lib/` |
| Components | 21 files across 7 directories in `src/components/` |
| Database rows | 2 users, 39 content_map, 10 internal_links, 0 photos, 0 article_photos |

### Integration Health

| Service | Status | Notes |
|---|---|---|
| Neon Postgres | ✅ OK | All 9 tables accessible, ~120ms |
| Cloudinary API | ✅ OK | Credentials valid, `blog` preset confirmed signed |
| Cloudinary CDN | ✅ OK | w_800 and w_1200 transforms tested (508ms/830ms) |
| Claude API | ✅ OK | claude-sonnet-4-5-20250929, 1692ms |
| Onyx RAG | ✅ OK | Health endpoint 200, 532ms |
| Vercel Deploy | ✅ OK | Health endpoint 200, 459ms |
| Build | ✅ OK | `npm run build` — zero errors, 19 routes compiled |

---

## 2. Next Guide Target

### Guide 9: Photo Pipeline & Image Management

**From orchestration doc §7:**

> What it builds: The full image management system — Photo Manager UI, Cloudinary upload pipeline, CDN URL construction, and photo selection during article creation.

**Depends on:** Guide 1 (photos table), Guide 4 (renderer needs photo data), Guide 6 (UI) — all complete.

**File ownership (§5E):**
- `src/app/api/photos/` — all photo API routes
- `src/lib/cloudinary/` — upload pipeline, CDN URL construction
- `src/components/photo-manager/` — Photo Manager UI

**API routes to create (§5C):**
- `src/app/api/photos/route.ts` — GET (list), POST (catalog a new photo)
- `src/app/api/photos/[id]/route.ts` — GET (detail), PATCH (update metadata)
- `src/app/api/photos/upload/route.ts` — POST (Drive → Cloudinary upload)

**Architecture doc reference sections:**
- §3F: Automated Image Pipeline — Google Drive → Cloudinary CDN (lines 1333–1424)
- View 3: Photo Manager (lines 937–986)
- Layer 6: Photo Manifest (lines 1053–1059)
- Finalization flow step 1: push photos to Cloudinary (line 920)

---

## 3. Dependencies Satisfied

### Database Tables — ✅ READY

**`photos` table** (Prisma model `Photo`) — fully defined with all fields:
```
id, driveFileId (unique), driveUrl, cloudinaryPublicId, cloudinaryUrl,
filename, category, description, altText, classification ("informative"|"decorative"),
vineyardName, season, widthPx, heightPx, uploadedToCdn, createdAt
```

**`article_photos` table** (Prisma model `ArticlePhoto`) — fully defined:
```
articleId (FK → content_map), photoId (FK → photos), position ("hero"|"inline-1"|etc.)
Composite PK: [articleId, photoId]
```

Both tables exist in the database, are accessible via Prisma, and are empty (expected pre-Guide 9).

### TypeScript Types — ✅ READY

**`src/types/photo.ts`** — all three interfaces defined:

```typescript
interface Photo {
  id: number;
  driveFileId: string;
  driveUrl: string;
  cloudinaryPublicId: string | null;
  cloudinaryUrl: string | null;
  filename: string;
  category: string | null;
  description: string | null;
  altText: string | null;
  classification: "informative" | "decorative";
  vineyardName: string | null;
  season: string | null;
  widthPx: number | null;
  heightPx: number | null;
  uploadedToCdn: boolean;
}

interface PhotoManifest {
  photos: Photo[];
  heroPhotoId: number | null;
  totalAvailable: number;
}

interface CloudinaryTransform {
  width: number;
  format: "auto";
  quality: "auto";
  additionalParams?: string;
}
```

**Type–Prisma alignment:** ✅ All Photo interface fields match Prisma `Photo` model fields exactly (camelCase).

### Article Types — ✅ READY

**`src/types/article.ts`** — `ImagePlacement` interface is fully defined:
```typescript
interface ImagePlacement {
  photoId: number | null;    // FK to photos table, null if external
  src: string;               // URL (Cloudinary CDN or Drive fallback)
  alt: string;               // Descriptive text (empty for decorative)
  caption: string | null;
  classification: "informative" | "decorative";
  width: number | null;
  height: number | null;
}
```

`ImageNode` content node type exists: `{ type: "image"; placement: ImagePlacement; }`

### Renderer — ✅ READY (Cloudinary URL builder exists)

**`src/lib/renderer/cloudinary.ts`** — `buildCloudinaryUrl()` is fully implemented:
- Builds: `https://res.cloudinary.com/{cloudName}/image/upload/{w,f,q}/{publicId}`
- Handles width, format, quality, additionalParams
- Returns empty string if publicId is null
- Reads `CLOUDINARY_CLOUD_NAME` from env
- Exported from `src/lib/renderer/index.ts`

**`src/lib/renderer/components.ts`** — `renderImage()` function:
- Uses `buildCloudinaryUrl()` when `placement.photoId` is set
- Falls back to `placement.src` when photoId is null
- Correctly sets `loading="eager"` + `fetchpriority="high"` for hero images
- Correctly sets `loading="lazy"` for inline images
- Handles decorative images (`alt=""`, `role="presentation"`)
- Applies width/height attributes, captions, `data-cad-path` for Canvas Edit

**Key observation for Draft-to-Final URL swap strategy:** The renderer already supports this via the `ImagePlacement` structure:
- During drafting: `photoId` can be set, but `src` contains the Drive URL as fallback
- On finalization: upload to Cloudinary sets `cloudinaryPublicId`, and the renderer uses `buildCloudinaryUrl()` with the publicId
- The renderer line: `const src = placement.photoId ? buildCloudinaryUrl(...) : placement.src;`
- **This means Guide 9 needs to ensure that during drafting, `placement.src` holds the Drive URL, and during finalization, `placement.photoId` is populated so the renderer picks up the Cloudinary CDN path**

### Prompt Assembly — ✅ READY

**`src/lib/prompt-assembly/layer-photo-manifest.ts`** — fully implemented:
- Accepts `PhotoManifest | null`
- Returns "No photos selected" message when null/empty
- Lists each photo with ID, filename, category, description, alt text, classification, URL (CDN or Drive fallback), dimensions
- Includes instructions for Claude on how to use the photos
- Assembled as Layer 6 of the system prompt

### QA Image Checks — ✅ READY

**`src/lib/qa/checks/image-checks.ts`** — 5 image-related checks exist:
- W14: Image count minimum (hub≥5, spoke≥3, news≥1)
- W15: ≤400 consecutive words without image
- W17: Captions on informative images
- W20: Hero image loading="eager" + fetchpriority="high"
- W21: All images have width + height attributes

### Auth — ✅ READY

`requireRole()` and `requireAuth()` helpers in `src/lib/auth/session.ts` — used by all existing API routes.

### API Response Format — ✅ READY

`ApiResponse<T>` type in `src/types/api.ts`, including `CLOUDINARY_ERROR` error code.

### Zustand Store — ✅ READY

`src/lib/store/article-store.ts` — full editor state management exists. Guide 9 may need to add photo selection state.

---

## 4. Dependencies Missing or Needing Extension

### 4A. Cloudinary SDK — ❌ NOT INSTALLED

The `cloudinary` npm package is **not** in `package.json`. The existing `src/lib/cloudinary/client.ts` is a config stub only (5 lines):
```typescript
export const cloudinaryConfig = {
  url: process.env.CLOUDINARY_URL || '',
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'blog',
};
```

**Guide 9 must:** `npm install cloudinary` and expand this module with:
- Cloudinary SDK v2 initialization (using `v2.config()`)
- Signed upload function (uses API_KEY + API_SECRET for HMAC signing)
- Upload with structured public IDs: `blog/{category}/{filename}`
- Return `cloudinary_public_id`, `cloudinary_url`, `width`, `height`

### 4B. Google Drive API — ❌ NOT INSTALLED

No `googleapis` or `google-auth-library` packages in `package.json`. Guide 9's upload flow requires downloading images from Google Drive before uploading to Cloudinary.

**Options:**
1. Install `googleapis` package for full Drive API access (recommended for production)
2. Use simple HTTPS fetch with Drive file URL pattern: `https://drive.google.com/uc?export=download&id={FILE_ID}` (simpler but less reliable for large files)
3. Use the Drive export URL with Drive File ID for download

**Guide 9 must decide:** Which approach to use for Drive → Cloudinary transfer.

### 4C. `CLOUDINARY_UPLOAD_PRESET` env var — ⚠️ MISSING FROM .env

The `.env.example` does NOT include `CLOUDINARY_UPLOAD_PRESET`. The code defaults to `'blog'`, but this should be explicit. Add to `.env.example`:
```
CLOUDINARY_UPLOAD_PRESET=blog
```

### 4D. Google Drive Env Vars — ❌ NOT CONFIGURED

No Google Drive/OAuth env vars exist in `.env.example`. If using the `googleapis` package, Guide 9 needs:
- `GOOGLE_DRIVE_FOLDER_ID` — the BWC Blog Photos folder ID
- Google OAuth credentials (or service account key) for Drive API access

**Alternatively:** If using simple Drive URLs for download, these may not be needed (the `drive_file_id` and `drive_url` stored in the `photos` table may suffice).

### 4E. Photo Manager UI Components — ❌ NOT CREATED

`src/components/photo-manager/` directory does not exist. Guide 9 must create:
- `PhotoManager.tsx` — main container for browsing/managing photos
- `PhotoCard.tsx` — individual photo display with metadata editing
- `PhotoSelector.tsx` — article photo selection workflow
- `index.ts` — barrel exports

### 4F. Dashboard Navigation — NEEDS UPDATE

The AppShell (`src/components/layout/AppShell.tsx`) header currently contains:
- BWC brand text
- ArticleSelector
- UserMenu

Guide 9 should add:
- "Photo Manager" navigation link/tab
- "Source Drive" link (permanent link to BWC image folder in Google Drive)

### 4G. Photo Selection State in Article Store — NEEDS EXTENSION

The `useArticleStore` does not currently track photo selection state. Guide 9 needs to add:
- `selectedPhotos: ArticlePhoto[]` or similar
- `photoManifest: PhotoManifest | null`
- Actions: `setPhotoManifest`, `selectPhotoForArticle`, `removePhotoFromArticle`, `setHeroPhoto`

### 4H. Orchestration Integration — NEEDS WIRING

The `src/lib/orchestration/orchestrator.ts` calls `buildLayerPhotoManifest()` but currently passes `null` (no photos available yet). Guide 9 must wire the orchestrator to:
1. Query `article_photos` + `photos` tables for the current article
2. Build a `PhotoManifest` from the results
3. Pass it to `buildLayerPhotoManifest()` for Layer 6

---

## 5. Established Patterns to Follow

### 5A. API Route Handler Pattern

From `src/app/api/content-map/route.ts` (representative CRUD route):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const CreateSchema = z.object({ /* ... */ });

export async function GET() {
  try {
    await requireRole("admin", "editor", "viewer");
    const entries = await prisma.modelName.findMany({ /* ... */ });
    return NextResponse.json({ success: true, data: entries });
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

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const entry = await prisma.modelName.create({ data });
    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    // ... same auth + error handling pattern
  }
}
```

**Key conventions:**
- `requireRole()` for auth (throws "AUTH_REQUIRED" or "AUTH_FORBIDDEN")
- Zod `.safeParse()` for validation
- `{ success: true, data }` / `{ success: false, error: { code, message } }` response format
- 401 for auth required, 403 for forbidden, 400 for validation, 500 for internal

### 5B. Library Module Pattern

From `src/lib/onyx/` (external service pattern):
- `client.ts` — SDK/API configuration and low-level calls
- `query-builder.ts` — query construction logic
- `context-assembler.ts` — output formatting
- `health-checker.ts` — service health verification
- `index.ts` — barrel re-exports

Guide 9's `src/lib/cloudinary/` should follow:
- `client.ts` — Cloudinary SDK config + signed upload function
- `url-builder.ts` — already exists at `src/lib/renderer/cloudinary.ts` (keep there, don't duplicate)
- `drive-downloader.ts` — Google Drive file download logic
- `index.ts` — barrel re-exports

### 5C. Component Pattern

From `src/components/scorecard/ScorecardPanel.tsx` (representative panel component):
- Functional components with `"use client"` directive
- Inline styles (NOT Tailwind in most existing components)
- Imports from `@/lib/store/article-store` for state
- Imports from `@/types/` for type definitions
- Event handlers as arrow functions
- lucide-react for icons

### 5D. State Management Pattern

From `src/lib/store/article-store.ts`:
- Zustand store with `create<State & Actions>()`
- State shape defined as initial const
- Actions as functions in the create callback
- Selectors exported as standalone functions
- Store imported in components via `useArticleStore`

### 5E. Prompt Assembly Layer Pattern

From `src/lib/prompt-assembly/layer-photo-manifest.ts` (already exists):
- Function signature: `(input: T | null) => PromptLayer`
- Returns `{ name: string, content: string, tokenEstimate: number }`
- Handles null/empty gracefully with sensible default message
- Token estimate: `Math.ceil(content.length / 4)`

---

## 6. Integration Readiness

| Service | Status | Guide 9 Usage | Notes |
|---|---|---|---|
| Cloudinary API | ✅ Verified | Signed uploads, CDN URL construction | Cloud: deahtb4kj, preset: blog (signed), env vars set |
| Cloudinary CDN | ✅ Verified | w_1200/w_800,f_auto,q_auto transforms | Both hero and inline transforms tested and working |
| Neon Postgres | ✅ Verified | photos + article_photos tables | Tables exist, empty, Prisma models work |
| Google Drive | ⚠️ Needs SDK | Download photos for Cloudinary upload | No googleapis package installed, no Drive env vars |

**Cloudinary specifics verified:**
- Upload preset `blog` exists and is SIGNED (unsigned: false)
- Overwrite enabled, use_filename_as_display_name enabled
- Asset folder set to "blog"
- API key: 884563924896736 (working)
- 2 demo images in account (no blog images yet)

**Known quirk:** `CLOUDINARY_UPLOAD_PRESET` is NOT in `.env` file but code defaults to `'blog'`. Should be made explicit.

---

## 7. Risks and Blockers

### BLOCKER: Google Drive SDK Not Installed

The upload flow (Drive → Cloudinary) requires downloading images from Google Drive. No `googleapis` package is installed and no Drive OAuth/service-account credentials are configured.

**Mitigation options:**
1. **Manual catalog approach:** User manually provides Drive file IDs and URLs when cataloging photos in the Photo Manager. The system stores these. On finalization, it downloads via the public Drive export URL (`https://drive.google.com/uc?export=download&id={FILE_ID}`) — this works for files shared with "Anyone with the link."
2. **Google Drive API:** Install `googleapis`, configure a service account, and use the Drive API for listing files and downloading. More robust but requires credential setup.
3. **Defer Drive integration:** Build the Photo Manager with manual photo upload (file picker) to Cloudinary directly, deferring the Drive sync to a later enhancement.

**Recommendation:** Option 1 (manual catalog + public URL download) for initial implementation. This avoids the Google OAuth complexity and still delivers the core photo pipeline. Drive API integration can be added later.

### RISK: Renderer Image URL Strategy

The renderer's `renderImage()` function currently does: `placement.photoId ? buildCloudinaryUrl(...) : placement.src`

This means:
- If `photoId` is set and Cloudinary URL is built from `blog/{photoId}` — but the actual Cloudinary public ID may differ from the photo's DB id
- **Fix needed:** The renderer should use the photo's `cloudinaryPublicId` field, not the numeric `photoId`, for URL construction

Looking at the actual code: `buildCloudinaryUrl(\`blog/${placement.photoId}\`, ...)` — this constructs a URL like `blog/42` which is incorrect. The actual Cloudinary public ID would be something like `blog/vineyards/bajo-harvest-2024-01`.

**Guide 9 must update** the renderer's `renderImage()` to properly resolve photo IDs to Cloudinary public IDs, either by:
1. Expanding `ImagePlacement` to include `cloudinaryPublicId` field, OR
2. Changing the renderer to look up the photo's public ID from the manifest/database

### RISK: No Feature Flag Toggle

`ENABLE_PHOTO_MANAGER=true` exists in `.env.example` line 61, but no code currently reads it. Guide 9 should implement conditional rendering of the Photo Manager based on this flag.

---

## 8. Deviations from Plan

### 8A. Renderer Already Has Cloudinary URL Builder

The orchestration doc predicted Guide 9 would need to create CDN URL construction. In reality, `buildCloudinaryUrl()` already exists in `src/lib/renderer/cloudinary.ts` (created in Guide 4). Guide 9 should **reuse** this, not recreate it.

### 8B. Photo Manifest Layer Already Exists

`src/lib/prompt-assembly/layer-photo-manifest.ts` was created in Guide 5, not Guide 9. It's fully functional and just needs to be wired to real photo data (currently receives `null`).

### 8C. Image QA Checks Already Exist

Guide 8 created 5 image-related QA checks (W14, W15, W17, W20, W21). These don't need to be created in Guide 9 — they already validate image placement in articles.

### 8D. Renderer Image Source Logic Has a Bug

As noted in §7 Risks, the renderer's `renderImage()` uses `blog/${placement.photoId}` as the Cloudinary public ID, but `photoId` is a numeric database ID (e.g., `42`), not a Cloudinary public ID (e.g., `blog/vineyards/bajo-harvest-2024-01`). This must be corrected in Guide 9.

### 8E. No `ENABLE_PHOTO_MANAGER` Check in Code

The env var exists in `.env.example` but no code reads it. The architecture doc implies a feature-flag approach, but no such system has been built yet.

### 8F. AppShell Has No Photo Manager Navigation

The current AppShell header only has ArticleSelector and UserMenu. There's no navigation to a Photo Manager view or a Drive link. Guide 9 needs to add this.

---

## 9. Draft-to-Final URL Swap Strategy

This is the core architectural question for Guide 9. Based on the codebase analysis:

### During Drafting (Preview)

1. User catalogs photos in Photo Manager → stored in `photos` table with `drive_url` and `drive_file_id`
2. User selects photos for an article → stored in `article_photos` junction table
3. Orchestrator builds `PhotoManifest` from DB → passes to `buildLayerPhotoManifest()` → Layer 6 of system prompt
4. Claude generates `CanonicalArticleDocument` with `ImagePlacement` nodes referencing `photoId` and `src: drive_url`
5. Renderer outputs HTML with Drive URLs for preview (acceptable for internal drafting tool)

### On Finalization (Production HTML)

1. Finalization flow checks each photo's `uploaded_to_cdn` status
2. For photos not yet on Cloudinary:
   - Download from Drive (via `drive_file_id`)
   - Upload to Cloudinary with public ID: `blog/{category}/{filename}`
   - Store `cloudinary_public_id`, `cloudinary_url`, `width_px`, `height_px` in `photos` table
   - Set `uploaded_to_cdn = true`
3. Re-render HTML → renderer detects `photoId` is set → uses `buildCloudinaryUrl(photo.cloudinaryPublicId, transforms)` → CDN URL in final HTML
4. Final HTML committed to `article_html` table with permanent Cloudinary URLs

### Key Implementation Detail

The renderer's `renderImage()` needs modification. Currently:
```typescript
const src = placement.photoId
  ? buildCloudinaryUrl(`blog/${placement.photoId}`, { width: placement.width || 1200 })
  : placement.src;
```

Should become (one of two approaches):

**Option A:** Add `cloudinaryPublicId` to `ImagePlacement`:
```typescript
const src = placement.cloudinaryPublicId
  ? buildCloudinaryUrl(placement.cloudinaryPublicId, { width: placement.width || 1200 })
  : placement.src;
```

**Option B:** Resolve at render time from a photo lookup:
```typescript
// Renderer receives a photoMap: Map<number, Photo> alongside the document
const photo = placement.photoId ? photoMap.get(placement.photoId) : null;
const src = photo?.cloudinaryPublicId
  ? buildCloudinaryUrl(photo.cloudinaryPublicId, { width: placement.width || 1200 })
  : placement.src;
```

**Recommendation:** Option A is simpler and keeps the renderer stateless. The finalization flow should update `ImagePlacement.cloudinaryPublicId` in the canonical doc before the final render.

---

## 10. Source Drive Link

The architecture doc mentions a permanent "Source Drive" link in the dashboard header for easy access to the BWC image folder. Implementation:

1. Add `GOOGLE_DRIVE_PHOTOS_FOLDER_URL` env var (the shareable link to the BWC Blog Photos folder)
2. Add to `.env.example`:
   ```
   GOOGLE_DRIVE_PHOTOS_FOLDER_URL=https://drive.google.com/drive/folders/{FOLDER_ID}
   ```
3. Add an external link icon in the AppShell header that opens this URL in a new tab

This is simple and doesn't require the Google Drive API — just a static link.

---

## Summary for build-guide

**What Guide 9 produces:**
- `src/app/api/photos/route.ts` — GET (list with filters), POST (catalog new photo)
- `src/app/api/photos/[id]/route.ts` — GET (detail), PATCH (update metadata/alt text)
- `src/app/api/photos/upload/route.ts` — POST (Drive → Cloudinary upload)
- `src/lib/cloudinary/client.ts` — expanded with Cloudinary SDK init + signed upload
- `src/lib/cloudinary/drive-downloader.ts` — download file from Drive URL
- `src/lib/cloudinary/index.ts` — barrel exports
- `src/components/photo-manager/PhotoManager.tsx` — browse/search/filter photos
- `src/components/photo-manager/PhotoCard.tsx` — individual photo with metadata editing
- `src/components/photo-manager/PhotoSelector.tsx` — article photo selection modal
- `src/components/photo-manager/index.ts` — barrel exports
- Update `src/lib/renderer/components.ts` — fix `renderImage()` to use `cloudinaryPublicId`
- Update `src/lib/store/article-store.ts` — add photo selection state
- Update `src/components/layout/AppShell.tsx` — add Photo Manager nav + Drive link
- Update `src/lib/orchestration/orchestrator.ts` — wire photo manifest from DB
- Update `.env.example` — add `CLOUDINARY_UPLOAD_PRESET`, `GOOGLE_DRIVE_PHOTOS_FOLDER_URL`
- `scripts/test-guide-9.ts` — integration test

**What already exists and should be reused:**
- `src/lib/renderer/cloudinary.ts` — `buildCloudinaryUrl()` (don't recreate)
- `src/lib/prompt-assembly/layer-photo-manifest.ts` — fully functional (just wire data)
- `src/types/photo.ts` — all types defined
- `src/lib/qa/checks/image-checks.ts` — 5 image QA checks
- Prisma models `Photo` and `ArticlePhoto` — fully defined

**NPM packages to install:**
- `cloudinary` (Cloudinary Node.js SDK for signed uploads)

**Critical fix:**
- Renderer `renderImage()` must stop using `blog/${placement.photoId}` and instead resolve the actual Cloudinary public ID
