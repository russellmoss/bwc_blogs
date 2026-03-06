# Implementation Guide: SEO Intelligence Layer
**Guide Number:** 13 (New — outside original 1–12 sequence)
**Status:** Ready for execution
**Depends on:** Guides 1–12 complete ✅
**Exploration source:** `guides/exploration-results-gsc.md` (2026-03-05)

---

## A. Objective

Build a closed-loop SEO intelligence system inside the BWC Content Engine that:

1. **Syncs real performance data** from Google Search Console daily into Neon Postgres
2. **Joins GSC data to the content map** so every article has real click/impression/position data attached
3. **Runs Claude analysis** over that data to generate typed, actionable content recommendations
4. **Presents a human approval gate** — editors review and approve recommendations, which auto-load the target article + a pre-written prompt into the Composer for immediate execution
5. **Surfaces everything in a new Intelligence dashboard tab** with three panels: Performance Overview, Gap Analysis, and Recommendation Queue

This is Phase 4 of the architecture — the feedback loop that makes the content system self-improving.

---

## B. Scope

### In scope
- `article_performance` Prisma model + table (per-day GSC metrics per article)
- `content_recommendation` Prisma model + table (Claude-generated typed recommendations)
- `src/lib/gsc/` module (auth, client, fetcher, matcher)
- `/api/cron/gsc-sync` Vercel Cron route (daily GSC fetch → Neon write)
- `/api/intelligence/performance` route (performance data joined with content_map)
- `/api/intelligence/analyze` route (Claude analysis → ContentRecommendation[])
- `/api/intelligence/recommendations` route (CRUD for recommendation queue)
- Intelligence dashboard tab: PerformanceOverview, GapAnalysis, RecommendationQueue panels
- `intelligence-store.ts` Zustand store
- Approval gate: approve → set article + pending prompt → navigate to Composer
- `src/types/intelligence.ts` new type file
- AppShell nav link addition
- `vercel.json` cron configuration
- Environment variable fixes (GSC_SITE_URL mismatch)

### Out of scope
- GA4 integration (deferred — GSC is the primary signal)
- Google Ads integration (deferred)
- AI visibility / citation tracking (deferred)
- Auto-applying recommendations without human approval
- Email notifications for new recommendations

---

## C. Existing Constraints to Preserve

- All existing routes, UI, Composer, Canvas Edit, HTML Mode must continue working
- AppShell navigation order: Composer → Content Map → Photos → **Intelligence (new)** → Get Started
- `useArticleStore` must not be modified — use existing `setSelectedArticle` and `setPendingChatMessage` actions
- All PKs use `Int @id @default(autoincrement())` — no UUIDs
- No `prisma migrate dev` — use `npx prisma db push && npx prisma generate`
- All browser-facing routes use `requireAuth()` from `src/lib/auth/session.ts`
- Only the cron route uses `CRON_SECRET` bearer token auth

---

## D. Pre-Flight Environment Fix (Do This First)

**Critical:** Before any code, fix the GSC property URL mismatch.

In `.env.local`, the current value is:
```
GSC_SITE_URL=sc-domain:bhutanwine.com   ← returns HTTP 403
```

Change it to:
```
GSC_SITE_URL=https://www.bhutanwine.com/
```

Also add if not present:
```
GSC_PROPERTY_URL=https://www.bhutanwine.com/
```

Also fix CRON_SECRET (currently a placeholder):
```bash
# Generate a real secret and replace the placeholder
openssl rand -base64 32
# Then set in .env.local:
CRON_SECRET=<generated value>
```

**Also update in Vercel dashboard:** Settings → Environment Variables → update `GSC_SITE_URL` and `CRON_SECRET` to match.

---

## E. Technical Design

### E1. New Prisma Models

Add to `prisma/schema.prisma`:

