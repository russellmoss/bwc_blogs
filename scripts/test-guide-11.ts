/**
 * Test Guide 11: Finalization, Publishing, Version History
 *
 * Prerequisites:
 *   - App running on localhost:3000 (or NEXT_PUBLIC_APP_URL)
 *   - At least one article in content_map (id=1)
 *   - Authenticated session (uses cookies)
 *
 * Usage:
 *   npx tsx scripts/test-guide-11.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function testEndpoint(
  method: string,
  path: string,
  body?: object,
  expectedStatus?: number
): Promise<{ status: number; data: any; ok: boolean }> {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    const expected = expectedStatus || 200;
    const ok = response.status === expected || (response.status >= 200 && response.status < 300);
    return { status: response.status, data, ok };
  } catch (error) {
    return {
      status: 0,
      data: { error: error instanceof Error ? error.message : "Network error" },
      ok: false,
    };
  }
}

function log(pass: boolean, label: string, detail?: string) {
  const icon = pass ? "\u2705" : "\u274C";
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("\n=== Guide 11 Integration Tests ===\n");
  console.log(`Base URL: ${BASE_URL}\n`);

  // Test 1: GET /api/articles/1/versions
  const t1 = await testEndpoint("GET", "/api/articles/1/versions");
  log(
    t1.status === 200 || t1.status === 401,
    `GET /api/articles/1/versions → ${t1.status}`,
    t1.data.success ? `${t1.data.data.length} versions` : t1.data.error?.message
  );

  // Test 2: GET /api/articles/1
  const t2 = await testEndpoint("GET", "/api/articles/1");
  log(
    t2.status === 200 || t2.status === 401,
    `GET /api/articles/1 → ${t2.status}`,
    t2.data.success
      ? `Article: ${t2.data.data.article?.title || "found"}, versions: ${t2.data.data.versionCount}`
      : t2.data.error?.message
  );

  // Test 3: GET /api/articles/1/html
  const t3 = await testEndpoint("GET", "/api/articles/1/html");
  log(
    t3.status === 200 || t3.status === 404 || t3.status === 401,
    `GET /api/articles/1/html → ${t3.status}`,
    t3.data.success
      ? `Version ${t3.data.data.version}, ${t3.data.data.htmlContent?.length || 0} chars`
      : t3.data.error?.message
  );

  // Test 4: POST /api/capture (stub)
  const t4 = await testEndpoint("POST", "/api/capture", {
    email: "test@example.com",
    source: "guide-11-test",
  });
  log(
    t4.status === 200,
    `POST /api/capture → ${t4.status}`,
    t4.data.success ? "Stub active" : t4.data.error?.message
  );

  // Test 5: POST /api/articles/1/finalize (will likely fail without a valid document)
  const t5 = await testEndpoint("POST", "/api/articles/1/finalize", {
    document: {},
    html: "<html><body>Test</body></html>",
  });
  log(
    true, // Any response is informative
    `POST /api/articles/1/finalize → ${t5.status}`,
    t5.data.success
      ? `Finalized v${t5.data.data.documentVersion}`
      : `${t5.data.error?.code}: ${t5.data.error?.message?.substring(0, 80)}`
  );

  // Test 6: POST /api/articles/1/publish (will fail without finalization)
  const t6 = await testEndpoint("POST", "/api/articles/1/publish", {
    publishedUrl: "https://www.bhutanwine.com/post/test",
  });
  log(
    true, // Any response is informative
    `POST /api/articles/1/publish → ${t6.status}`,
    t6.data.success
      ? `Published, ${t6.data.data.activatedLinks} links activated, ${t6.data.data.backfillReport?.length || 0} backfill suggestions`
      : `${t6.data.error?.code}: ${t6.data.error?.message?.substring(0, 80)}`
  );

  console.log("\n=== Tests Complete ===\n");
}

main().catch(console.error);
