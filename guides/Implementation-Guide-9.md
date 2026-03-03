# Guide 9: Photo Pipeline & Image Management

## A. Objective

Build the full photo management subsystem — a Photo Manager UI, Cloudinary upload pipeline, AI-powered alt-text generation, and the wiring that connects cataloged photos to the article generation and rendering pipeline.

**Milestone:** M6 — "Images work"

**User story:** A BWC team member uploads photos — either to Google Drive or directly via the UI — opens the Photo Manager, clicks "AI Describe" to generate initial alt-text/descriptions (Vision cataloging), and the full library of cataloged photos becomes the "Available Library." When generating an article, Claude auto-selects the most contextually appropriate photos from this library based on article keywords and SEO targets, rewrites alt tags and captions to match the article's specific SEO keywords (rather than reusing generic library descriptions), and the system handles Drive URLs for preview and Cloudinary CDN URLs for finalized production HTML.

---

## B. Scope

### In Scope

- Install `cloudinary` and `googleapis` npm packages
- Expand `src/lib/cloudinary/` with Cloudinary SDK initialization and signed upload function
- Create `src/lib/cloudinary/drive-downloader.ts` for Drive-to-buffer download
- Create 4 API route files under `src/app/api/photos/`
- Create `POST /api/photos/describe` for AI Vision alt-text generation (used for both Drive and UI uploads)
- **NEW: Create `POST /api/photos/drive-upload` for direct UI file upload → Google Drive**
- Create `src/components/photo-manager/` with PhotoManager, PhotoCard, PhotoSelector
- Fix the renderer's `renderImage()` to resolve `cloudinaryPublicId` correctly
- Fix the JSON-LD builder's hero image URL to use the same pattern
- **NEW: Update PhotoManifest design to include full "Available Library" (all cataloged photos), not just pre-selected ones**
- **NEW: Update prompt assembly Layer 6 to instruct Claude to Auto-Select photos from the library based on article keywords/context**
- **NEW: Add SEO Dynamic Metadata instructions — Claude rewrites alt tags and captions to target article-specific SEO keywords**
- **NEW: Wire Vision cataloging (G4) to auto-run on direct UI uploads for initial descriptions**
- Wire the orchestrator to build `PhotoManifest` from the database
- Add Photo Manager navigation and Source Drive link to AppShell
- Add photo-related env vars to `src/lib/env.ts` and `.env.example`
- Create `scripts/test-guide-9.ts` integration test

### Out of Scope

- Automatic Drive folder listing/sync (manual catalog for now)
- Bulk batch upload (one photo at a time initially)
- Photo cropping/editing UI
- The finalization flow itself (Guide 11 wires the finalize button)

---

## C. Depends On

| Guide | What It Provides | Status |
|---|---|---|
| 1 | Prisma `Photo` + `ArticlePhoto` models, auth, types | ✅ Complete |
| 4 | Article Renderer, `buildCloudinaryUrl()`, `ImagePlacement` type | ✅ Complete |
| 5 | Orchestration layer, `assembleSystemPrompt()`, Claude client | ✅ Complete |
| 6 | Split-pane UI, AppShell, Zustand store | ✅ Complete |

---

## D. Shared Contracts Referenced

### Database Tables (Prisma — already defined in Guide 1)

**`Photo` model** (`photos` table):
```
id, driveFileId (unique), driveUrl, cloudinaryPublicId, cloudinaryUrl,
filename, category, description, altText, classification, vineyardName,
season, widthPx, heightPx, uploadedToCdn, createdAt
```

**`ArticlePhoto` model** (`article_photos` table):
```
articleId (FK → content_map), photoId (FK → photos), position
Composite PK: [articleId, photoId]
```

### TypeScript Types (already defined in Guide 1)

- `src/types/photo.ts` — `Photo`, `PhotoManifest`, `CloudinaryTransform`
- `src/types/article.ts` — `ImagePlacement`, `ImageNode`
- `src/types/api.ts` — `ApiResponse<T>`, `CLOUDINARY_ERROR` code

### Existing Modules to Reuse

- `src/lib/renderer/cloudinary.ts` — `buildCloudinaryUrl()` (DO NOT recreate)
- `src/lib/prompt-assembly/layer-photo-manifest.ts` — fully implemented, just needs real data
- `src/lib/qa/checks/image-checks.ts` — 5 image QA checks already exist
- `src/lib/claude/client.ts` — `getClaudeClient()` for AI Vision calls

---

## E. Existing Constraints to Preserve

1. The renderer is a **pure function** — no DB calls. Image URL resolution must happen BEFORE the renderer runs.
2. `buildCloudinaryUrl()` expects a Cloudinary public ID string (e.g., `blog/vineyards/bajo-harvest-2024`), NOT a numeric database ID.
3. The `assembleSystemPrompt()` function already accepts `PhotoManifest | null` — do not change its signature.
4. All API routes must use `requireRole()` for auth and the `{ success, data/error }` response format.
5. Existing QA image checks (W14, W15, W17, W20, W21) must continue to pass.
6. The AppShell header height is fixed at `56px` — new nav elements must fit.

---

## F. Files Created / Modified

### New Files

| File | Purpose |
|---|---|
| `src/lib/cloudinary/upload.ts` | Cloudinary SDK init + signed upload function |
| `src/lib/cloudinary/drive-downloader.ts` | Download image buffer from Google Drive |
| `src/lib/cloudinary/index.ts` | Barrel exports |
| `src/app/api/photos/route.ts` | GET (list), POST (catalog) |
| `src/app/api/photos/[id]/route.ts` | GET (detail), PATCH (update metadata) |
| `src/app/api/photos/upload/route.ts` | POST (Drive → Cloudinary) |
| `src/app/api/photos/drive-upload/route.ts` | POST (Direct UI file upload → Google Drive + catalog) |
| `src/app/api/photos/describe/route.ts` | POST (AI Vision alt-text generation) |
| `src/components/photo-manager/PhotoManager.tsx` | Main photo browsing/management view |
| `src/components/photo-manager/PhotoCard.tsx` | Individual photo card with metadata editing |
| `src/components/photo-manager/PhotoSelector.tsx` | Modal for selecting photos for an article |
| `src/components/photo-manager/index.ts` | Barrel exports |
| `src/app/(dashboard)/photos/page.tsx` | Photo Manager page route |
| `scripts/test-guide-9.ts` | Integration test |