```prisma
model ArticlePerformance {
  id            Int      @id @default(autoincrement())
  contentMapId  Int      @map("content_map_id")
  date          DateTime @db.Date @map("date")
  page          String   @map("page")
  clicks        Int      @default(0)
  impressions   Int      @default(0)
  ctr           Float    @default(0) @map("ctr")
  position      Float    @default(0) @map("position")
  topQuery      String?  @map("top_query")
  syncedAt      DateTime @default(now()) @map("synced_at")
  
  contentMap    ContentMap @relation(fields: [contentMapId], references: [id])
  
  @@unique([contentMapId, date])
  @@map("article_performance")
}

model ContentRecommendation {
  id                   Int      @id @default(autoincrement())
  contentMapId         Int?     @map("content_map_id")
  recommendationType   String   @map("recommendation_type")
  title                String
  rationale            String
  suggestedPrompt      String   @map("suggested_prompt")
  priority             String   @default("medium")
  status               String   @default("pending")
  generatedAt          DateTime @default(now()) @map("generated_at")
  resolvedAt           DateTime? @map("resolved_at")
  
  contentMap           ContentMap? @relation(fields: [contentMapId], references: [id])
  
  @@map("content_recommendation")
}
```

Also add relations on `ContentMap`:
```prisma
// Add inside the ContentMap model:
performanceData      ArticlePerformance[]
recommendations      ContentRecommendation[]
```

### E2. New TypeScript Types — `src/types/intelligence.ts`

```typescript
export interface ArticlePerformanceRow {
  id: number;
  contentMapId: number;
  date: string;          // ISO date YYYY-MM-DD
  page: string;          // GSC page URL
  clicks: number;
  impressions: number;
  ctr: number;           // 0–1 float
  position: number;      // average ranking position
  topQuery: string | null;
  syncedAt: string;      // ISO datetime
}

export interface PerformanceWithContentMap extends ArticlePerformanceRow {
  contentMap: {
    id: number;
    title: string;
    slug: string | null;
    publishedUrl: string | null;
    hubName: string;
    articleType: string;
    status: string;
    targetKeywords: string[];
  };
}

export type RecommendationType = "update" | "new_spoke" | "gap" | "meta_rewrite" | "title_update";
export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationStatus = "pending" | "approved" | "dismissed";

export interface ContentRecommendation {
  id: number;
  contentMapId: number | null;
  recommendationType: RecommendationType;
  title: string;
  rationale: string;
  suggestedPrompt: string;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  generatedAt: string;
  resolvedAt: string | null;
  contentMap?: {
    id: number;
    title: string;
    slug: string | null;
    hubName: string;
    articleType: string;
    status: string;
  } | null;
}

export interface GscSyncResult {
  syncedRows: number;
  skippedRows: number;
  unmatchedUrls: string[];
  dateRange: { start: string; end: string };
  errors: string[];
}

export interface PerformanceSummary {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topPerformingArticle: PerformanceWithContentMap | null;
  dateRange: { start: string; end: string };
}
```

### E3. GSC Library Module — `src/lib/gsc/`

**`src/lib/gsc/auth.ts`**
```typescript
import { GoogleAuth } from "google-auth-library";

export function getGscAuth(): GoogleAuth {
  const credentialsJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) throw new Error("GSC_SERVICE_ACCOUNT_JSON not set");
  
  const credentials = JSON.parse(credentialsJson);
  return new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}
```

**`src/lib/gsc/client.ts`**
```typescript
import { google } from "googleapis";
import { getGscAuth } from "./auth";

export function getSearchConsoleClient() {
  const auth = getGscAuth();
  return google.searchconsole({ version: "v1", auth });
}
```

**`src/lib/gsc/fetcher.ts`**
```typescript
import { getSearchConsoleClient } from "./client";

export interface GscRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function fetchGscData(
  startDate: string,  // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
): Promise<GscRow[]> {
  const client = getSearchConsoleClient();
  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) throw new Error("GSC_SITE_URL not set");

  const response = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: 500,
      dataState: "final",
    },
  });

  const rows = response.data.rows ?? [];
  return rows.map((row) => ({
    page: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

// Returns rolling date range with 3-day lag (GSC data delay)
export function getGscDateRange(daysBack = 30): { start: string; end: string } {
  const end = new Date();
  end.setDate(end.getDate() - 3); // 3-day GSC data lag
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);
  
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
}
```

