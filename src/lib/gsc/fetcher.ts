import { getSearchConsoleClient } from "./client";

export interface GscRow {
  date: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function fetchGscData(
  startDate: string,
  endDate: string
): Promise<GscRow[]> {
  const client = getSearchConsoleClient();
  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) throw new Error("GSC_SITE_URL not set");

  // GSC API caps at 25,000 rows per request. Use date+page dimensions
  // so we get per-day granularity for accurate date-range filtering.
  const allRows: GscRow[] = [];
  let startRow = 0;
  const PAGE_SIZE = 25000;

  while (true) {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["date", "page"],
        rowLimit: PAGE_SIZE,
        startRow,
      },
    });

    const rows = response.data.rows ?? [];
    for (const row of rows) {
      allRows.push({
        date: row.keys?.[0] ?? "",
        page: row.keys?.[1] ?? "",
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      });
    }

    if (rows.length < PAGE_SIZE) break;
    startRow += PAGE_SIZE;
  }

  return allRows;
}

export interface GscQueryRow {
  date: string;
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function fetchGscQueryData(
  startDate: string,
  endDate: string
): Promise<GscQueryRow[]> {
  const client = getSearchConsoleClient();
  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) throw new Error("GSC_SITE_URL not set");

  const allRows: GscQueryRow[] = [];
  let startRow = 0;
  const PAGE_SIZE = 25000;

  while (true) {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["date", "page", "query"],
        rowLimit: PAGE_SIZE,
        startRow,
      },
    });

    const rows = response.data.rows ?? [];
    for (const row of rows) {
      allRows.push({
        date: row.keys?.[0] ?? "",
        page: row.keys?.[1] ?? "",
        query: row.keys?.[2] ?? "",
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      });
    }

    if (rows.length < PAGE_SIZE) break;
    startRow += PAGE_SIZE;
  }

  return allRows;
}

/** Returns rolling date range with 1-day lag (GSC data is usually available within 1-2 days) */
export function getGscDateRange(daysBack = 90): { start: string; end: string } {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
}
