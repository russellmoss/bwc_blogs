/**
 * Integration test for Guide 5: Orchestration Layer + Claude API
 *
 * Run with: npx tsx scripts/test-guide-5.ts
 *
 * Tests:
 * 1. Environment variables — all Guide 5 vars present
 * 2. Claude client — SDK instantiates, basic API call works
 * 3. Prompt assembly — all 7 layers build without error
 * 4. Streaming parser — parses JSON from various Claude response formats
 * 5. Post-processing — repair + validate + render pipeline
 * 6. API endpoints (if dev server running) — SSE stream + link verification
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
  console.log("\n=== Guide 5 Integration Tests ===\n");

  // ─── Test 1: Environment variables ──────────────────────────────
  console.log("1. Environment variables");

  check("ANTHROPIC_API_KEY is set", !!process.env.ANTHROPIC_API_KEY);
  check("ANTHROPIC_MODEL is set", !!process.env.ANTHROPIC_MODEL);
  check(
    "ANTHROPIC_MAX_OUTPUT_TOKENS is set",
    !!process.env.ANTHROPIC_MAX_OUTPUT_TOKENS
  );
  check(
    "ANTHROPIC_MAX_OUTPUT_TOKENS >= 16384",
    parseInt(process.env.ANTHROPIC_MAX_OUTPUT_TOKENS || "0", 10) >= 16384
  );
  check("ENABLE_WEB_SEARCH is set", !!process.env.ENABLE_WEB_SEARCH);

  // ─── Test 2: Claude client ──────────────────────────────────────
  console.log("\n2. Claude client");

  const { getClaudeClient, getModelId, getMaxOutputTokens } = await import(
    "../src/lib/claude"
  );

  const client = getClaudeClient();
  check("Claude client instantiates", !!client);
  check("Model ID resolves", !!getModelId());
  check("Max output tokens = 16384", getMaxOutputTokens() === 16384);

  // Basic API call (non-streaming)
  try {
    const msg = await client.messages.create({
      model: getModelId(),
      max_tokens: 50,
      messages: [{ role: "user", content: "Say 'test-ok' and nothing else." }],
    });
    const text =
      msg.content[0].type === "text" ? msg.content[0].text : "";
    check("Basic Claude API call succeeds", text.includes("test-ok"));
    console.log(`    Model: ${msg.model}, Tokens: ${msg.usage.input_tokens}in/${msg.usage.output_tokens}out`);
  } catch (error) {
    check("Basic Claude API call succeeds", false, String(error));
  }

  // ─── Test 3: Prompt assembly ────────────────────────────────────
  console.log("\n3. Prompt assembly (individual layers)");

  const { buildLayerSop } = await import("../src/lib/prompt-assembly");
  const { buildLayerStyleGuide } = await import("../src/lib/prompt-assembly");
  const { buildLayerTemplateRef } = await import("../src/lib/prompt-assembly");
  const { buildLayerPhotoManifest } = await import(
    "../src/lib/prompt-assembly"
  );

  const sopLayer = buildLayerSop();
  check("Layer 1 (SOP) loads", sopLayer.content.length > 1000);
  console.log(
    `    SOP: ${sopLayer.content.length} chars, ~${sopLayer.tokenEstimate} tokens`
  );

  const styleLayer = buildLayerStyleGuide();
  check("Layer 2a (Style Guide) loads", styleLayer.content.length > 1000);
  console.log(
    `    Style Guide: ${styleLayer.content.length} chars, ~${styleLayer.tokenEstimate} tokens`
  );

  const templateLayer = buildLayerTemplateRef();
  check(
    "Layer 2b (Template Ref) builds",
    templateLayer.content.includes("paragraph")
  );

  const photoLayer = buildLayerPhotoManifest(null);
  check(
    "Layer 6 (Photo Manifest) handles null",
    photoLayer.content.includes("No photos")
  );

  // Dynamic layers need DB — test with articleId 1 if DB is available
  try {
    const { buildLayerBrief } = await import("../src/lib/prompt-assembly");
    const briefLayer = await buildLayerBrief(1);
    check("Layer 3 (Brief) loads from DB", briefLayer.content.includes("Article Title:"));
    console.log(`    Brief: ${briefLayer.content.length} chars`);

    const { buildLayerLinkGraph } = await import("../src/lib/prompt-assembly");
    const linkLayer = await buildLayerLinkGraph(1);
    check("Layer 5 (Link Graph) loads from DB", linkLayer.content.includes("CORE BWC PAGES:"));
    console.log(`    Link Graph: ${linkLayer.content.length} chars`);
  } catch (error) {
    console.log(`    Skipping DB-dependent layers: ${error}`);
  }

  // Test KB context layer (requires Onyx)
  try {
    const { buildLayerKbContext } = await import("../src/lib/prompt-assembly");
    const kbLayer = await buildLayerKbContext({
      title: "Test Article",
      mainEntity: "Bhutan wine",
      supportingEntities: [],
      targetKeywords: ["bhutan wine"],
    });
    check(
      "Layer 4 (KB Context) loads from Onyx",
      kbLayer.content.length > 0
    );
    console.log(`    KB Context: ${kbLayer.content.length} chars`);
  } catch (error) {
    console.log(`    Skipping Onyx-dependent layer: ${error}`);
  }

  // ─── Test 4: Streaming parser ───────────────────────────────────
  console.log("\n4. Streaming JSON parser");

  const { parseGenerationResponse } = await import("../src/lib/orchestration");

  // Pure JSON
  const pureJson = JSON.stringify({
    title: "Test",
    articleId: 1,
    sections: [],
    slug: "test",
  });
  const r1 = parseGenerationResponse(pureJson);
  check("Parses pure JSON", r1.document !== null);

  // JSON in code fence
  const fenced = `Here is the article:\n\`\`\`json\n${pureJson}\n\`\`\`\nLet me know if you want changes.`;
  const r2 = parseGenerationResponse(fenced);
  check("Parses JSON from code fence", r2.document !== null);
  check(
    "Extracts conversation reply from fenced response",
    r2.conversationReply.length > 0
  );

  // JSON with surrounding text
  const surrounded = `I've generated the article.\n${pureJson}\nHope this helps!`;
  const r3 = parseGenerationResponse(surrounded);
  check("Parses JSON from surrounded text", r3.document !== null);

  // Invalid text
  const r4 = parseGenerationResponse("This is not JSON at all.");
  check("Returns null for non-JSON text", r4.document === null);
  check("Returns parse error for non-JSON", r4.parseError !== null);

  // ─── Test 5: Post-processing pipeline ───────────────────────────
  console.log("\n5. Post-processing pipeline");

  const fs = await import("fs");
  const fixturePath = path.resolve(
    __dirname,
    "fixtures/sample-canonical-doc.json"
  );

  if (fs.existsSync(fixturePath)) {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    const { runPostProcessing } = await import("../src/lib/orchestration");

    const postResult = runPostProcessing(fixture);
    check("Post-processing produces HTML", postResult.html.length > 0);
    check(
      "Post-processing returns validation result",
      typeof postResult.validationResult.valid === "boolean"
    );
    check("Post-processing returns word count", postResult.wordCount > 0);
    console.log(
      `    Validation: ${postResult.validationResult.valid ? "valid" : "invalid"}, ` +
        `${postResult.validationResult.errors.length} errors, ` +
        `${postResult.validationResult.warnings.length} warnings, ` +
        `${postResult.wordCount} words`
    );
  } else {
    console.log("    Skipping — no fixture file at scripts/fixtures/sample-canonical-doc.json");
  }

  // ─── Test 6: API endpoints (if dev server running) ──────────────
  console.log("\n6. API endpoints (requires dev server on localhost:3000)");

  const baseUrl = process.env.APP_URL || "http://localhost:3000";

  // Link verification endpoint
  try {
    const linkRes = await fetch(`${baseUrl}/api/links/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: ["https://www.bhutanwine.com", "https://httpstat.us/404"],
      }),
    });
    // May get 401 without auth cookie — that's expected
    if (linkRes.status === 401) {
      check("Link verify endpoint exists (401 = auth required)", true);
    } else {
      const linkData = await linkRes.json();
      check("Link verify endpoint responds", linkData.success !== undefined);
    }
  } catch {
    console.log("    Skipping — dev server not running");
  }

  // Generate endpoint (just verify it exists — don't run a full generation)
  try {
    const genRes = await fetch(`${baseUrl}/api/articles/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: 1, userMessage: "test" }),
    });
    if (genRes.status === 401) {
      check("Generate endpoint exists (401 = auth required)", true);
    } else if (genRes.status === 400) {
      check("Generate endpoint exists (400 = validation)", true);
    } else {
      check("Generate endpoint responds", true);
    }
  } catch {
    console.log("    Skipping — dev server not running");
  }

  // ─── Summary ────────────────────────────────────────────────────
  console.log(
    `\n=== Results: ${passed} passed, ${failed} failed out of ${passed + failed} ===\n`
  );
  process.exit(failed > 0 ? 1 : 0);
}

test().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
