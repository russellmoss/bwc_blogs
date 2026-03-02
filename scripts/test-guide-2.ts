/**
 * Integration test for Guide 2: Content Map — CSV Import, CRUD API, Seed Data
 *
 * Run with: npx tsx scripts/test-guide-2.ts
 *
 * Tests:
 * 1. content_map table has 39 rows (8 hubs + 31 spokes)
 * 2. All 7 hubs have parentHubId = null
 * 3. All 32 spokes have a valid parentHubId
 * 4. Every row has a unique, non-null slug
 * 5. internal_links table has 10 core page rows
 * 6. CRUD API responses (if dev server running)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
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

  console.log("\n=== Guide 2 Integration Tests ===\n");

  // ─── Test 1: Content map row count ──────────────────────────────
  console.log("1. Content map data");
  const totalRows = await prisma.contentMap.count();
  check("content_map has 39 rows", totalRows === 39, `found ${totalRows}`);

  const hubCount = await prisma.contentMap.count({
    where: { articleType: "hub" },
  });
  check("8 hub articles", hubCount === 8, `found ${hubCount}`);

  const spokeCount = await prisma.contentMap.count({
    where: { articleType: "spoke" },
  });
  check("31 spoke articles", spokeCount === 31, `found ${spokeCount}`);

  // ─── Test 2: Hub articles have no parent ────────────────────────
  console.log("\n2. Hub/spoke relationships");
  const hubsWithParent = await prisma.contentMap.count({
    where: { articleType: "hub", parentHubId: { not: null } },
  });
  check("All hubs have parentHubId = null", hubsWithParent === 0, `${hubsWithParent} hubs have a parent`);

  // ─── Test 3: Spoke articles have valid parents ──────────────────
  const spokesWithoutParent = await prisma.contentMap.count({
    where: { articleType: "spoke", parentHubId: null },
  });
  check("All spokes have a parentHubId", spokesWithoutParent === 0, `${spokesWithoutParent} spokes missing parent`);

  // Verify spoke parents reference actual hub rows
  const spokes = await prisma.contentMap.findMany({
    where: { articleType: "spoke" },
    select: { id: true, parentHubId: true },
  });

  const hubIds = new Set(
    (await prisma.contentMap.findMany({
      where: { articleType: "hub" },
      select: { id: true },
    })).map((h) => h.id)
  );

  const invalidParents = spokes.filter(
    (s) => s.parentHubId !== null && !hubIds.has(s.parentHubId)
  );
  check("All parentHubId values reference actual hubs", invalidParents.length === 0, `${invalidParents.length} invalid`);

  // ─── Test 4: Slugs ─────────────────────────────────────────────
  console.log("\n3. Slug uniqueness");
  const nullSlugs = await prisma.contentMap.count({
    where: { slug: null },
  });
  check("No null slugs", nullSlugs === 0, `${nullSlugs} null slugs`);

  const allSlugs = await prisma.contentMap.findMany({
    select: { slug: true },
  });
  const slugSet = new Set(allSlugs.map((r) => r.slug));
  check("All slugs are unique", slugSet.size === allSlugs.length, `${allSlugs.length} rows, ${slugSet.size} unique slugs`);

  // ─── Test 5: Internal links (core pages) ────────────────────────
  console.log("\n4. Core page links");
  const corePageCount = await prisma.internalLink.count({
    where: { linkType: "to-core-page" },
  });
  check("10 core page internal links", corePageCount === 10, `found ${corePageCount}`);

  const corePages = await prisma.internalLink.findMany({
    where: { linkType: "to-core-page" },
    select: { targetCorePage: true, isActive: true },
  });

  const allActive = corePages.every((p) => p.isActive === true);
  check("All core pages are active", allActive);

  const allHaveUrl = corePages.every(
    (p) => p.targetCorePage && p.targetCorePage.startsWith("https://")
  );
  check("All core pages have valid URLs", allHaveUrl);

  // ─── Test 6: Data quality spot checks ───────────────────────────
  console.log("\n5. Data quality");
  const withKeywords = await prisma.contentMap.count({
    where: { targetKeywords: { isEmpty: false } },
  });
  check("All rows have target keywords", withKeywords === 39, `${withKeywords}/39 have keywords`);

  const withMainEntity = await prisma.contentMap.count({
    where: { mainEntity: { not: "" } },
  });
  check("All rows have mainEntity", withMainEntity === 39, `${withMainEntity}/39 have mainEntity`);

  const allPlanned = await prisma.contentMap.count({
    where: { status: "planned" },
  });
  check("All rows have status 'planned'", allPlanned === 39, `${allPlanned}/39 are planned`);

  // ─── Test 7: API endpoints (requires dev server) ────────────────
  console.log("\n6. API endpoints");
  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  try {
    const listRes = await fetch(`${appUrl}/api/content-map`);
    check("GET /api/content-map responds", listRes.status === 200 || listRes.status === 401);

    if (listRes.status === 200) {
      const listBody = await listRes.json();
      check(
        "GET /api/content-map returns success with data array",
        listBody.success === true && Array.isArray(listBody.data)
      );
    }
  } catch {
    console.log("  SKIP API tests — dev server not running");
    console.log(`       (Start with npm run dev, then re-run this test)`);
  }

  // ─── Summary ────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

test();
