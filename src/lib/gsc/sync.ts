import { fetchGscData, getGscDateRange, matchPagesToContentMap } from "./index";
import { prisma, withRetry } from "@/lib/db";
import type { GscSyncResult } from "@/types/intelligence";

/** Shared GSC sync logic used by both the cron route and manual sync route */
export async function runGscSync(): Promise<GscSyncResult> {
  const errors: string[] = [];
  const unmatchedUrls: string[] = [];
  let syncedRows = 0;
  let skippedRows = 0;

  // Fetch full 16 months of history (GSC API maximum)
  const dateRange = getGscDateRange(480);
  const gscRows = await fetchGscData(dateRange.start, dateRange.end);

  // Build content map match lookup
  const uniquePages = [...new Set(gscRows.map((r) => r.page))];
  const matched = await matchPagesToContentMap(uniquePages);
  const matchedMap = new Map(matched.map((m) => [m.page, m.contentMapId]));

  for (const page of uniquePages) {
    if (!matchedMap.has(page)) unmatchedUrls.push(page);
  }

  // Upsert one row per page per day
  for (const row of gscRows) {
    const contentMapId = matchedMap.get(row.page) ?? null;

    try {
      await withRetry(() =>
        prisma.articlePerformance.upsert({
          where: {
            page_date: {
              page: row.page,
              date: new Date(row.date),
            },
          },
          update: {
            contentMapId,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
            syncedAt: new Date(),
          },
          create: {
            contentMapId,
            date: new Date(row.date),
            page: row.page,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
            syncedAt: new Date(),
          },
        })
      );
      syncedRows++;
    } catch (e) {
      errors.push(`Failed to upsert ${row.page} ${row.date}: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  }

  return { syncedRows, skippedRows, unmatchedUrls, dateRange, errors };
}
