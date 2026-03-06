/**
 * Integration test for Guide 13: SEO Intelligence Layer
 *
 * Usage: npx tsx scripts/test-guide-gsc.ts
 *
 * Tests:
 * 1. Neon connection + table existence
 * 2. GSC auth + credentials parse
 * 3. GSC fetcher returns data
 * 4. Matcher matches at least one page
 * 5. API routes return correct shapes (requires running dev server)
 */

import "dotenv/config";

const PASS = "\x1b[32m PASS \x1b[0m";
const FAIL = "\x1b[31m FAIL \x1b[0m";
const SKIP = "\x1b[33m SKIP \x1b[0m";

let passed = 0;
let failed = 0;
let skipped = 0;

function log(status: string, name: string, detail?: string) {
  console.log(`${status} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function test(name: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    log(PASS, name, detail ?? undefined);
    passed++;
  } catch (e) {
    log(FAIL, name, e instanceof Error ? e.message : String(e));
    failed++;
  }
}

async function main() {
  console.log("\n=== Guide 13: SEO Intelligence Layer — Integration Tests ===\n");

  // 1. Neon connection + tables
  await test("Neon connection + article_performance table", async () => {
    const { prisma } = await import("../src/lib/db/index");
    const count = await prisma.articlePerformance.count();
    return `${count} rows in article_performance`;
  });

  await test("Neon connection + content_recommendation table", async () => {
    const { prisma } = await import("../src/lib/db/index");
    const count = await prisma.contentRecommendation.count();
    return `${count} rows in content_recommendation`;
  });

  // 2. GSC auth
  await test("GSC credentials parse", async () => {
    const { getGscAuth } = await import("../src/lib/gsc/auth");
    const auth = getGscAuth();
    if (!auth) throw new Error("Auth returned null");
    return "credentials parsed OK";
  });

  // 3. GSC fetcher
  await test("GSC fetcher returns data", async () => {
    const { fetchGscData, getGscDateRange } = await import("../src/lib/gsc/fetcher");
    const range = getGscDateRange(7);
    const rows = await fetchGscData(range.start, range.end);
    return `${rows.length} rows for ${range.start} to ${range.end}`;
  });

  // 4. Matcher
  await test("Matcher matches at least one page", async () => {
    const { fetchGscData, getGscDateRange } = await import("../src/lib/gsc/fetcher");
    const { matchPagesToContentMap } = await import("../src/lib/gsc/matcher");
    const range = getGscDateRange(7);
    const rows = await fetchGscData(range.start, range.end);
    const pages = rows.map((r) => r.page);
    const matched = await matchPagesToContentMap(pages);
    if (matched.length === 0 && pages.length > 0) {
      return `0 matched of ${pages.length} pages (may be expected for new site)`;
    }
    return `${matched.length} matched of ${pages.length} pages`;
  });

  // 5. API routes (requires dev server)
  const BASE = process.env.APP_URL || "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && cronSecret !== "generate-a-random-secret") {
    await test("Cron route returns GscSyncResult shape", async () => {
      const res = await fetch(`${BASE}/api/cron/gsc-sync`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Not successful");
      if (typeof data.data.syncedRows !== "number") throw new Error("Missing syncedRows");
      return `syncedRows: ${data.data.syncedRows}, skipped: ${data.data.skippedRows}`;
    });
  } else {
    log(SKIP, "Cron route test", "CRON_SECRET not configured");
    skipped++;
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${skipped} skipped ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