**`src/lib/gsc/matcher.ts`**
```typescript
import { prisma } from "@/lib/db";

export interface MatchedPage {
  page: string;
  contentMapId: number;
}

export async function matchPagesToContentMap(pages: string[]): Promise<MatchedPage[]> {
  // Fetch all published content map entries with URL or slug
  const entries = await prisma.contentMap.findMany({
    where: {
      OR: [
        { publishedUrl: { not: null } },
        { slug: { not: null } },
      ],
    },
    select: { id: true, publishedUrl: true, slug: true },
  });

  const matched: MatchedPage[] = [];

  for (const page of pages) {
    // Try exact match on publishedUrl first
    const exactMatch = entries.find(
      (e) => e.publishedUrl && e.publishedUrl === page
    );
    if (exactMatch) {
      matched.push({ page, contentMapId: exactMatch.id });
      continue;
    }

    // Try slug suffix match — e.g. https://www.bhutanwine.com/blog/my-slug
    const slugMatch = entries.find(
      (e) => e.slug && (page.endsWith("/" + e.slug) || page.endsWith("/" + e.slug + "/"))
    );
    if (slugMatch) {
      matched.push({ page, contentMapId: slugMatch.id });
    }
    // Unmatched pages are silently skipped — expected for non-blog pages
  }

  return matched;
}
```

**`src/lib/gsc/index.ts`**
```typescript
export { getGscAuth } from "./auth";
export { getSearchConsoleClient } from "./client";
export { fetchGscData, getGscDateRange } from "./fetcher";
export { matchPagesToContentMap } from "./matcher";
```

### E4. API Routes

#### `/api/cron/gsc-sync/route.ts`
**Auth:** CRON_SECRET bearer token only (no session auth)
**Method:** GET
**Invoked by:** Vercel Cron daily at 06:00 UTC

```typescript
// Logic flow:
// 1. Validate Authorization: Bearer CRON_SECRET
// 2. Compute rolling date range (30 days back, 3-day lag)
// 3. fetchGscData(start, end)
// 4. matchPagesToContentMap(pages)
// 5. For each matched page: upsert into article_performance
//    - @@unique([contentMapId, date]) prevents duplicates
// 6. Return GscSyncResult
```

#### `/api/intelligence/performance/route.ts`
**Auth:** requireAuth()
**Method:** GET
**Query params:** `?days=30` (default 30)

Returns `PerformanceWithContentMap[]` — article_performance rows joined with content_map,
grouped by contentMapId, aggregated over the requested date range.

#### `/api/intelligence/analyze/route.ts`
**Auth:** requireAuth()
**Method:** POST
**Body:** `{ days?: number }` (default 30)

Logic:
1. Fetch performance data (same as /performance but internal)
2. Fetch content map entries with status = "published"
3. Assemble context for Claude (performance summary + content map + keyword gaps)
4. Call Claude API (non-streaming, JSON mode)
5. Parse and validate response as `ContentRecommendation[]`
6. Upsert recommendations into `content_recommendation` table (clear pending, insert new)
7. Return `{ recommendations: ContentRecommendation[], generatedAt: string }`

**Claude prompt contract:**
- System: "You are an SEO content strategist for Bhutan Wine Company..."
- Input: JSON blob of performance data + content map
- Output: strict JSON array of `ContentRecommendation` objects
- Model: `claude-sonnet-4-5-20250929`
- Max tokens: 4096
- Response must be valid JSON array — strip any markdown fences before parsing

#### `/api/intelligence/recommendations/route.ts`
**Auth:** requireAuth()
**Methods:** GET (list pending), PATCH (approve/dismiss by id)

GET returns all `content_recommendation` rows with status = "pending", joined with content_map.
PATCH body: `{ id: number, action: "approve" | "dismiss" }`

### E5. Zustand Store — `src/lib/store/intelligence-store.ts`

```typescript
interface IntelligenceStoreState {
  performanceData: PerformanceWithContentMap[];
  recommendations: ContentRecommendation[];
  isLoadingPerformance: boolean;
  isLoadingRecommendations: boolean;
  isAnalyzing: boolean;
  lastSyncedAt: string | null;
  selectedDays: 7 | 30 | 90;
}

interface IntelligenceStoreActions {
  fetchPerformance: () => Promise<void>;
  fetchRecommendations: () => Promise<void>;
  runAnalysis: () => Promise<void>;
  approveRecommendation: (rec: ContentRecommendation) => void;
  dismissRecommendation: (id: number) => Promise<void>;
  setSelectedDays: (days: 7 | 30 | 90) => void;
}
```