### Modified Files

| File | Change |
|---|---|
| `src/lib/cloudinary/client.ts` | Add Cloudinary SDK v2 config alongside existing config export |
| `src/lib/renderer/components.ts` | Fix `renderImage()` to use `cloudinaryPublicId` field |
| `src/lib/renderer/jsonld.ts` | Fix hero image URL to use `cloudinaryPublicId` |
| `src/types/article.ts` | Add `cloudinaryPublicId` field to `ImagePlacement` |
| `src/lib/env.ts` | Add `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GOOGLE_DRIVE_PHOTOS_FOLDER_URL` |
| `src/lib/prompt-assembly/layer-photo-manifest.ts` | Rewrite to support Available Library + Auto-Select + SEO Dynamic Metadata |
| `src/lib/prompt-assembly/layer-template-ref.ts` | Update ImagePlacement reference to include `cloudinaryPublicId` |
| `src/lib/qa/patch-prompt.ts` | Update ImagePlacement format reference to include `cloudinaryPublicId` |
| `src/components/layout/AppShell.tsx` | Add Photo Manager nav tab + Source Drive link |
| `src/lib/store/article-store.ts` | Add `photoManifest` state + photo selection actions |
| `.env.example` | Add `CLOUDINARY_UPLOAD_PRESET`, `GOOGLE_DRIVE_PHOTOS_FOLDER_URL`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY` |

---

## G. Technical Design

### G1. ImagePlacement Type Extension

Add `cloudinaryPublicId` to `ImagePlacement` in `src/types/article.ts`:

```typescript
export interface ImagePlacement {
  photoId: number | null;
  cloudinaryPublicId: string | null;  // NEW — Cloudinary public ID for CDN URL construction
  src: string;
  alt: string;
  caption: string | null;
  classification: "informative" | "decorative";
  width: number | null;
  height: number | null;
}
```

**Why:** The renderer needs the actual Cloudinary public ID (e.g., `blog/vineyards/bajo-harvest-2024`) to build CDN URLs. Currently it incorrectly uses `blog/${placement.photoId}` which produces URLs like `blog/42`. Adding this field keeps the renderer stateless — no DB lookups needed.

**Draft-to-Final flow:**
- During drafting: `cloudinaryPublicId: null`, `src: driveUrl` → renderer uses `placement.src` (Drive URL)
- After Cloudinary upload: `cloudinaryPublicId: "blog/vineyards/bajo-harvest-2024"`, `src` unchanged → renderer uses `buildCloudinaryUrl(placement.cloudinaryPublicId, ...)`
- The finalization flow (Guide 11) updates `cloudinaryPublicId` in the canonical doc before the final render

### G2. Renderer Fix

**`src/lib/renderer/components.ts`** — `renderImage()` changes from:

```typescript
const src = placement.photoId
  ? buildCloudinaryUrl(`blog/${placement.photoId}`, { width: placement.width || 1200 })
  : placement.src;
```

To:

```typescript
const src = placement.cloudinaryPublicId
  ? buildCloudinaryUrl(placement.cloudinaryPublicId, { width: placement.width || 1200 })
  : placement.src;
```

**`src/lib/renderer/jsonld.ts`** — `buildSchemaJson()` hero image changes from:

```typescript
const heroUrl = doc.heroImage
  ? doc.heroImage.src || buildCloudinaryUrl(doc.heroImage.photoId ? `blog/${doc.heroImage.photoId}` : null)
  : undefined;
```

To:

```typescript
const heroUrl = doc.heroImage
  ? (doc.heroImage.cloudinaryPublicId
      ? buildCloudinaryUrl(doc.heroImage.cloudinaryPublicId, { width: 1200 })
      : doc.heroImage.src)
  : undefined;
```

### G3. Cloudinary SDK Module

**`src/lib/cloudinary/client.ts`** — extend existing config stub:

```typescript
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

// Existing config export (keep for backwards compatibility)
export const cloudinaryConfig = {
  url: process.env.CLOUDINARY_URL || '',
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'blog',
};

// SDK initialization (lazy singleton)
let configured = false;
export function getCloudinaryClient(): typeof cloudinary {
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}
```

**`src/lib/cloudinary/upload.ts`** — signed upload function:

```typescript
import { getCloudinaryClient } from "./client";

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export async function uploadToCloudinary(
  buffer: Buffer,
  options: {
    publicId: string;        // e.g., "blog/vineyards/bajo-harvest-2024"
    folder?: string;         // e.g., "blog"
    overwrite?: boolean;
  }
): Promise<CloudinaryUploadResult> {
  const cld = getCloudinaryClient();

  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        public_id: options.publicId,
        folder: options.folder,
        overwrite: options.overwrite ?? true,
        resource_type: "image",
        use_filename: true,
        unique_filename: false,
      },
      (error, result) => {
        if (error) reject(new Error(`CLOUDINARY_ERROR: ${error.message}`));
        else if (!result) reject(new Error("CLOUDINARY_ERROR: No result returned"));
        else resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );
    stream.end(buffer);
  });
}
```

**`src/lib/cloudinary/drive-downloader.ts`** — download image from Google Drive:

```typescript
/**
 * Download an image from Google Drive using the export URL.
 * Works for files shared with "Anyone with the link" or via a service account.
 * Returns a Buffer of the image data.
 */
