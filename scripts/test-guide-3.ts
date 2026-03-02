/**
 * Integration test for Guide 3: Onyx RAG Integration
 *
 * Run with: npx tsx scripts/test-guide-3.ts
 *
 * Tests:
 * 1. Onyx connectivity (env config is valid)
 * 2. Health check returns healthy with indexed docs
 * 3. Admin search returns results
 * 4. Query builder generates 3–5 queries
 * 5. Context assembly produces formatted output
 * 6. API endpoints (if dev server running)
 */

import dotenv from "dotenv";
import path from "path";

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
  // Dynamic imports so env is loaded first
  const { getOnyxConfig, searchOnyx, searchOnyxMulti } = await import("../src/lib/onyx");
  const { buildSearchQueries } = await import("../src/lib/onyx");
  const { assembleOnyxContext } = await import("../src/lib/onyx");
  const { checkOnyxHealth } = await import("../src/lib/onyx");

  console.log("\n=== Guide 3 Integration Tests ===\n");

  // ─── Test 1: Onyx connectivity ──────────────────────────────────
  console.log("1. Onyx connectivity");
  const config = getOnyxConfig();
  check(
    "baseUrl is non-empty and not localhost",
    config.baseUrl.length > 0 && !config.baseUrl.includes("localhost"),
    `baseUrl = "${config.baseUrl}"`
  );
  check("apiKey is non-empty", config.apiKey.length > 0);
  check(
    "timeoutMs is a positive number",
    config.timeoutMs > 0,
    `timeoutMs = ${config.timeoutMs}`
  );

  // ─── Test 2: Health check ────────────────────────────────────────
  console.log("\n2. Health check");
  try {
    const health = await checkOnyxHealth();
    check("healthy === true", health.healthy === true, `healthy = ${health.healthy}`);
    check(
      "indexedDocuments is a positive number",
      health.indexedDocuments !== null && health.indexedDocuments > 0,
      `indexedDocuments = ${health.indexedDocuments}`
    );
    check(
      "responseTimeMs is positive",
      health.responseTimeMs > 0,
      `responseTimeMs = ${health.responseTimeMs}ms`
    );
  } catch (error) {
    console.log(`  FAIL Health check threw: ${error}`);
    failed += 3;
  }

  // ─── Test 3: Admin search ────────────────────────────────────────
  console.log("\n3. Admin search");
  try {
    const result = await searchOnyx("Bajo vineyard elevation");
    check("results array is non-empty", result.results.length > 0, `got ${result.results.length} results`);

    if (result.results.length > 0) {
      const first = result.results[0];
      check("first result has documentId", first.documentId.length > 0);
      check("first result has content", first.content.length > 0);
      check("first result has sourceDocument", first.sourceDocument.length > 0);
      check("first result has score", typeof first.score === "number");
    } else {
      console.log("  SKIP first result checks — no results returned");
      failed += 4;
    }

    check(
      "searchTimeMs is positive",
      result.searchTimeMs > 0,
      `searchTimeMs = ${result.searchTimeMs}ms`
    );
  } catch (error) {
    console.log(`  FAIL Admin search threw: ${error}`);
    failed += 6;
  }

  // ─── Test 4: Query builder ───────────────────────────────────────
  console.log("\n4. Query builder");
  const sampleBrief = {
    title: "Bajo Vineyards",
    mainEntity: "Bajo vineyard",
    supportingEntities: ["Merlot", "terroir"],
    targetKeywords: ["Bhutan wine", "high altitude vineyard"],
  };

  const queries = buildSearchQueries(sampleBrief);
  check(
    "returns 3–5 queries",
    queries.length >= 3 && queries.length <= 5,
    `got ${queries.length} queries`
  );

  const lowerQueries = queries.map((q) => q.toLowerCase());
  const uniqueQueries = new Set(lowerQueries);
  check(
    "no duplicate queries",
    uniqueQueries.size === queries.length,
    `${queries.length} queries, ${uniqueQueries.size} unique`
  );

  console.log("    Generated queries:");
  for (const q of queries) {
    console.log(`      - ${q}`);
  }

  // Edge case: empty mainEntity
  const fallbackQueries = buildSearchQueries({
    title: "Fallback Test",
    mainEntity: "",
    supportingEntities: [],
    targetKeywords: [],
  });
  check(
    "empty mainEntity falls back to [title]",
    fallbackQueries.length === 1 && fallbackQueries[0] === "Fallback Test"
  );

  // ─── Test 5: Context assembly ────────────────────────────────────
  console.log("\n5. Context assembly");
  try {
    const multiResults = await searchOnyxMulti(queries);
    check(
      "searchOnyxMulti returned results",
      multiResults.length > 0,
      `got ${multiResults.length} context objects`
    );

    const context = assembleOnyxContext(multiResults);
    check(
      "output starts with header",
      context.startsWith("=== Knowledge Base Context ===")
    );
    check(
      "output length ≤ 8000 chars",
      context.length <= 8000,
      `length = ${context.length}`
    );
    check(
      "output contains at least one Source block",
      context.includes("--- Source:")
    );

    console.log(`    Context preview (first 300 chars):`);
    console.log(`      ${context.substring(0, 300).replace(/\n/g, "\n      ")}...`);
  } catch (error) {
    console.log(`  FAIL Context assembly threw: ${error}`);
    failed += 4;
  }

  // Test empty context
  const emptyContext = assembleOnyxContext([]);
  check(
    "empty input produces 'no content found' message",
    emptyContext.includes("No relevant knowledge base content found")
  );

  // ─── Test 6: API endpoints (requires dev server) ─────────────────
  console.log("\n6. API endpoints");
  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  try {
    const healthRes = await fetch(`${appUrl}/api/onyx/health`);
    check(
      "GET /api/onyx/health responds",
      healthRes.status === 200 || healthRes.status === 401
    );

    const searchRes = await fetch(`${appUrl}/api/onyx/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "Bajo vineyard" }),
    });
    check(
      "POST /api/onyx/search responds",
      searchRes.status === 200 || searchRes.status === 401
    );
  } catch {
    console.log("  SKIP API tests — dev server not running");
    console.log(`       (Start with npm run dev, then re-run this test)`);
  }

  // ─── Summary ──────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

test();