**`approveRecommendation` logic (critical):**
```typescript
approveRecommendation: (rec) => {
  // 1. Mark as approved via API
  fetch(`/api/intelligence/recommendations`, {
    method: "PATCH",
    body: JSON.stringify({ id: rec.id, action: "approve" }),
  });
  
  // 2. If there's a target article, pre-load it in the Composer
  if (rec.contentMapId) {
    const { setSelectedArticleById, setPendingChatMessage } = useArticleStore.getState();
    setSelectedArticleById(rec.contentMapId);
    setPendingChatMessage(rec.suggestedPrompt);
  }
  
  // 3. Navigate to Composer
  // (router.push called from the component, not the store)
}
```

### E6. UI Components

**`src/components/intelligence/PerformanceOverview.tsx`**
- Shows total clicks, impressions, avg CTR, avg position as metric cards
- Table of articles with their GSC metrics (sortable by clicks, impressions, position, CTR)
- Date range selector (7 / 30 / 90 days)
- Articles with 0 clicks but >100 impressions highlighted in amber (CTR opportunity)
- Articles with position 4–10 highlighted in blue (page-2 opportunity)

**`src/components/intelligence/GapAnalysis.tsx`**
- Shows articles with no GSC data at all (not yet indexed / no impressions)
- Shows articles ranked for queries outside their `targetKeywords` (keyword drift)
- "Top unranked keywords" derived from targetKeywords that have 0 clicks in GSC
- Simple table with article title, target keywords, actual impressions/clicks

**`src/components/intelligence/RecommendationQueue.tsx`**
- Lists all pending `ContentRecommendation` rows
- Each card shows: type badge, title, rationale, priority badge, target article
- Two action buttons: **Approve** (green) and **Dismiss** (gray)
- Approve triggers: mark approved → load article + prompt → navigate to /dashboard
- Empty state: "No recommendations yet — run analysis to generate insights"
- "Run Analysis" button triggers `/api/intelligence/analyze` (shows loading spinner)

**`src/app/dashboard/intelligence/page.tsx`**
- Server component shell (auth check via dashboard layout — no extra auth needed)
- Renders `<IntelligenceDashboard />` client component
- Three tabs within the page: Performance | Gap Analysis | Recommendations
- Default tab: Performance

### E7. AppShell Navigation Addition

In `src/components/layout/AppShell.tsx`:

```typescript
// Add near lines 139-142 (existing pathname checks):
const isIntelligence = pathname === "/dashboard/intelligence";

// Add nav link after Photos, before Get Started:
<Link
  href="/dashboard/intelligence"
  style={{
    color: isIntelligence ? "#bc9b5d" : "#414141",
    fontWeight: isIntelligence ? 600 : 400,
    // ... match existing nav link styles
  }}
>
  <TrendingUp size={16} />
  Intelligence
</Link>
```

Import `TrendingUp` from `lucide-react` (already installed).

### E8. Vercel Cron Configuration

