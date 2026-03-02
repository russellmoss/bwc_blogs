import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { parseCSV, mapCSVRow } from "../src/lib/content-map/import";
import { ensureUniqueSlug } from "../src/lib/content-map/slug";

const prisma = new PrismaClient();

// ─── Core BWC pages for internal linking ────────────────────────────
const CORE_PAGES = [
  "https://www.bhutanwine.com/the-grapes-vineyards",
  "https://www.bhutanwine.com/our-wine",
  "https://www.bhutanwine.com/our-wine-2023-first-barrel",
  "https://www.bhutanwine.com/first-release",
  "https://www.bhutanwine.com/visit-us",
  "https://www.bhutanwine.com/about-us",
  "https://www.bhutanwine.com/in-the-news",
  "https://www.bhutanwine.com/gallery",
  "https://www.bhutanwine.com/2024-inquiry-request",
  "https://www.bhutanwine.com/contact-us",
];

async function main() {
  // ─── Guide 1: Seed admin user ───────────────────────────────────
  const email = (process.env.ADMIN_EMAIL || "russell@bhutanwine.com").toLowerCase();
  const name = process.env.ADMIN_NAME || "Russell Moss";
  const password = process.env.ADMIN_PASSWORD || "changeme123";

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "admin", isActive: true },
    create: { email, name, passwordHash, role: "admin", isActive: true },
  });

  console.log(`Admin user seeded: ${admin.email} (id: ${admin.id})`);

  // ─── Guide 2: Seed content map from CSV ─────────────────────────
  const contentMapCount = await prisma.contentMap.count();

  if (contentMapCount > 0) {
    console.log(`Content map already seeded (${contentMapCount} rows). Skipping.`);
  } else {
    const csvPath = path.join(__dirname, "..", "data", "content-map.csv");
    const csvText = fs.readFileSync(csvPath, "utf-8");
    const rawRows = parseCSV(csvText);
    const mappedRows = rawRows.map(mapCSVRow);

    const hubs = mappedRows.filter((r) => r.articleType === "hub");
    const spokes = mappedRows.filter((r) => r.articleType === "spoke");

    // Insert hubs first
    const hubIdMap = new Map<string, number>();

    for (const hub of hubs) {
      const slug = await ensureUniqueSlug(hub.slug, prisma);
      const created = await prisma.contentMap.create({
        data: {
          hubName: hub.hubName,
          articleType: hub.articleType,
          title: hub.title,
          slug,
          mainEntity: hub.mainEntity,
          supportingEntities: hub.supportingEntities,
          targetKeywords: hub.targetKeywords,
          searchVolumeEst: hub.searchVolumeEst,
          keywordDifficulty: hub.keywordDifficulty,
          targetAudience: hub.targetAudience,
          contentNotes: hub.contentNotes,
          suggestedExternalLinks: hub.suggestedExternalLinks,
          internalLinksTo: hub.internalLinksTo,
          status: hub.status,
          source: hub.source,
        },
        select: { id: true, hubName: true },
      });
      hubIdMap.set(created.hubName, created.id);
    }

    console.log(`  Hubs inserted: ${hubs.length}`);

    // Insert spokes with parent hub FK
    for (const spoke of spokes) {
      const slug = await ensureUniqueSlug(spoke.slug, prisma);
      const parentHubId = hubIdMap.get(spoke.hubName) ?? null;

      await prisma.contentMap.create({
        data: {
          hubName: spoke.hubName,
          articleType: spoke.articleType,
          title: spoke.title,
          slug,
          mainEntity: spoke.mainEntity,
          supportingEntities: spoke.supportingEntities,
          targetKeywords: spoke.targetKeywords,
          searchVolumeEst: spoke.searchVolumeEst,
          keywordDifficulty: spoke.keywordDifficulty,
          targetAudience: spoke.targetAudience,
          contentNotes: spoke.contentNotes,
          suggestedExternalLinks: spoke.suggestedExternalLinks,
          internalLinksTo: spoke.internalLinksTo,
          status: spoke.status,
          source: spoke.source,
          parentHubId,
        },
      });
    }

    console.log(`  Spokes inserted: ${spokes.length}`);
    console.log(`Content map seeded: ${hubs.length + spokes.length} total rows`);
  }

  // ─── Guide 2: Seed core BWC pages into internal_links ──────────
  const corePageCount = await prisma.internalLink.count({
    where: { linkType: "to-core-page" },
  });

  if (corePageCount > 0) {
    console.log(`Core pages already seeded (${corePageCount} rows). Skipping.`);
  } else {
    for (const url of CORE_PAGES) {
      await prisma.internalLink.create({
        data: {
          targetCorePage: url,
          linkType: "to-core-page",
          isActive: true,
        },
      });
    }
    console.log(`Core pages seeded: ${CORE_PAGES.length} internal link rows`);
  }
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