export async function downloadFromDrive(driveFileId: string): Promise<Buffer> {
  // Use the Drive direct download URL pattern
  const url = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "BWC-Content-Engine/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`DRIVE_DOWNLOAD_FAILED: HTTP ${response.status} for file ${driveFileId}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
```

> **Note:** This uses the public download URL pattern. For private files, Guide 9 should also support passing a Google Drive API access token via the `googleapis` package. The initial implementation works with "Anyone with the link" sharing.

### G4. AI Vision Alt-Text Generation

**`src/app/api/photos/describe/route.ts`** — uses Claude's vision capability to analyze a photo and generate SOP-compliant alt-text:

```typescript
// POST /api/photos/describe
// Body: { photoId: number } OR { imageUrl: string }
// Returns: { altText: string, description: string, suggestedCategory: string }
```

**Implementation approach:**
1. Fetch the photo's Drive URL (or accept an image URL directly)
2. Download a thumbnail-size version (Cloudinary can serve resized versions; for Drive images, use the thumbnail URL)
3. Send the image to Claude as a `base64`-encoded `image` content block
4. System prompt instructs Claude to return:
   - `altText`: 10–25 words, SOP-compliant descriptive text
   - `description`: 1–2 sentence plain-language description of the image content
   - `suggestedCategory`: one of "vineyard", "winemaking", "culture", "team", "food", "landscape"
5. Parse Claude's JSON response and return

**Claude prompt for vision:**
```
You are an image analyst for Bhutan Wine Company's blog content engine.
Analyze this photo and return a JSON object with exactly these fields:

{
  "altText": "10-25 word descriptive alt text for SEO. Be specific: name vineyard locations, grape varieties, wine processes, or cultural elements visible. Example: 'Ripe Merlot grape clusters on VSP-trained vines at Bajo vineyard in Bhutan Punakha Valley'",
  "description": "1-2 sentence description of what appears in the image, providing context for content writers",
  "suggestedCategory": "vineyard|winemaking|culture|team|food|landscape"
}

Rules:
- Alt text must be factual — describe what is VISIBLE, not what you assume
- Include location names only if identifiable from the image
- For decorative/atmospheric shots, note that in the description
- Return ONLY the JSON object, no markdown fences
```

### G4b. Vision Cataloging for UI Uploads

When a user uploads a file directly through the UI (via the `POST /api/photos/drive-upload` endpoint), the system should **automatically trigger AI Vision cataloging** (the same G4 logic) on the newly uploaded file. This ensures every photo entering the library has an initial description and alt-text, regardless of whether it came from Drive browsing or a direct UI upload.

**Flow:**
1. User picks a file in the Photo Manager UI → hits "Upload Photo"
2. `POST /api/photos/drive-upload` receives the file as `multipart/form-data`
3. Route uploads the file to Google Drive (BWC photos folder), stores the resulting `driveFileId` and `driveUrl`
4. Route creates a new `Photo` record in the database
5. Route **automatically calls the AI Vision describe logic** (same as `POST /api/photos/describe`) using the newly created photo's Drive URL
6. Route saves the AI-generated `altText`, `description`, and `suggestedCategory` to the photo record
7. Returns the fully cataloged photo with AI-generated metadata

This means every UI-uploaded photo arrives "ready" in the Available Library with a base description that Claude can later rewrite for SEO targeting.

### G5. API Routes (updated)

### G5b. Direct Upload Route — `POST /api/photos/drive-upload`

**`src/app/api/photos/drive-upload/route.ts`**

Accepts `multipart/form-data` with a single image file. Uploads the file to the BWC Google Drive photos folder using the Google Drive API (service account), then catalogs it in the database with AI Vision descriptions.

```typescript
// POST /api/photos/drive-upload
// Body: multipart/form-data with field "file" (image)
// Optional fields: "category", "vineyardName", "season"
// Returns: { success: true, data: Photo } (with AI-generated altText, description)
```

**Implementation approach:**
1. Parse the multipart form data (Next.js `request.formData()`)
2. Validate file type (JPEG, PNG, WebP only) and size (<20MB)
3. Upload to Google Drive using the `googleapis` service account:
   - Target folder: `GOOGLE_DRIVE_PHOTOS_FOLDER_ID` env var
   - Set file name and MIME type
   - Set sharing to "Anyone with the link can view"
4. Create the `Photo` database record with `driveFileId`, `driveUrl`, `filename`
5. Run AI Vision describe (reuse the describe logic from G4) to generate initial `altText`, `description`, `suggestedCategory`
6. Update the photo record with AI results
7. Return the completed photo record

**Env vars required:**
```
GOOGLE_DRIVE_PHOTOS_FOLDER_ID=your-folder-id
GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```

### G5. API Routes (original)

**`src/app/api/photos/route.ts`**

- **GET** — List all photos with optional filters (`?category=vineyard&uploaded=false`)
- **POST** — Catalog a new photo (accepts `driveFileId`, `driveUrl`, `filename`, and optional metadata)

**`src/app/api/photos/[id]/route.ts`**

- **GET** — Get a single photo with its article assignments
- **PATCH** — Update metadata (description, altText, classification, category, vineyardName, season)

**`src/app/api/photos/upload/route.ts`**

- **POST** — Trigger Drive → Cloudinary upload for a specific photo ID
  1. Look up photo's `driveFileId` in DB
  2. Download from Drive via `downloadFromDrive()`
  3. Upload to Cloudinary via `uploadToCloudinary()` with public ID: `blog/{category}/{filename-without-extension}`
  4. Update DB: set `cloudinaryPublicId`, `cloudinaryUrl`, `widthPx`, `heightPx`, `uploadedToCdn = true`
  5. Return updated photo record

### G6. Photo Manager UI

**Layout:** Accessible at `/dashboard/photos`. Three-column card grid.

**`PhotoManager.tsx`:**
- Fetches `GET /api/photos` on mount
- Filter bar: category dropdown, uploaded/not-uploaded toggle, search by filename
- Card grid of `PhotoCard` components
- "Add Photo" button opens a form to catalog a new photo (Drive File ID + URL)
- "Source Drive" external link button in the header area

**`PhotoCard.tsx`:**
- Shows thumbnail (Drive URL for uncataloged, Cloudinary URL for uploaded)
- Displays: filename, category badge, CDN status indicator (✅/⬜), description preview
- "Edit" button expands inline editing for: description, alt text, category, classification, vineyard, season
- "AI Describe" button calls `POST /api/photos/describe` and pre-fills alt text + description
- "Upload to CDN" button calls `POST /api/photos/upload` (only shown when `uploadedToCdn === false`)
- "Used in" shows list of article titles that reference this photo

**`PhotoSelector.tsx`:**
- Modal component triggered from the article editor
- Shows available photos (filtered by article's topic/hub if possible)
- User clicks photos to select them, assigns positions (hero, inline-1, inline-2, etc.)
- "Confirm" saves selections to `article_photos` table via API
- Returns the `PhotoManifest` for the article store

### G7. Article Store Extension

Add to `src/lib/store/article-store.ts`:

```typescript
// New state fields
photoManifest: PhotoManifest | null;
isPhotoSelectorOpen: boolean;

// New actions
setPhotoManifest: (manifest: PhotoManifest | null) => void;
setIsPhotoSelectorOpen: (open: boolean) => void;
```

The `photoManifest` is loaded when an article is selected (fetched from `article_photos` + `photos` tables). It's passed to the generation request so the orchestrator can include it in the system prompt.

### G8. Orchestrator Wiring — Available Library + Auto-Select + SEO Dynamic Metadata

#### G8a. PhotoManifest Redesign — "Available Library"

The `PhotoManifest` (Layer 6) is redesigned to include the **full Available Library** of all cataloged photos — not just user-pre-selected ones. This enables Claude to autonomously select the best photos based on article context.

**Updated `PhotoManifest` interface** (in `src/types/photo.ts`):

```typescript
export interface PhotoManifest {
  photos: Photo[];           // ALL cataloged photos in the library
  heroPhotoId: number | null; // User can optionally pre-assign hero; null = let Claude pick
  totalAvailable: number;     // Total count of library photos
}
```

The orchestrator builds this by querying ALL photos from the `photos` table (not just `article_photos` selections). User-selected photos via `PhotoSelector` are treated as **hints** (hero assignment), but Claude sees the entire library.

#### G8b. Prompt Assembly — Auto-Select Instructions

The `buildLayerPhotoManifest()` function in `src/lib/prompt-assembly/layer-photo-manifest.ts` is rewritten to:

1. List every photo in the Available Library with its ID, filename, category, base description, alt text, classification, dimensions, and CDN/Drive URL
2. Instruct Claude to **Auto-Select** the most appropriate photos based on:
   - Article keywords and topic
   - Section content relevance
   - Photo category match (vineyard photos for vineyard sections, etc.)
   - Image diversity (avoid using the same photo twice)
3. Tell Claude to select a hero image and 2–5 inline images (depending on article type)

**Updated prompt instructions block:**

```
AUTO-SELECT INSTRUCTIONS:
- You have access to the full photo library below. Select the most relevant photos for this article.
- Choose 1 hero image and appropriate inline images based on article type:
  Hub: 5-8 images total | Spoke: 3-5 images total | News: 1-3 images total
- Match photos to sections by relevance: vineyard photos near vineyard discussion, winemaking photos near process descriptions, etc.
- Use Photo IDs in your ImagePlacement nodes. Set photoId to the selected photo's ID.
- If no suitable photo exists for a section, omit the image node — do NOT hallucinate photo IDs.
- Hero photo: if heroPhotoId is pre-assigned, use it. Otherwise, select the most impactful/relevant photo.
```

#### G8c. SEO Dynamic Metadata — Alt Tag & Caption Rewriting

Claude must NOT simply copy the library's base `altText` and `description` into the article. Instead, the prompt instructs Claude to **rewrite** them to target the article's specific SEO keywords.

**Updated prompt instructions (appended to Layer 6):**

```
SEO DYNAMIC METADATA — CRITICAL:
- Do NOT copy the library's base alt-text verbatim into your ImagePlacement nodes.
- REWRITE each selected photo's alt text to incorporate this article's target SEO keywords and context.
- Example: Library base alt = "Grape clusters on vines at Bajo vineyard"
  Article keyword = "organic winemaking Bhutan"
  Rewritten alt = "Organic grape clusters ripening on sustainably managed vines at Bajo vineyard in Bhutan"
- The same applies to captions: rewrite them to reinforce the article's SEO focus, not the generic library description.
- Alt text rules still apply: 10-25 words, factual (describe what is VISIBLE), include location if identifiable.
- Captions should add editorial context that supports the article's narrative and SEO targets.
```

#### G8d. Client-Side Wiring

The client side (ChatPanel.tsx or generation request builder) must include the `photoManifest` from the store:

```typescript
const photoManifest = useArticleStore((s) => s.photoManifest);
// Include in the fetch body when calling /api/articles/generate
body: JSON.stringify({
  articleId: ...,
  userMessage: ...,
  conversationHistory: ...,
  currentDocument: ...,
  photoManifest,  // ← wire this — now contains full Available Library
})
```

### G9. AppShell Updates

Add to the AppShell header (between ArticleSelector and spacer):

1. **Photo Manager tab** — navigates to `/dashboard/photos`
2. **Source Drive link** — external link to `GOOGLE_DRIVE_PHOTOS_FOLDER_URL` (opens in new tab)

Both use lucide-react icons (`Image` for photos, `ExternalLink` for Drive).

### G10. Env Vars

Add to `src/lib/env.ts`:

```typescript
CLOUDINARY_API_KEY: optionalEnv('CLOUDINARY_API_KEY', ''),
CLOUDINARY_API_SECRET: optionalEnv('CLOUDINARY_API_SECRET', ''),
GOOGLE_DRIVE_PHOTOS_FOLDER_URL: optionalEnv('GOOGLE_DRIVE_PHOTOS_FOLDER_URL', ''),
```

Add to `.env.example`:

```
CLOUDINARY_UPLOAD_PRESET=blog
GOOGLE_DRIVE_PHOTOS_FOLDER_URL=https://drive.google.com/drive/folders/YOUR_FOLDER_ID
```

---

## H. Step-by-Step Execution Plan

### Phase 1: Dependencies & Configuration (Steps 1–2)

**Step 1: Install npm packages**

```bash
npm install cloudinary googleapis
```

**Verify:** `npm ls cloudinary` shows the package. `npm ls googleapis` shows the package.

**Step 2: Update env.ts and .env.example**

Add to `src/lib/env.ts`:
```typescript
CLOUDINARY_API_KEY: optionalEnv('CLOUDINARY_API_KEY', ''),
CLOUDINARY_API_SECRET: optionalEnv('CLOUDINARY_API_SECRET', ''),
GOOGLE_DRIVE_PHOTOS_FOLDER_URL: optionalEnv('GOOGLE_DRIVE_PHOTOS_FOLDER_URL', ''),
```

Add to `.env.example` (after existing Cloudinary vars):
```
CLOUDINARY_UPLOAD_PRESET=blog
GOOGLE_DRIVE_PHOTOS_FOLDER_URL=https://drive.google.com/drive/folders/YOUR_FOLDER_ID
```

**Verify:** `npx tsc --noEmit` passes.

---

### Phase 2: Type Extension & Renderer Fix (Steps 3–5) — CRITICAL

**Step 3: Extend `ImagePlacement` type**

In `src/types/article.ts`, add `cloudinaryPublicId` to `ImagePlacement`:

```typescript
export interface ImagePlacement {
  photoId: number | null;
  cloudinaryPublicId: string | null;  // Cloudinary public ID for CDN URL
  src: string;
  alt: string;
  caption: string | null;
  classification: "informative" | "decorative";
  width: number | null;
  height: number | null;
}
```

**Verify:** `npx tsc --noEmit` — this WILL produce errors in code that constructs `ImagePlacement` objects without the new field. Fix those in Step 4.

**Step 4: Fix renderer `renderImage()` in `src/lib/renderer/components.ts`**

Change lines 34–39 from:

```typescript
const src = placement.photoId
  ? buildCloudinaryUrl(`blog/${placement.photoId}`, {
      width: placement.width || 1200,
    })
  : placement.src;
```

To:

```typescript
const src = placement.cloudinaryPublicId
  ? buildCloudinaryUrl(placement.cloudinaryPublicId, {
      width: placement.width || 1200,
    })
  : placement.src;
```

**Step 5: Fix JSON-LD hero image URL in `src/lib/renderer/jsonld.ts`**

Change the hero URL construction from:

```typescript
const heroUrl = doc.heroImage
  ? doc.heroImage.src || buildCloudinaryUrl(doc.heroImage.photoId ? `blog/${doc.heroImage.photoId}` : null)
  : undefined;
```

To:

```typescript
const heroUrl = doc.heroImage
  ? (doc.heroImage.cloudinaryPublicId
      ? buildCloudinaryUrl(doc.heroImage.cloudinaryPublicId, { width: 1200 })
      : doc.heroImage.src)
  : undefined;
```

**Step 5b: Fix all `ImagePlacement` construction sites**

Search the codebase for any code that creates `ImagePlacement` objects and add `cloudinaryPublicId: null` to them. Key locations:
- `src/lib/article-schema/schema.ts` — Zod schema for ImagePlacement (add `cloudinaryPublicId: z.string().nullable()`)
- `src/lib/article-schema/repair.ts` — if it constructs ImagePlacement defaults
- `src/lib/orchestration/streaming-parser.ts` — if it constructs ImagePlacement from Claude's output
- `src/lib/prompt-assembly/layer-template-ref.ts` — update IMAGE PLACEMENT reference to include `cloudinaryPublicId`
- `src/lib/qa/patch-prompt.ts` — update ImagePlacement format to include `cloudinaryPublicId`
- Any test fixtures that create ImagePlacement objects

**Step 5c: Rewrite `buildLayerPhotoManifest()` for Available Library + Auto-Select + SEO rewriting**

Rewrite `src/lib/prompt-assembly/layer-photo-manifest.ts` to implement:
1. List ALL photos in the library (not just selected ones)
2. Add Auto-Select instructions for Claude to pick contextually relevant photos
3. Add SEO Dynamic Metadata instructions for alt-text and caption rewriting
(See §G8b and §G8c for the full prompt text)

**Verify:** `npx tsc --noEmit` passes with zero errors. `npx next lint` passes. Run `npm run build` to confirm no build errors.

> **COMMIT HERE:** `feat: extend ImagePlacement with cloudinaryPublicId, fix renderer URL resolution, add auto-select + SEO rewrite to photo manifest layer`

---

### Phase 3: Cloudinary Upload Module (Steps 6–8)

**Step 6: Expand `src/lib/cloudinary/client.ts`**

Keep the existing `cloudinaryConfig` export. Add the SDK initialization:

```typescript
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

export const cloudinaryConfig = {
  url: process.env.CLOUDINARY_URL || '',
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'blog',
};

let configured = false;

export function getCloudinaryClient(): typeof cloudinary {
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}
```

**Step 7: Create `src/lib/cloudinary/upload.ts`**

Implement the signed upload function as described in §G3.

**Step 8: Create `src/lib/cloudinary/drive-downloader.ts`**

Implement the Drive download function as described in §G3. This uses the public download URL pattern. For production use with private files, the `googleapis` SDK can be used with a service account.

**Create `src/lib/cloudinary/index.ts`:**

```typescript
export { cloudinaryConfig, getCloudinaryClient } from "./client";
export { uploadToCloudinary } from "./upload";
export type { CloudinaryUploadResult } from "./upload";
export { downloadFromDrive } from "./drive-downloader";
```

**Verify:** `npx tsc --noEmit` passes.

> **COMMIT HERE:** `feat: add Cloudinary SDK upload and Drive download modules`

---

### Phase 4: Photo API Routes (Steps 9–12)

**Step 9: Create `src/app/api/photos/route.ts`**

Follow the `content-map/route.ts` pattern exactly:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

// Zod schema for POST /api/photos (catalog a new photo)
const CatalogPhotoSchema = z.object({
  driveFileId: z.string().min(1),
  driveUrl: z.string().url(),
  filename: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),
  altText: z.string().optional(),
  classification: z.enum(["informative", "decorative"]).default("informative"),
  vineyardName: z.string().optional(),
  season: z.string().optional(),
});

const photoSelect = {
  id: true,
  driveFileId: true,
  driveUrl: true,
  cloudinaryPublicId: true,
  cloudinaryUrl: true,
  filename: true,
  category: true,
  description: true,
  altText: true,
  classification: true,
  vineyardName: true,
  season: true,
  widthPx: true,
  heightPx: true,
  uploadedToCdn: true,
  createdAt: true,
};

// GET /api/photos — List all photos (with optional filters)
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "editor", "viewer");
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const uploaded = url.searchParams.get("uploaded");

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (uploaded === "true") where.uploadedToCdn = true;
    if (uploaded === "false") where.uploadedToCdn = false;

    const photos = await prisma.photo.findMany({
      where,
      select: photoSelect,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: photos });
  } catch (error) {
    // Standard auth + error handling (copy from content-map pattern)
  }
}

// POST /api/photos — Catalog a new photo from Drive
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const parsed = CatalogPhotoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    // Check for duplicate Drive file ID
    const existing = await prisma.photo.findUnique({
      where: { driveFileId: parsed.data.driveFileId },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Photo with this Drive file ID already cataloged" } },
        { status: 409 }
      );
    }

    const photo = await prisma.photo.create({
      data: parsed.data,
      select: photoSelect,
    });

    return NextResponse.json({ success: true, data: photo }, { status: 201 });
  } catch (error) {
    // Standard auth + error handling
  }
}
```

**Step 10: Create `src/app/api/photos/[id]/route.ts`**

Follow the `content-map/[id]/route.ts` pattern. Include GET and PATCH.

PATCH accepts: `description`, `altText`, `category`, `classification`, `vineyardName`, `season`.

**Step 11: Create `src/app/api/photos/upload/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { downloadFromDrive } from "@/lib/cloudinary/drive-downloader";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";

// POST /api/photos/upload — Upload a photo from Drive to Cloudinary
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const photoId = body.photoId;

    if (!photoId || typeof photoId !== "number") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "photoId is required" } },
        { status: 400 }
      );
    }

    // 1. Look up the photo
    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Photo not found" } },
        { status: 404 }
      );
    }

    if (photo.uploadedToCdn) {
      return NextResponse.json({
        success: true,
        data: photo,
      });
    }

    // 2. Download from Drive
    const buffer = await downloadFromDrive(photo.driveFileId);

    // 3. Build public ID: blog/{category}/{filename-without-extension}
    const baseName = photo.filename.replace(/\.[^.]+$/, "");
    const category = photo.category || "uncategorized";
    const publicId = `blog/${category}/${baseName}`;

    // 4. Upload to Cloudinary
    const result = await uploadToCloudinary(buffer, { publicId });

    // 5. Update database
    const updated = await prisma.photo.update({
      where: { id: photoId },
      data: {
        cloudinaryPublicId: result.publicId,
        cloudinaryUrl: result.secureUrl,
        widthPx: result.width,
        heightPx: result.height,
        uploadedToCdn: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    if (message.startsWith("CLOUDINARY_ERROR")) {
      return NextResponse.json(
        { success: false, error: { code: "CLOUDINARY_ERROR", message } },
        { status: 502 }
      );
    }
    if (message.startsWith("DRIVE_DOWNLOAD_FAILED")) {
      return NextResponse.json(
        { success: false, error: { code: "CLOUDINARY_ERROR", message } },
        { status: 502 }
      );
    }
    // Standard auth + error handling
  }
}
```

**Step 11b: Create `src/app/api/photos/drive-upload/route.ts`**

Direct UI file upload → Google Drive + auto-catalog + AI Vision describe:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { google } from "googleapis";
import { Readable } from "stream";
import { getClaudeClient, getModelId } from "@/lib/claude/client";

// POST /api/photos/drive-upload — Upload file from UI to Google Drive, catalog, AI describe
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = formData.get("category") as string | null;
    const vineyardName = formData.get("vineyardName") as string | null;
    const season = formData.get("season") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "file is required" } },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Only JPEG, PNG, WebP allowed" } },
        { status: 400 }
      );
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "File must be under 20MB" } },
        { status: 400 }
      );
    }

    // 1. Upload to Google Drive
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY || "{}");
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    const drive = google.drive({ version: "v3", auth });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const driveResponse = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [process.env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID || ""],
      },
      media: {
        mimeType: file.type,
        body: Readable.from(fileBuffer),
      },
      fields: "id,webViewLink,webContentLink",
    });

    const driveFileId = driveResponse.data.id!;
    const driveUrl = driveResponse.data.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;

    // Set sharing to "Anyone with the link"
    await drive.permissions.create({
      fileId: driveFileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // 2. Create Photo record
    const photo = await prisma.photo.create({
      data: {
        driveFileId,
        driveUrl,
        filename: file.name,
        category: category || null,
        vineyardName: vineyardName || null,
        season: season || null,
        classification: "informative",
      },
    });

    // 3. Auto-run AI Vision describe (G4 logic)
    // ... (reuse describe logic — call Claude with the Drive thumbnail URL)
    // Update photo with AI-generated altText, description, suggestedCategory

    return NextResponse.json({ success: true, data: photo }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
```

**Step 12: Create `src/app/api/photos/describe/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getClaudeClient, getModelId } from "@/lib/claude/client";
import { z } from "zod";

const DescribeSchema = z.object({
  photoId: z.number().int().positive(),
});

// POST /api/photos/describe — AI Vision analysis for alt-text generation
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const parsed = DescribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "photoId required", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    // Fetch the photo record
    const photo = await prisma.photo.findUnique({ where: { id: parsed.data.photoId } });
    if (!photo) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Photo not found" } },
        { status: 404 }
      );
    }

    // Get the image URL — prefer Cloudinary (if uploaded), fall back to Drive
    const imageUrl = photo.cloudinaryUrl || photo.driveUrl;

    // Call Claude with vision
    const client = getClaudeClient();
    const response = await client.messages.create({
      model: getModelId(),
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
            {
              type: "text",
              text: `You are an image analyst for Bhutan Wine Company's blog content engine.
Analyze this photo and return a JSON object with exactly these fields:

{
  "altText": "10-25 word descriptive alt text for SEO. Be specific about vineyard locations, grape varieties, wine processes, or cultural elements visible.",
  "description": "1-2 sentence description of the image content for content writers.",
  "suggestedCategory": "vineyard|winemaking|culture|team|food|landscape"
}

Rules:
- Alt text must describe what is VISIBLE, not assumed
- For atmospheric/decorative shots, note that in the description
- Return ONLY the JSON object`,
            },
          ],
        },
      ],
    });

    // Parse the JSON response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { success: false, error: { code: "GENERATION_FAILED", message: "No text response from Claude" } },
        { status: 500 }
      );
    }

    // Extract JSON from response (handle possible markdown fences)
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const result = JSON.parse(jsonText);

    return NextResponse.json({
      success: true,
      data: {
        altText: result.altText || "",
        description: result.description || "",
        suggestedCategory: result.suggestedCategory || "uncategorized",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI describe failed";
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message } },
      { status: 500 }
    );
  }
}
```

**Verify:** `npx tsc --noEmit` passes. `npm run build` compiles all new routes.

> **COMMIT HERE:** `feat: add photo API routes with CRUD, upload, and AI describe endpoints`

---

### Phase 5: Photo Manager UI (Steps 13–16)

**Step 13: Create `src/app/(dashboard)/photos/page.tsx`**

```typescript
import { PhotoManager } from "@/components/photo-manager";