Update `vercel.json`:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "regions": ["iad1"],
  "crons": [
    {
      "path": "/api/cron/gsc-sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

`0 6 * * *` = 6:00 AM UTC = 12:00 PM Bhutan Standard Time (UTC+6).

---

## F. Step-by-Step Execution Plan

### Phase 1: Environment + Schema (Steps 1.1–1.4)

**Step 1.1** — Fix environment variables
```bash
# In .env.local, update:
GSC_SITE_URL=https://www.bhutanwine.com/
GSC_PROPERTY_URL=https://www.bhutanwine.com/
CRON_SECRET=<output of: openssl rand -base64 32>
```

**Step 1.2** — Add Prisma models
- Open `prisma/schema.prisma`
- Add `ArticlePerformance` and `ContentRecommendation` models as specified in §E1
- Add `performanceData` and `recommendations` relations to the `ContentMap` model

**Step 1.3** — Push schema to Neon
```bash
npx prisma db push
npx prisma generate
```
Verify: both new tables appear in Neon console (or via `npx prisma studio`).

**Step 1.4** — Add new TypeScript types
- Create `src/types/intelligence.ts` with all types from §E2
- Edit `src/types/api.ts` — add to `ErrorCode`: `"GSC_UNAVAILABLE" | "GSC_SYNC_FAILED" | "INTELLIGENCE_ERROR"`
- Edit `src/types/activity.ts` — add to `ActivityAction`: `"GSC_SYNC_COMPLETED"`
- Edit `src/types/index.ts` — add: `export * from "./intelligence";`

**Phase 1 Gate:** `npx tsc --noEmit` must exit 0.

---

### Phase 2: GSC Library Module (Steps 2.1–2.5)

**Step 2.1** — Create `src/lib/gsc/auth.ts` (code from §E3)

**Step 2.2** — Create `src/lib/gsc/client.ts` (code from §E3)

**Step 2.3** — Create `src/lib/gsc/fetcher.ts` (code from §E3)
- Includes `fetchGscData()` and `getGscDateRange()`

**Step 2.4** — Create `src/lib/gsc/matcher.ts` (code from §E3)

**Step 2.5** — Create `src/lib/gsc/index.ts` barrel export

**Phase 2 Gate:**
```bash
npx tsc --noEmit
# Then run a quick smoke test:
npx tsx -e "
import { fetchGscData, getGscDateRange } from './src/lib/gsc/index';
const range = getGscDateRange(7);
console.log('Date range:', range);
fetchGscData(range.start, range.end)
  .then(rows => console.log('GSC rows returned:', rows.length, rows[0]))
  .catch(e => console.error('GSC error:', e.message));
"
```
Expected: returns array of rows with page/clicks/impressions/ctr/position.

---

### Phase 3: API Routes (Steps 3.1–3.4)

**Step 3.1** — Create `src/app/api/cron/gsc-sync/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { fetchGscData, getGscDateRange, matchPagesToContentMap } from "@/lib/gsc";
import { prisma } from "@/lib/db";
import { withRetry } from "@/lib/db";
import type { GscSyncResult } from "@/types/intelligence";

export async function GET(request: NextRequest) {
  // Auth: cron secret only
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];
  const unmatchedUrls: string[] = [];
  let syncedRows = 0;
  let skippedRows = 0;

  try {
    const dateRange = getGscDateRange(30);
    const gscRows = await fetchGscData(dateRange.start, dateRange.end);

    const pages = gscRows.map((r) => r.page);
    const matched = await matchPagesToContentMap(pages);
    const matchedMap = new Map(matched.map((m) => [m.page, m.contentMapId]));

    // Track unmatched
    for (const page of pages) {
      if (!matchedMap.has(page)) unmatchedUrls.push(page);
    }

    // Upsert matched rows
    for (const row of gscRows) {
      const contentMapId = matchedMap.get(row.page);
      if (!contentMapId) { skippedRows++; continue; }

      await withRetry(() =>
        prisma.articlePerformance.upsert({
          where: {
            contentMapId_date: {
              contentMapId,
              date: new Date(dateRange.end), // store as end date of sync window
            },
          },
          update: {
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
            page: row.page,
            syncedAt: new Date(),
          },
          create: {
            contentMapId,
            date: new Date(dateRange.end),
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
    }

    const result: GscSyncResult = {
      syncedRows,
      skippedRows,
      unmatchedUrls,
      dateRange,
      errors,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: { code: "GSC_SYNC_FAILED", message } },
      { status: 500 }
    );
  }
}
```

**Step 3.2** — Create `src/app/api/intelligence/performance/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") ?? "30", 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await prisma.articlePerformance.findMany({
      where: { syncedAt: { gte: since } },
      include: {
        contentMap: {
          select: {
            id: true, title: true, slug: true, publishedUrl: true,
            hubName: true, articleType: true, status: true, targetKeywords: true,
          },
        },
      },
      orderBy: { impressions: "desc" },
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
```

**Step 3.3** — Create `src/app/api/intelligence/analyze/route.ts`

Claude prompt for analysis:
```
System: You are an SEO content strategist for Bhutan Wine Company (bhutanwine.com), 
a pioneer wine producer in Bhutan. Analyze the provided performance data and content map 
to generate specific, actionable content recommendations.

Return ONLY a valid JSON array of recommendation objects. No preamble, no markdown fences.

Each object must have exactly these fields:
{
  "contentMapId": number | null,
  "recommendationType": "update" | "new_spoke" | "gap" | "meta_rewrite" | "title_update",
  "title": string (concise recommendation title),
  "rationale": string (1-2 sentences explaining why),
  "suggestedPrompt": string (the exact prompt to paste into the Composer chat),
  "priority": "high" | "medium" | "low"
}

Generate 5-10 recommendations. Prioritize:
1. Articles with position 4-10 and high impressions (meta/title optimization)
2. Target keywords with zero clicks (content gaps)
3. Spokes missing from high-performing hubs
4. Published articles needing content refresh (position declining)

Context:
<PERFORMANCE_DATA>
[JSON of top 20 article performance rows]
</PERFORMANCE_DATA>

<CONTENT_MAP>
[JSON of published articles with targetKeywords]
</CONTENT_MAP>
```

Logic flow:
1. Fetch performance data for last 30 days
2. Fetch published content_map entries
3. Assemble Claude prompt with both datasets
4. Call Claude API (non-streaming)
5. Parse response as `ContentRecommendation[]`
6. Clear existing pending recommendations for these articles
7. Insert new recommendations
8. Return recommendations array

**Step 3.4** — Create `src/app/api/intelligence/recommendations/route.ts`
- GET: return all pending recommendations with content_map join
- PATCH: accept `{ id, action: "approve" | "dismiss" }`, update status + resolvedAt

**Phase 3 Gate:**
```bash
npx tsc --noEmit
npx next lint

# Test cron route (replace SECRET with your actual CRON_SECRET):
curl -X GET http://localhost:3000/api/cron/gsc-sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
# Expected: { success: true, data: { syncedRows: N, ... } }

# Test performance route (must be logged in):
curl http://localhost:3000/api/intelligence/performance?days=30 \
  -H "Cookie: [session cookie]"
```

---

### Phase 4: Zustand Store (Step 4.1)

**Step 4.1** — Create `src/lib/store/intelligence-store.ts`

Follow the exact same pattern as `src/lib/store/dashboard-store.ts`:
- No immer, no devtools
- Flat state + actions object passed to `create()`
- Async actions use `set()` to update loading state before and after fetch

The `approveRecommendation` action:
```typescript
approveRecommendation: (rec) => {
  // PATCH API to mark approved
  fetch("/api/intelligence/recommendations", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: rec.id, action: "approve" }),
  });
  
  // Update local state
  set((state) => ({
    recommendations: state.recommendations.filter((r) => r.id !== rec.id),
  }));
  
  // If there's a target article, pre-load in Composer
  if (rec.contentMapId) {
    // Import dynamically to avoid circular deps
    const { useArticleStore } = require("@/lib/store/article-store");
    const articleStore = useArticleStore.getState();
    if (articleStore.setSelectedArticleById) {
      articleStore.setSelectedArticleById(rec.contentMapId);
    }
    articleStore.setPendingChatMessage(rec.suggestedPrompt);
  }
  // Navigation handled by component (router.push("/dashboard"))
},
```

**Phase 4 Gate:** `npx tsc --noEmit` exits 0.

---

### Phase 5: UI Components (Steps 5.1–5.6)

**Step 5.1** — Create `src/components/intelligence/PerformanceOverview.tsx`

Key elements:
- 4 metric cards at top: Total Clicks, Total Impressions, Avg CTR (%), Avg Position
- Date range toggle: `7d | 30d | 90d` (updates `selectedDays` in store, refetches)
- Sortable table: Article Title | Hub | Clicks | Impressions | CTR | Position | Status
- Row highlighting:
  - Amber background: impressions > 100 AND clicks === 0 (CTR opportunity)
  - Blue background: position >= 4 AND position <= 10 (page-2 opportunity)
- Empty state: "No performance data yet. The GSC sync runs daily at 12:00 PM BST. You can trigger a manual sync from Settings."
- Loading skeleton while fetching

**Step 5.2** — Create `src/components/intelligence/GapAnalysis.tsx`

Key elements:
- "Unindexed Articles" section: content_map entries with status=published but zero GSC rows
- "Keyword Gap" section: articles where `targetKeywords` have no corresponding GSC impressions
- Each gap item shows: article title + target keywords + suggested action
- "These articles are published but Google hasn't indexed them yet" explanatory copy

**Step 5.3** — Create `src/components/intelligence/RecommendationQueue.tsx`

Key elements:
- "Run Analysis" button (calls `runAnalysis()` from store, shows spinner during)
- Recommendation cards — each shows:
  - Type badge: color-coded (update=blue, gap=amber, meta_rewrite=purple, new_spoke=green)
  - Priority badge: high=red, medium=orange, low=gray
  - Title + rationale text
  - Target article link (if contentMapId set)
  - **Approve** button (green): calls `approveRecommendation(rec)` + `router.push("/dashboard")`
  - **Dismiss** button (ghost): calls `dismissRecommendation(rec.id)`
- Empty state: "No pending recommendations. Run analysis to generate insights."

**Step 5.4** — Create `src/components/intelligence/IntelligenceDashboard.tsx`

```typescript
// Client component
// Three internal tabs: Performance | Gap Analysis | Recommendations
// Default: Performance
// Uses useIntelligenceStore
// Fetches performance on mount
// Shows recommendation count badge on the Recommendations tab
```

**Step 5.5** — Create `src/components/intelligence/index.ts` barrel export

**Step 5.6** — Create `src/app/dashboard/intelligence/page.tsx`

```typescript
// Server component (auth handled by dashboard layout — no extra auth needed here)
import { IntelligenceDashboard } from "@/components/intelligence";
export default function IntelligencePage() {
  return <IntelligenceDashboard />;
}
```

**Phase 5 Gate:**
```bash
npx tsc --noEmit
npm run build
```

---

### Phase 6: Navigation + Cron Config (Steps 6.1–6.2)

**Step 6.1** — Edit `src/components/layout/AppShell.tsx`

Add after Photos nav item, before Get Started:
```typescript
const isIntelligence = pathname === "/dashboard/intelligence";

// Nav link:
<Link href="/dashboard/intelligence" style={{ color: isIntelligence ? "#bc9b5d" : "#414141", fontWeight: isIntelligence ? 600 : 400, display: "flex", alignItems: "center", gap: "6px", fontSize: "0.875rem", textDecoration: "none" }}>
  <TrendingUp size={16} />
  Intelligence
</Link>
```

Add `import { TrendingUp } from "lucide-react";` to imports.

**Step 6.2** — Edit `vercel.json` to add cron configuration (from §E8)

**Phase 6 Gate:**
```bash
npx tsc --noEmit
npx next lint
npm run build
```

---

### Phase 7: Integration Test Script (Step 7.1)

**Step 7.1** — Create `scripts/test-guide-gsc.ts`

```typescript
// Test sequence:
// 1. Neon connection — count article_performance and content_recommendation rows
// 2. GSC auth — confirm credentials parse without error  
// 3. GSC fetcher — fetchGscData returns rows
// 4. Matcher — matchPagesToContentMap returns at least 1 match for bhutanwine.com homepage
// 5. Cron route — hit /api/cron/gsc-sync with CRON_SECRET, verify GscSyncResult shape
// 6. Performance route — hit /api/intelligence/performance, verify data shape
// 7. Recommendations route — hit GET /api/intelligence/recommendations
// 8. Analyze route — hit POST /api/intelligence/analyze, verify recommendation shape
// 9. DB state — verify article_performance has rows after cron run
// 10. Human gate: navigate to /dashboard/intelligence, verify all three tabs load
```

---

## G. Acceptance Criteria

All must pass before this guide is considered complete:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0 with zero errors
- [ ] `npx prisma db push` succeeded — `article_performance` and `content_recommendation` tables exist in Neon
- [ ] `GET /api/cron/gsc-sync` with correct CRON_SECRET returns `{ success: true, data: { syncedRows: N } }`
- [ ] After cron run, `article_performance` has at least 1 row in Neon
- [ ] `GET /api/intelligence/performance` returns array with content_map join populated
- [ ] `POST /api/intelligence/analyze` returns valid `ContentRecommendation[]` array
- [ ] `GET /api/intelligence/recommendations` returns pending recommendations
- [ ] `PATCH /api/intelligence/recommendations` with `{ id, action: "approve" }` updates status
- [ ] `/dashboard/intelligence` loads without error
- [ ] Performance tab shows metric cards and article table
- [ ] Gap Analysis tab shows unindexed articles
- [ ] Recommendations tab shows pending recommendations with Approve/Dismiss buttons
- [ ] Approving a recommendation with a contentMapId navigates to /dashboard with the article pre-loaded and the suggested prompt in the chat input
- [ ] Intelligence nav link appears in AppShell between Photos and Get Started
- [ ] Active Intelligence link has gold color (#bc9b5d)
- [ ] `vercel.json` has valid crons entry

---

## H. Risks and Failure Modes

### Risk 1: GSC returns 403 (property mismatch)
**Cause:** `GSC_SITE_URL` still set to `sc-domain:bhutanwine.com`
**Fix:** Change to `https://www.bhutanwine.com/` in both `.env.local` and Vercel dashboard. This is the pre-flight fix in §D.

### Risk 2: `prisma db push` fails on unique constraint
**Cause:** `@@unique([contentMapId, date])` — if you push twice with data
**Fix:** The upsert logic handles this correctly. If the push itself fails, check Neon for conflicting rows and run `npx prisma studio` to inspect.

### Risk 3: Claude returns malformed JSON from analyze route
**Cause:** Model adds preamble or markdown fences before the JSON array
**Fix:** Strip any text before the first `[` and after the last `]`. Add a fallback that returns an empty array with an error log rather than crashing the route.

### Risk 4: No GSC data returned (zero rows)
**Cause:** bhutanwine.com is a new site with limited search traffic
**Fix:** The system should handle zero-row responses gracefully. The cron route returns `syncedRows: 0` with no error. The Intelligence dashboard shows an empty state rather than crashing.

### Risk 5: `setSelectedArticleById` doesn't exist on article store
**Cause:** The code inspector found `setSelectedArticle` (takes a full `ContentMapEntry`) but not `setSelectedArticleById` (takes just an id)
**Fix:** In `approveRecommendation`, fetch the full content map entry by id first:
```typescript
const article = await fetch(`/api/content-map/${rec.contentMapId}`).then(r => r.json());
articleStore.setSelectedArticle(article.data);
```
Or add a `setSelectedArticleById` action to the article store that does this fetch internally.

### Risk 6: Cron route not invoked by Vercel on free/hobby plan
**Cause:** Vercel Cron Jobs require Pro plan
**Fix:** Confirm Vercel plan supports crons. If on hobby, the cron route still works when called manually. Add a "Manual Sync" button in the Intelligence dashboard Settings area that calls the cron route directly (with a user-initiated session instead of the cron secret — requires adding an alternative auth path or a separate manual-sync route).

---

## I. Claude Code Execution Prompt

Copy this into a fresh Claude Code session:

```
Read the implementation guide at guides/guide-seo-intelligence-layer.md.

Execute in this order:

Phase 1: Environment + Schema (Steps 1.1–1.4)
- Fix GSC_SITE_URL and CRON_SECRET in .env.local
- Add Prisma models for ArticlePerformance and ContentRecommendation
- Run: npx prisma db push && npx prisma generate
- Create src/types/intelligence.ts
- Extend src/types/api.ts, activity.ts, and index.ts

Phase 2: GSC Library Module (Steps 2.1–2.5)
- Create src/lib/gsc/ with auth.ts, client.ts, fetcher.ts, matcher.ts, index.ts
- Run GSC smoke test to confirm live API returns data

Phase 3: API Routes (Steps 3.1–3.4)
- Create /api/cron/gsc-sync/route.ts
- Create /api/intelligence/performance/route.ts
- Create /api/intelligence/analyze/route.ts
- Create /api/intelligence/recommendations/route.ts
- Test cron route with curl

Phase 4: Zustand Store (Step 4.1)
- Create src/lib/store/intelligence-store.ts
- Include approveRecommendation with Composer pre-load logic

Phase 5: UI Components (Steps 5.1–5.6)
- Create src/components/intelligence/ with all four components
- Create src/app/dashboard/intelligence/page.tsx

Phase 6: Navigation + Cron Config (Steps 6.1–6.2)
- Edit AppShell.tsx to add Intelligence nav link
- Edit vercel.json to add crons entry

Phase 7: Integration Test Script (Step 7.1)
- Create scripts/test-guide-gsc.ts
- Run it and verify all checks pass

After each phase:
  npx tsc --noEmit
  npx next lint

Stop and report at each phase completion. Do not proceed if type errors or lint failures exist.

Report final status: all acceptance criteria from Section G checked off.
```

---

## J. What to Build Next

After this guide executes and passes all gates:

1. **Manual sync button in Settings** — allows triggering GSC sync outside the Vercel cron schedule (useful for Vercel hobby plan or on-demand refreshes)
2. **Per-article performance history** — clicking an article in the Performance table shows a sparkline of clicks over time
3. **Recommendation templates** — pre-written suggestedPrompt templates for each RecommendationType that Claude fills in with article-specific data
4. **GA4 integration** — layer in bounce rate and session data alongside GSC metrics for deeper content quality signals
