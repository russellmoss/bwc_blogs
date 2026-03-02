/**
 * Integration test for Guide 4: Canonical Article Schema + Article Renderer
 *
 * Run with: npx tsx scripts/test-guide-4.ts
 *
 * Tests:
 * 1. Zod schema — valid doc passes, invalid fails
 * 2. Repair — fixes common LLM issues
 * 3. Validation — SOP FAIL-level checks
 * 4. Renderer — produces valid HTML with correct structure
 * 5. Cloudinary URL builder
 * 6. JSON-LD schema builder
 * 7. API endpoints (if dev server running)
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load .env from project root BEFORE importing modules that read env
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
  // Dynamic imports AFTER env is loaded
  const { validateCanonicalDocument } = await import(
    "../src/lib/article-schema"
  );
  const { repairCanonicalDocument } = await import(
    "../src/lib/article-schema"
  );
  const { CanonicalArticleDocumentSchema } = await import(
    "../src/lib/article-schema"
  );
  const { renderArticle } = await import("../src/lib/renderer");
  const { buildCloudinaryUrl } = await import("../src/lib/renderer");
  const { buildSchemaJson } = await import("../src/lib/renderer");

  // Load sample fixture
  const fixturePath = path.resolve(
    __dirname,
    "fixtures/sample-canonical-doc.json"
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

  console.log("\n=== Guide 4 Integration Tests ===\n");

  // ─── Test 1: Zod schema validation ─────────────────────────────
  console.log("1. Zod schema validation");

  const zodResult = CanonicalArticleDocumentSchema.safeParse(fixture);
  check("Valid fixture passes Zod schema", zodResult.success);

  const invalidDoc = { ...fixture, title: "" };
  const invalidResult = CanonicalArticleDocumentSchema.safeParse(invalidDoc);
  check("Empty title fails Zod schema", !invalidResult.success);

  const noSections = { ...fixture, sections: [] };
  const noSectionsResult = CanonicalArticleDocumentSchema.safeParse(noSections);
  check("Empty sections array fails Zod schema", !noSectionsResult.success);

  // ─── Test 2: Repair pass ───────────────────────────────────────
  console.log("\n2. Repair pass");

  // Test repair of missing optional fields
  const brokenDoc = { ...fixture };
  delete (brokenDoc as Record<string, unknown>).faq;
  delete (brokenDoc as Record<string, unknown>).version;
  delete (brokenDoc as Record<string, unknown>).dataNosnippetSections;

  const repairResult = repairCanonicalDocument(brokenDoc);
  check("Repair returns repaired document", !!repairResult.repaired);
  check("Repair reports changes", repairResult.changes.length > 0, `${repairResult.changes.length} changes`);
  check("Repair notes input was invalid", !repairResult.valid);
  check("Repaired doc has faq array", Array.isArray(repairResult.repaired.faq));
  check('Repaired doc has version "1.0"', repairResult.repaired.version === "1.0");

  // Test duplicate section IDs
  const dupSections = JSON.parse(JSON.stringify(fixture));
  dupSections.sections[1].id = dupSections.sections[0].id;
  const dupResult = repairCanonicalDocument(dupSections);
  const sectionIds = dupResult.repaired.sections.map((s: { id: string }) => s.id);
  const uniqueIds = new Set(sectionIds);
  check("Duplicate section IDs get renamed", uniqueIds.size === sectionIds.length);

  // ─── Test 3: SOP validation checks ─────────────────────────────
  console.log("\n3. SOP validation checks");

  const validationResult = validateCanonicalDocument(fixture);
  check("Sample fixture passes validation", validationResult.valid, validationResult.errors.length > 0 ? validationResult.errors[0].message : undefined);

  // Test meta title length violation
  const shortMeta = { ...fixture, metaTitle: "Too Short" };
  const shortMetaResult = validateCanonicalDocument(shortMeta);
  check("Short meta title fails validation", !shortMetaResult.valid);
  check(
    "Error mentions meta title",
    shortMetaResult.errors.some((e: { path: string }) => e.path === "metaTitle")
  );

  // Test missing author credentials
  const noCredentials = {
    ...fixture,
    author: { ...fixture.author, credentials: "" },
  };
  const noCredResult = validateCanonicalDocument(noCredentials);
  check("Empty credentials fails validation", !noCredResult.valid);

  // ─── Test 4: Renderer ──────────────────────────────────────────
  console.log("\n4. Renderer");

  const renderResult = renderArticle({
    document: fixture,
    htmlOverrides: null,
    templateVersion: "1.0",
  });

  check("Renderer returns html string", typeof renderResult.html === "string" && renderResult.html.length > 0);
  check("Renderer returns metaTitle", renderResult.metaTitle === fixture.metaTitle);
  check("Renderer returns metaDescription", renderResult.metaDescription === fixture.metaDescription);
  check("Renderer returns schemaJson", typeof renderResult.schemaJson === "string" && renderResult.schemaJson.length > 0);
  check("Renderer returns wordCount > 0", renderResult.wordCount > 0, `wordCount = ${renderResult.wordCount}`);

  // HTML structure checks
  check("HTML contains <!DOCTYPE html>", renderResult.html.includes("<!DOCTYPE html>"));
  check("HTML contains <article class=\"bwc-article\">", renderResult.html.includes('<article class="bwc-article">'));
  check("HTML contains <h1", renderResult.html.includes("<h1"));
  check("HTML contains blog-hero header", renderResult.html.includes('class="blog-hero"'));
  check("HTML contains executive summary", renderResult.html.includes("bwc-executive-summary"));
  check("HTML contains Google Fonts link", renderResult.html.includes("fonts.googleapis.com"));
  check("HTML contains CSS variables", renderResult.html.includes("--bwc-gold: #bc9b5d"));
  check("HTML contains JSON-LD", renderResult.html.includes("application/ld+json"));
  check('Hero img has loading="eager"', renderResult.html.includes('loading="eager"'));
  check("HTML contains data-cad-path attributes", renderResult.html.includes("data-cad-path="));

  // ─── Test 5: Cloudinary URL builder ────────────────────────────
  console.log("\n5. Cloudinary URL builder");

  const cdnUrl = buildCloudinaryUrl("blog/test-image", { width: 800, format: "auto", quality: "auto" });
  check("Cloudinary URL contains cloud name", cdnUrl.includes("deahtb4kj") || cdnUrl.includes("res.cloudinary.com"));
  check("Cloudinary URL contains transforms", cdnUrl.includes("w_800"));
  check("Cloudinary URL contains publicId", cdnUrl.includes("blog/test-image"));

  const nullUrl = buildCloudinaryUrl(null);
  check("Null publicId returns empty string", nullUrl === "");

  // ─── Test 6: JSON-LD builder ───────────────────────────────────
  console.log("\n6. JSON-LD builder");

  const schemaOutput = buildSchemaJson(fixture);
  check("Schema contains BlogPosting", schemaOutput.includes("BlogPosting"));
  check("Schema contains FAQPage", schemaOutput.includes("FAQPage"));
  check("Schema contains headline", schemaOutput.includes(fixture.title));
  check("Schema contains author name", schemaOutput.includes(fixture.author.name));

  // ─── Test 7: API endpoints (requires dev server) ───────────────
  console.log("\n7. API endpoints");

  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  try {
    const renderRes = await fetch(`${appUrl}/api/articles/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document: fixture,
        htmlOverrides: null,
        templateVersion: "1.0",
      }),
    });
    check(
      "POST /api/articles/render responds",
      renderRes.status === 200 || renderRes.status === 401
    );

    const validateRes = await fetch(`${appUrl}/api/articles/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: fixture }),
    });
    check(
      "POST /api/articles/validate responds",
      validateRes.status === 200 || validateRes.status === 401
    );

    // Test validate with repair flag
    const repairRes = await fetch(`${appUrl}/api/articles/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: fixture, repair: true }),
    });
    check(
      "POST /api/articles/validate?repair responds",
      repairRes.status === 200 || repairRes.status === 401
    );
  } catch {
    console.log("  SKIP API tests — dev server not running");
    console.log(`       (Start with npm run dev, then re-run this test)`);
  }

  // ─── Summary ───────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

test();