export default function PhotosPage() {
  return <PhotoManager />;
}
```

**Step 14: Create `src/components/photo-manager/PhotoCard.tsx`**

A card component that displays:
- Thumbnail image (Drive URL or Cloudinary URL)
- Filename, category badge, CDN status (✅ or ⬜)
- Description and alt text (truncated)
- Action buttons: "Edit", "AI Describe", "Upload to CDN"
- Inline editing form (expanded when "Edit" is clicked)
- "AI Describe" calls `POST /api/photos/describe` and pre-fills fields

Use inline styles (matching existing component patterns), lucide-react icons.

**Step 15: Create `src/components/photo-manager/PhotoManager.tsx`**

Main view that:
- Fetches `GET /api/photos` on mount
- Renders filter bar (category dropdown, CDN status filter, filename search)
- Renders a grid of `PhotoCard` components
- Has "Add Photo" button that shows a form to catalog a new photo
- Shows summary stats: total photos, uploaded to CDN count, needing description count

**Step 16: Create `src/components/photo-manager/PhotoSelector.tsx`**

A modal overlay (similar to the scorecard panel pattern) that:
- Fetches available photos for selection
- Shows a grid of selectable photo cards
- Allows assigning positions: hero, inline-1, inline-2, etc.
- "Confirm" saves to `article_photos` table via API calls
- Returns updated `PhotoManifest` to the article store

**Create `src/components/photo-manager/index.ts`:**

```typescript
export { PhotoManager } from "./PhotoManager";
export { PhotoCard } from "./PhotoCard";
export { PhotoSelector } from "./PhotoSelector";
```

**Verify:** `npm run build` compiles the new page and components.

> **COMMIT HERE:** `feat: add Photo Manager UI with PhotoCard, PhotoManager, and PhotoSelector`

---

### Phase 6: Dashboard Integration (Steps 17–19)

**Step 17: Update AppShell header**

In `src/components/layout/AppShell.tsx`, add navigation items between `ArticleSelector` and the spacer:

```tsx
import { Image, ExternalLink } from "lucide-react";
import Link from "next/link";
import { env } from "@/lib/env";

