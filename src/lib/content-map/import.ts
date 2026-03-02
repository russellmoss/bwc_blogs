import Papa from "papaparse";
import type { PrismaClient } from "@prisma/client";
import { generateSlug, ensureUniqueSlug } from "./slug";

/** Raw CSV row shape (column headers from the spreadsheet) */
interface CSVRow {
  "Hub Article": string;
  "Article Type": string;
  "Spoke Article Title": string;
  "Target Keywords": string;
  "Search Volume Est.": string;
  Difficulty: string;
  "Target Audience": string;
  "Internal Links To": string;
  "Suggested External Source Links": string;
  "Content Notes": string;
}

/** Mapped row ready for DB insertion */
export interface ContentMapRow {
  hubName: string;
  articleType: "hub" | "spoke";
  title: string;
  slug: string;
  mainEntity: string;
  supportingEntities: string[];
  targetKeywords: string[];
  searchVolumeEst: number | null;
  keywordDifficulty: string | null;
  targetAudience: string | null;
  contentNotes: string | null;
  suggestedExternalLinks: string[];
  internalLinksTo: string[];
  status: string;
  source: string;
}

const SEARCH_VOLUME_MAP: Record<string, number> = {
  low: 100,
  medium: 500,
  high: 2000,
};

/** Split a semicolon-delimited string into trimmed, non-empty items */
function splitSemicolon(value: string): string[] {
  if (!value || !value.trim()) return [];
  return value
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Parse CSV text into raw rows */
export function parseCSV(csvText: string): CSVRow[] {
  const result = Papa.parse<CSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    const errorMessages = result.errors
      .map((e) => `Row ${e.row}: ${e.message}`)
      .join("; ");
    throw new Error(`CSV parse errors: ${errorMessages}`);
  }

  return result.data;
}

/** Transform a raw CSV row into a ContentMapRow */
export function mapCSVRow(row: CSVRow): ContentMapRow {
  const articleType = row["Article Type"].toLowerCase() as "hub" | "spoke";
  const title =
    articleType === "spoke" && row["Spoke Article Title"]?.trim()
      ? row["Spoke Article Title"].trim()
      : row["Hub Article"].trim();

  const keywords = splitSemicolon(row["Target Keywords"]);
  const mainEntity = keywords[0] || title.toLowerCase();
  const supportingEntities = keywords.slice(1);

  const volumeKey = (row["Search Volume Est."] || "").toLowerCase().trim();
  const searchVolumeEst = SEARCH_VOLUME_MAP[volumeKey] ?? null;

  const difficulty = row["Difficulty"]?.trim().toLowerCase() || null;
  const targetAudience = row["Target Audience"]?.trim() || null;
  const contentNotes = row["Content Notes"]?.trim() || null;

  const suggestedExternalLinks = splitSemicolon(
    row["Suggested External Source Links"]
  );
  const internalLinksTo = splitSemicolon(row["Internal Links To"]);

  return {
    hubName: row["Hub Article"].trim(),
    articleType,
    title,
    slug: generateSlug(title),
    mainEntity,
    supportingEntities,
    targetKeywords: keywords,
    searchVolumeEst,
    keywordDifficulty: difficulty,
    targetAudience,
    contentNotes,
    suggestedExternalLinks,
    internalLinksTo,
    status: "planned",
    source: "engine",
  };
}

/** Import mapped rows into the database. Hubs first, then spokes with parent FK. */
export async function importToDatabase(
  rows: ContentMapRow[],
  db: PrismaClient
): Promise<{ hubs: number; spokes: number }> {
  const hubs = rows.filter((r) => r.articleType === "hub");
  const spokes = rows.filter((r) => r.articleType === "spoke");

  // Insert hubs first
  const hubIdMap = new Map<string, number>();

  for (const hub of hubs) {
    const slug = await ensureUniqueSlug(hub.slug, db);
    const created = await db.contentMap.create({
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

  // Insert spokes with parent hub FK
  for (const spoke of spokes) {
    const slug = await ensureUniqueSlug(spoke.slug, db);
    const parentHubId = hubIdMap.get(spoke.hubName) ?? null;

    await db.contentMap.create({
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

  return { hubs: hubs.length, spokes: spokes.length };
}

/** Core BWC page URLs for internal linking */
export const CORE_PAGES = [
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

/** Seed core BWC pages into the internal_links table */
export async function seedCorePages(db: PrismaClient): Promise<number> {
  let created = 0;
  for (const url of CORE_PAGES) {
    const existing = await db.internalLink.findFirst({
      where: { targetCorePage: url, linkType: "to-core-page" },
      select: { id: true },
    });
    if (!existing) {
      await db.internalLink.create({
        data: {
          targetCorePage: url,
          linkType: "to-core-page",
          isActive: true,
        },
      });
      created++;
    }
  }
  return created;
}
