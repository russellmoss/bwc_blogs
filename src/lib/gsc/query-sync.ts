import { fetchGscQueryData, getGscDateRange, matchPagesToContentMap } from "./index";
import { prisma, withRetry } from "@/lib/db";
import type { QuerySyncResult } from "@/types/intelligence";

/** 180-day rolling window for query-level data */
const QUERY_DAYS_BACK = 180;

export async function runGscQuerySync(): Promise<QuerySyncResult> {
  const errors: string[] = [];
  const unmatchedUrls: string[] = [];
  let syncedRows = 0;

  const dateRange = getGscDateRange(QUERY_DAYS_BACK);

  // Clean up rows older than the rolling window
  const cutoffDate = new Date(dateRange.start);
  const deleteResult = await prisma.articleQueryPerformance.deleteMany({
    where: { date: { lt: cutoffDate } },
  });
  const deletedOldRows = deleteResult.count;

  // Fetch query data from GSC
  const gscRows = await fetchGscQueryData(dateRange.start, dateRange.end);

  // Build content map match lookup
  const uniquePages = [...new Set(gscRows.map((r) => r.page))];
  const matched = await matchPagesToContentMap(uniquePages);
  const matchedMap = new Map(matched.map((m) => [m.page, m.contentMapId]));

  for (const page of uniquePages) {
    if (!matchedMap.has(page)) unmatchedUrls.push(page);
  }

  // Upsert one row per page per day per query
  for (const row of gscRows) {
    const contentMapId = matchedMap.get(row.page) ?? null;

    try {
      await withRetry(() =>
        prisma.articleQueryPerformance.upsert({
          where: {
            page_date_query: {
              page: row.page,
              date: new Date(row.date),
              query: row.query,
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
            query: row.query,
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
      errors.push(
        `Failed to upsert query ${row.query} for ${row.page} ${row.date}: ${e instanceof Error ? e.message : "Unknown"}`
      );
    }
  }

  return { syncedRows, deletedOldRows, unmatchedUrls, dateRange, errors };
}
