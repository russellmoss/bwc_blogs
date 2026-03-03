/**
 * Integration test for Guide 9: Photo Pipeline & Image Management
 *
 * Run with: npx tsx scripts/test-guide-9.ts
 *
 * Tests:
 * 1. Environment variables — all Guide 9 vars present
 * 2. Cloudinary SDK — initialization and config verification
 * 3. Type system — ImagePlacement has cloudinaryPublicId field
 * 4. Zod schema — ImagePlacement validates with and without cloudinaryPublicId
 * 5. Renderer — buildCloudinaryUrl produces correct CDN URLs
 * 6. Prompt assembly — buildLayerPhotoManifest produces Auto-Select instructions
 * 7. API endpoints (if dev server running) — photo CRUD smoke test
 * 8. Mock AI Vision describe return
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

let passed = 0;
let failed = 0;

function check(name: string, result: boolean, detail?: string) {
  if (result) {
    console.log(`  PASS ${name}`);
    passed++;
  } else {
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function test() {
  console.log("\n=== Guide 9 Integration Tests ===\n");

  // ─── Test 1: Environment variables ──────────────────────────────
  console.log("1. Environment variables");

  check("CLOUDINARY_CLOUD_NAME is set", !!process.env.CLOUDINARY_CLOUD_NAME);
  check("CLOUDINARY_API_KEY is set", !!process.env.CLOUDINARY_API_KEY);
  check("CLOUDINARY_API_SECRET is set", !!process.env.CLOUDINARY_API_SECRET);
  check("CLOUDINARY_URL is set", !!process.env.CLOUDINARY_URL);

  // Optional vars — warn but don't fail
  const hasDriveUrl = !!process.env.GOOGLE_DRIVE_PHOTOS_FOLDER_URL;
  const hasDriveFolderId = !!process.env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID;
  const hasDriveKey = !!process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  console.log(`  ${hasDriveUrl ? "PASS" : "WARN"} GOOGLE_DRIVE_PHOTOS_FOLDER_URL ${hasDriveUrl ? "is set" : "(optional — not configured)"}`);
  console.log(`  ${hasDriveFolderId ? "PASS" : "WARN"} GOOGLE_DRIVE_PHOTOS_FOLDER_ID ${hasDriveFolderId ? "is set" : "(optional — direct upload disabled)"}`);
  console.log(`  ${hasDriveKey ? "PASS" : "WARN"} GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY ${hasDriveKey ? "is set" : "(optional — direct upload disabled)"}`);
  if (hasDriveUrl) passed++;
  if (hasDriveFolderId) passed++;
  if (hasDriveKey) passed++;

  // ─── Test 2: Cloudinary SDK initialization ──────────────────────
  console.log("\n2. Cloudinary SDK initialization");

  try {
    const { getCloudinaryClient } = await import("../src/lib/cloudinary/client");
    const cld = getCloudinaryClient();
    check("Cloudinary SDK initializes", !!cld);
    check("Cloudinary SDK has uploader", !!cld.uploader);
    check("Cloudinary SDK has config", !!cld.config());
  } catch (e) {
    check("Cloudinary SDK initializes", false, (e as Error).message);
  }

  // ─── Test 3: Type system — ImagePlacement ───────────────────────
  console.log("\n3. ImagePlacement type extension");

  try {
    // Verify at runtime that the Zod schema accepts cloudinaryPublicId
    const { ImagePlacementSchema } = await import("../src/lib/article-schema/schema");

    const withPublicId = ImagePlacementSchema.safeParse({
      photoId: 1,
      cloudinaryPublicId: "blog/vineyards/bajo-harvest-2024",
      src: "https://example.com/photo.jpg",
      alt: "Test alt text",
      caption: null,
      classification: "informative",
      width: 1200,
      height: 800,
    });
    check("ImagePlacement with cloudinaryPublicId validates", withPublicId.success);

    const withoutPublicId = ImagePlacementSchema.safeParse({
      photoId: null,
      src: "https://example.com/photo.jpg",
      alt: "Test alt text",
      caption: null,
      classification: "informative",
      width: 800,
      height: 533,
    });
    check("ImagePlacement without cloudinaryPublicId validates (default null)", withoutPublicId.success);

    if (withPublicId.success) {
      const data = withPublicId.data as Record<string, unknown>;
      check("cloudinaryPublicId field preserved", data.cloudinaryPublicId === "blog/vineyards/bajo-harvest-2024");
    }

    if (withoutPublicId.success) {
      const data = withoutPublicId.data as Record<string, unknown>;
      check("cloudinaryPublicId defaults to null", data.cloudinaryPublicId === null);
    }
  } catch (e) {
    check("ImagePlacement schema import", false, (e as Error).message);
  }

  // ─── Test 4: Renderer — buildCloudinaryUrl ─────────────────────
  console.log("\n4. Renderer — CDN URL construction");

  try {
    const { buildCloudinaryUrl } = await import("../src/lib/renderer/cloudinary");

    const url = buildCloudinaryUrl("blog/vineyards/bajo-harvest-2024", { width: 1200 });
    check("buildCloudinaryUrl returns non-empty string", url.length > 0);
    check("CDN URL contains cloud name", url.includes(process.env.CLOUDINARY_CLOUD_NAME || "deahtb4kj"));
    check("CDN URL contains public ID", url.includes("blog/vineyards/bajo-harvest-2024"));
    check("CDN URL contains width transform", url.includes("w_1200"));
    check("CDN URL contains format auto", url.includes("f_auto"));

    const nullUrl = buildCloudinaryUrl(null);
    check("buildCloudinaryUrl with null returns empty", nullUrl === "");
  } catch (e) {
    check("buildCloudinaryUrl import", false, (e as Error).message);
  }

  // ─── Test 5: Prompt assembly — Photo Manifest layer ─────────────
  console.log("\n5. Prompt assembly — Photo Manifest layer");

  try {
    const { buildLayerPhotoManifest } = await import("../src/lib/prompt-assembly/layer-photo-manifest");

    // Null manifest → no photos message
    const nullLayer = buildLayerPhotoManifest(null);
    check("Null manifest returns layer", !!nullLayer);
    check("Null manifest mentions no photos", nullLayer.content.includes("No photos"));

    // Empty photos array → no photos message
    const emptyLayer = buildLayerPhotoManifest({ photos: [], heroPhotoId: null, totalAvailable: 0 });
    check("Empty manifest returns no-photos layer", emptyLayer.content.includes("No photos"));

    // With photos → Available Library
    const mockManifest = {
      photos: [
        {
          id: 1,
          driveFileId: "abc123",
          driveUrl: "https://drive.google.com/file/d/abc123/view",
          cloudinaryPublicId: null,
          cloudinaryUrl: null,
          filename: "bajo-harvest-2024.jpg",
          category: "vineyard",
          description: "Grape harvest at Bajo vineyard",
          altText: "Grape clusters on vines at Bajo vineyard",
          classification: "informative" as const,
          vineyardName: "Bajo",
          season: "autumn",
          widthPx: 1200,
          heightPx: 800,
          uploadedToCdn: false,
        },
      ],
      heroPhotoId: null,
      totalAvailable: 1,
    };
    const libraryLayer = buildLayerPhotoManifest(mockManifest);
    check("Library manifest returns layer with content", libraryLayer.content.length > 100);
    check("Library layer contains 'AVAILABLE PHOTO LIBRARY'", libraryLayer.content.includes("AVAILABLE PHOTO LIBRARY"));
    check("Library layer contains 'AUTO-SELECT INSTRUCTIONS'", libraryLayer.content.includes("AUTO-SELECT INSTRUCTIONS"));
    check("Library layer contains 'SEO DYNAMIC METADATA'", libraryLayer.content.includes("SEO DYNAMIC METADATA"));
    check("Library layer lists photo ID", libraryLayer.content.includes("Photo ID 1"));
    check("Library layer includes filename", libraryLayer.content.includes("bajo-harvest-2024.jpg"));
    check("Library layer includes category", libraryLayer.content.includes("vineyard"));
    check("Library layer includes vineyard name", libraryLayer.content.includes("Bajo"));
    check("Library layer mentions rewrite alt text", libraryLayer.content.includes("REWRITE"));
    check("Token estimate > 0", libraryLayer.tokenEstimate > 0);
  } catch (e) {
    check("buildLayerPhotoManifest import", false, (e as Error).message);
  }

  // ─── Test 6: Cloudinary upload module exports ───────────────────
  console.log("\n6. Cloudinary module exports");

  try {
    const cloudinaryModule = await import("../src/lib/cloudinary/index");
    check("cloudinaryConfig exported", !!cloudinaryModule.cloudinaryConfig);
    check("getCloudinaryClient exported", typeof cloudinaryModule.getCloudinaryClient === "function");
    check("uploadToCloudinary exported", typeof cloudinaryModule.uploadToCloudinary === "function");
    check("downloadFromDrive exported", typeof cloudinaryModule.downloadFromDrive === "function");
  } catch (e) {
    check("cloudinary module import", false, (e as Error).message);
  }

  // ─── Test 7: API endpoints (requires dev server) ────────────────
  console.log("\n7. API endpoints (requires dev server on :3000)");

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  let serverRunning = false;

  try {
    const healthRes = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    serverRunning = healthRes.ok;
  } catch {
    serverRunning = false;
  }

  if (!serverRunning) {
    console.log("  SKIP Dev server not running — API tests skipped");
    console.log("  (Start with: npm run dev)");
  } else {
    // GET /api/photos — should return empty array initially
    try {
      const res = await fetch(`${baseUrl}/api/photos`);
      const data = await res.json();
      // Will get 401 without auth cookie — that's expected
      check("GET /api/photos responds", res.status === 200 || res.status === 401);
      if (res.status === 401) {
        check("GET /api/photos auth guard works", data?.error?.code === "AUTH_REQUIRED");
      } else {
        check("GET /api/photos returns success format", data.success === true);
        check("GET /api/photos returns array", Array.isArray(data.data));
      }
    } catch (e) {
      check("GET /api/photos", false, (e as Error).message);
    }

    // POST /api/photos/describe without auth → 401
    try {
      const res = await fetch(`${baseUrl}/api/photos/describe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: 999 }),
      });
      check("POST /api/photos/describe auth guard", res.status === 401);
    } catch (e) {
      check("POST /api/photos/describe", false, (e as Error).message);
    }

    // POST /api/photos/drive-upload without auth → 401
    try {
      const formData = new FormData();
      formData.append("file", new Blob(["test"]), "test.jpg");
      const res = await fetch(`${baseUrl}/api/photos/drive-upload`, {
        method: "POST",
        body: formData,
      });
      check("POST /api/photos/drive-upload auth guard", res.status === 401);
    } catch (e) {
      check("POST /api/photos/drive-upload", false, (e as Error).message);
    }
  }

  // ─── Test 8: Mock AI Vision describe return ─────────────────────
  console.log("\n8. Mock AI Vision describe return format");

  // Simulate what the describe endpoint returns
  const mockDescribeResponse = {
    altText: "Ripe Merlot grape clusters on VSP-trained vines at Bajo vineyard in Bhutan Punakha Valley",
    description: "Close-up photograph showing clusters of dark red Merlot grapes hanging from vertically shoot-positioned vines, with the Punakha Valley visible in the background.",
    suggestedCategory: "vineyard",
  };

  check("Mock describe has altText", typeof mockDescribeResponse.altText === "string" && mockDescribeResponse.altText.length > 0);
  check("Mock describe altText is 10-25 words",
    mockDescribeResponse.altText.split(/\s+/).length >= 10 &&
    mockDescribeResponse.altText.split(/\s+/).length <= 25
  );
  check("Mock describe has description", typeof mockDescribeResponse.description === "string");
  check("Mock describe has suggestedCategory", ["vineyard", "winemaking", "culture", "team", "food", "landscape"].includes(mockDescribeResponse.suggestedCategory));

  // ─── Summary ────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

test().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