// Inside the header, after ArticleSelector:
<Link
  href="/dashboard/photos"
  style={{
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    fontSize: "13px",
    color: "#414141",
    textDecoration: "none",
    borderRadius: "4px",
  }}
>
  <Image style={{ width: "14px", height: "14px" }} />
  Photos
</Link>

{process.env.NEXT_PUBLIC_GOOGLE_DRIVE_PHOTOS_FOLDER_URL && (
  <a
    href={process.env.NEXT_PUBLIC_GOOGLE_DRIVE_PHOTOS_FOLDER_URL}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: "flex",
      alignItems: "center",
      gap: "4px",
      padding: "4px 8px",
      fontSize: "13px",
      color: "#bc9b5d",
      textDecoration: "none",
    }}
  >
    <ExternalLink style={{ width: "12px", height: "12px" }} />
    Source Drive
  </a>
)}
```

> **Note:** For the Source Drive link, use `NEXT_PUBLIC_GOOGLE_DRIVE_PHOTOS_FOLDER_URL` (the `NEXT_PUBLIC_` prefix makes it available in client components). Add this to `.env.example` and `.env`.

**Step 18: Update article store with photo state**

Add to `src/lib/store/article-store.ts`:

In the state interface (add to `ArticleEditorState` in `src/types/ui.ts`):
```typescript
photoManifest: PhotoManifest | null;
isPhotoSelectorOpen: boolean;
```

In the actions interface:
```typescript
setPhotoManifest: (manifest: PhotoManifest | null) => void;
setIsPhotoSelectorOpen: (open: boolean) => void;
```

In `initialState`:
```typescript
photoManifest: null,
isPhotoSelectorOpen: false,
```

In the store `create()`:
```typescript
setPhotoManifest: (manifest) => set({ photoManifest: manifest }),
setIsPhotoSelectorOpen: (open) => set({ isPhotoSelectorOpen: open }),
```

**Step 19: Wire photo manifest to generation request**

Find where `ChatPanel.tsx` (or the generation request handler) builds the fetch body for `/api/articles/generate`. Add `photoManifest` to the request body:

```typescript
const photoManifest = useArticleStore((s) => s.photoManifest);

// In the fetch call:
body: JSON.stringify({
  articleId,
  userMessage,
  conversationHistory,
  currentDocument,
  photoManifest,  // Now passes real photo data to Layer 6
}),
```

**Verify:** `npm run build` passes. The Photo Manager page loads at `/dashboard/photos`. The AppShell shows "Photos" and "Source Drive" links.

> **COMMIT HERE:** `feat: integrate Photo Manager into dashboard, wire photo manifest to generation`

---

### Phase 7: Integration Test (Step 20)

**Step 20: Create `scripts/test-guide-9.ts`**

```typescript
// Test plan:
// 1. POST /api/photos — catalog a test photo (using a known Drive file ID)
// 2. GET /api/photos — verify the photo appears in the list
// 3. PATCH /api/photos/[id] — update description and alt text
// 4. GET /api/photos/[id] — verify updates
// 5. POST /api/photos/upload — upload to Cloudinary (if Drive file is accessible)
// 6. GET /api/photos/[id] — verify cloudinaryPublicId and uploadedToCdn are set
// 7. POST /api/photos/describe — test AI describe endpoint
// 8. Verify buildCloudinaryUrl() works with real public IDs
// 9. Verify renderer produces correct CDN URLs when cloudinaryPublicId is set
```

**Verify:** Run `npx tsx scripts/test-guide-9.ts` — all tests pass.

> **COMMIT HERE:** `test: add Guide 9 integration test for photo pipeline`

---

## I. Gate Checks

### Lint & Type Gate

```bash
npx tsc --noEmit          # Zero type errors
npx next lint              # Zero lint errors
npx prisma validate        # Schema valid (no changes, but verify)
```

### Integration Gate

```bash
npx tsx scripts/test-guide-9.ts
```

Expected output:
- Photo cataloged successfully
- Photo metadata updated
- Cloudinary upload successful (if Drive file accessible)
- AI describe returns valid JSON with altText, description, suggestedCategory
- Renderer produces correct Cloudinary CDN URLs
- API response format matches `{ success: true, data: {...} }`

### Human Gate

```
npm run dev → navigate to /dashboard/photos:
1. Does the Photo Manager page load?
2. Click "Add Photo" — can you catalog a photo with a Drive file ID?
3. Click "AI Describe" — does it return sensible alt-text?
4. Click "Edit" — can you update description, alt text, category?
5. Click "Upload to CDN" — does it upload to Cloudinary and show ✅?
6. Go to the article editor — does the "Photos" button appear?
7. Does the AppShell header show "Photos" nav and "Source Drive" link?
8. Does "Source Drive" open Google Drive in a new tab?
```

---

## J. Acceptance Criteria

1. ✅ `cloudinary` package installed and Cloudinary SDK initializes with correct credentials
2. ✅ `POST /api/photos` catalogs a new photo in the database
3. ✅ `PATCH /api/photos/[id]` updates photo metadata
4. ✅ `POST /api/photos/upload` downloads from Drive and uploads to Cloudinary, returning CDN URL
5. ✅ `POST /api/photos/describe` uses Claude Vision to generate alt-text and description
6. ✅ **NEW: `POST /api/photos/drive-upload` accepts UI file uploads, pushes to Drive, catalogs, and auto-runs AI Vision**
7. ✅ Renderer uses `cloudinaryPublicId` (not numeric ID) for CDN URL construction
8. ✅ JSON-LD schema uses correct hero image URL
9. ✅ Photo Manager UI shows photo library with filter, edit, upload, and **direct UI upload** actions
10. ✅ PhotoSelector allows assigning photos to articles with position assignments
11. ✅ AppShell header shows "Photos" navigation and "Source Drive" external link
12. ✅ **NEW: Photo manifest Layer 6 sends the full Available Library to Claude (all cataloged photos)**
13. ✅ **NEW: Prompt assembly includes Auto-Select instructions for Claude to pick contextually relevant photos**
14. ✅ **NEW: Prompt assembly includes SEO Dynamic Metadata instructions — Claude rewrites alt/captions per article keywords**
15. ✅ **NEW: Direct UI uploads auto-trigger Vision cataloging for initial descriptions**
16. ✅ `npm run build` compiles with zero errors
17. ✅ All existing QA image checks (W14, W15, W17, W20, W21) continue to work

---

## K. Risks and Failure Modes

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Drive download fails (permissions) | Medium | Medium — upload blocked | Fall back to "file not accessible" error. User must ensure file is shared with "Anyone with the link." Show clear error message with instructions. |
| Cloudinary upload times out | Low | Medium — CDN upload fails | Set 30s timeout. Retry once. If both fail, return clear error. Photo stays with `uploadedToCdn = false`. |
| Claude Vision hallucates alt-text | Medium | Low — user reviews before saving | AI Describe is a SUGGESTION — user always reviews and edits before confirming. Show "AI-suggested" badge on auto-generated text. |
| ImagePlacement type change breaks existing code | Medium | High — type errors cascade | Search ALL construction sites for ImagePlacement before adding the field. Add `cloudinaryPublicId: null` default everywhere. Run `tsc` after each change. |
| Large image upload exceeds memory | Low | Medium — server crash | Cloudinary SDK streams the upload. Drive download uses `arrayBuffer()` which loads into memory — acceptable for typical blog photos (2–10MB). For very large files (>50MB), consider streaming in a future enhancement. |
| `CLOUDINARY_API_SECRET` missing in env | Low | High — all uploads fail | Check at SDK init time. Throw clear error: "CLOUDINARY_API_SECRET not configured". |
| Claude picks wrong photos (Auto-Select) | Medium | Low — user can override | Auto-Select is a suggestion. PhotoSelector still allows manual override. Claude instructions emphasize relevance matching. |
| SEO alt-text rewrite loses factual accuracy | Medium | Medium — accessibility issue | Prompt explicitly says "factual, describe what is VISIBLE." QA checks W14/W17 still validate alt-text length. |
| Large photo library slows token budget | Low | Medium — prompt too long | Cap Available Library at 50 photos in prompt. Paginate or filter if library grows larger. |
| Google Drive service account auth fails | Medium | Medium — UI uploads blocked | Fall back to "Upload to Drive" being disabled with clear error. Manual Drive + catalog path still works. |

---

## L. Appendix: Cloudinary Upload Preset Details

From integration verifier:

| Setting | Value |
|---|---|
| Preset name | `blog` |
| Type | SIGNED |
| Overwrite | enabled |
| use_filename_as_display_name | enabled |
| Asset folder | `blog` |
| Cloud name | `deahtb4kj` |

**CDN URL pattern:**
```
https://res.cloudinary.com/deahtb4kj/image/upload/w_1200,f_auto,q_auto/blog/vineyards/bajo-harvest-2024
```

**Transform presets:**
| Usage | Transform | Example Width |
|---|---|---|
| Hero image | `w_1200,f_auto,q_auto` | 1200px |
| Inline image | `w_800,f_auto,q_auto` | 800px |
| Decorative | `w_1200,f_auto,q_30` | 1200px (lower quality) |
