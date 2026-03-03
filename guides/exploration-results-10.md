# Exploration Results — Guide 10: Content Map Dashboard + Blog Registry

**Generated:** 2026-03-02
**Target:** Guide 10 — Content Map Dashboard + Blog Registry
**Dependencies:** Guide 1 (schema), Guide 2 (seeded data), Guide 6 (UI shell)
**Milestone:** M7 — Dashboard

---

## 1. Current Build State

### Guides Complete: 1–9

| Guide | Subsystem | Status |
|---|---|---|
| 1 | Prisma + Auth + Types | Complete |
| 2 | Content Map CRUD + CSV Import + Seed | Complete |
| 3 | Onyx RAG Integration | Complete |
| 4 | Article Schema + Renderer | Complete |
| 5 | Generation Orchestration + Claude API | Complete |
| 6 | Split-Pane UI Shell | Complete |
| 7 | Canvas Edit + HTML Mode + Undo/Redo | Complete |
| 8/8B | QA Scorecard + Targeted Fixes | Complete |
| 9 | Photo Pipeline + Photo Manager | Complete |

### Inventory Summary

| Category | Count | Details |
|---|---|---|
| Prisma models | 9 | User, ContentMap, ArticleDocument, ArticleHtml, InternalLink, Photo, ArticlePhoto, Lead, LeadEvent |
| API routes | 19+ | auth(3), users(2), content-map(3), onyx(2), articles(5), links(1), photos(3+) |
| Type files | 11 | article, api, auth, claude, content-map, onyx, photo, qa, qa-fix, renderer, ui |
| Type interfaces | 55+ | Across all type files |
| Components | 25+ | chat(4), layout(3), preview(5), canvas-edit(3), html-editor(3), scorecard(3), photo-manager(4) |
| Lib modules | 30+ | db, auth, onyx(5), claude, content-map(3), renderer(7), prompt-assembly(6), article-schema, qa(7+), cloudinary(4+), undo-redo, store |
| Database rows | content_map: 39 (8 hubs + 31 spokes, 38 planned + 1 drafting), users: 2, internal_links: 10, photos: 64 CDN assets |

### Integration Health

| Service | Status | Notes |
|---|---|---|
| Neon Postgres | OK | All 9 tables accessible, content_map has 39 rows |
| Onyx CE | PARTIAL | Health OK; admin endpoints return 403 (API key rejected) |
| Claude API | OK | Sonnet 4.5 responding |
| Cloudinary | OK | CDN delivery + signed uploads working |
| Vercel Deploy | OK | Health endpoint returns 200 |

---

## 2. Next Guide Target

### Guide 10: Content Map Dashboard + Blog Registry

**From orchestration doc §7:**

> What it builds: The dashboard views — Table View, Hub View, article detail panel, filters, and link report.
>
> Key decisions:
> - Table View: sortable/filterable by hub, status, type, audience, date
> - Hub View: visual hub-and-spoke tree with status indicators
> - Article detail panel: shows metadata, links to HTML export, QA score, version history
> - Status badges: Planned, Drafting, Finalized, Published, Needs Update
> - Backfill link report: "these existing articles should now link to your new post"

**File Ownership (from §5E):**
- `src/app/api/content-map/recommendations/route.ts` — GET (content gaps)
- `src/app/api/links/graph/route.ts` — GET (link graph data)
- `src/components/dashboard/` — Dashboard components

**Depends on:** Guide 1 (schema), Guide 2 (seeded data), Guide 6 (UI shell)

**Milestone:** M7 — "Content Map dashboard shows all articles with status/filters"

### Architecture Doc References

The Content Map Dashboard spec lives at BWC-Content-Engine-System-Architecture.md §View 2 (lines ~788–935). Key specs:
- **Table View** (default): Sortable/filterable table showing all articles with columns: Hub, Type, Status, Title, Target Keywords, Volume, Difficulty, Scheduled, Published
- **Hub View** (alternate): Visual tree showing hub articles with their spoke children, status badges, dates, and spoke completion counts (e.g., "5/8 spokes")
- **Article Detail Panel**: Opened by clicking any row — shows full metadata, actions (View HTML, Copy HTML, Download, Edit in Chat, Set Scheduled Date, Mark as Published, View QA Report), HTML preview iframe, version history, lead capture stats
- **Status lifecycle**: `planned → drafting → finalized → published → needs_update`

---

## 3. Dependencies Satisfied

### 3.1 Content Map CRUD API (Guide 2) — COMPLETE

All routes exist and follow consistent patterns:

| Route | Methods | File |
|---|---|---|
| `/api/content-map` | GET, POST | `src/app/api/content-map/route.ts` |
| `/api/content-map/[id]` | GET, PATCH, DELETE | `src/app/api/content-map/[id]/route.ts` |
| `/api/content-map/import` | POST | `src/app/api/content-map/import/route.ts` |

**Response format:** `{ success: true, data }` / `{ success: false, error: { code, message } }`

The GET `/api/content-map` already returns all fields needed for the Table View:
- `hubName`, `articleType`, `title`, `slug`, `mainEntity`, `supportingEntities`
- `targetKeywords`, `searchVolumeEst`, `keywordDifficulty`, `targetAudience`
- `status`, `scheduledDate`, `publishedDate`, `publishedUrl`
- `parentHubId`, `contentNotes`, `wordCount`, `qaScore`, `authorName`, `source`
- `createdAt`, `updatedAt`

### 3.2 Content Map Types (Guide 1) — COMPLETE

`src/types/content-map.ts` exports:
- `ArticleType`: `"hub" | "spoke" | "news"`
- `ArticleStatus`: `"planned" | "drafting" | "finalized" | "published" | "needs_update"`
- `ContentMapEntry`: Full 24-field interface matching Prisma ContentMap model
- `InternalLinkEntry`: 7-field interface for link graph data

### 3.3 Prisma ContentMap Model — COMPLETE

**Hub-Spoke Self-Referential Relation** (`prisma/schema.prisma:59-65`):
```prisma
parentHub    ContentMap?   @relation("HubSpokes", fields: [parentHubId], references: [id])
spokes       ContentMap[]  @relation("HubSpokes")
```

This relation enables:
- `parentHubId IS NULL` + `articleType = 'hub'` → Hub articles
- `parentHubId IS NOT NULL` + `articleType = 'spoke'` → Spoke articles grouped under their hub
- Prisma `include: { spokes: true }` → Fetch a hub with all its spoke children

**Grouping fields verified:**
- `hubName` (string) — Cluster grouping key (e.g., "Complete Guide to Bhutan Wine")
- `parentHubId` (FK, nullable) — Self-referential FK for hub-spoke hierarchy
- `articleType` (string) — "hub" | "spoke" | "news"
- `status` (string) — Status lifecycle field

### 3.4 UI Shell (Guide 6) — COMPLETE

`src/components/layout/AppShell.tsx` provides the header with:
- BWC branding
- ArticleSelector dropdown
- **Composer** link → `/dashboard`
- **Photos** link → `/dashboard/photos`
- **Source Drive** link → Google Drive (via `NEXT_PUBLIC_GOOGLE_DRIVE_PHOTOS_FOLDER_URL`)
- User menu (Settings, Sign out)

### 3.5 Dashboard Layout — COMPLETE

```
src/app/dashboard/
├── layout.tsx      ← Server component: auth check + DashboardProviders wrapper
├── providers.tsx   ← SessionProvider for NextAuth
├── page.tsx        ← Main dashboard: Composer (SplitPane with Chat + Preview)
├── settings/
│   └── page.tsx    ← Settings page
└── photos/
    └── page.tsx    ← Photo Manager (Guide 9)
```

**Key observations:**
- `layout.tsx` performs server-side auth check via `getCurrentUser()` → redirects to `/login` if not authenticated
- Dashboard pages are rendered inside `<DashboardProviders>` which provides the NextAuth session
- Current `/dashboard` page = Composer (Chat + Preview split pane)
- Photo Manager page is a simple wrapper: `<PhotoManager />`

### 3.6 Onyx Health/Indexing API — COMPLETE

`src/lib/onyx/health-checker.ts` already knows how to query Onyx indexing status:
- **Health endpoint:** `GET ${baseUrl}/api/health`
- **Indexing status:** `POST ${baseUrl}/api/manage/admin/connector/indexing-status`
  - Returns array of source groups with `summary.total_docs_indexed` and `indexing_statuses[].last_success`
  - Already filters for `source === "google_drive"`

**For "Sync Onyx" re-indexing button**, the Onyx CE admin API provides:
- `POST /api/manage/admin/connector/run-once` — Triggers a one-time re-index of a specific connector
- The connector ID can be obtained from the indexing-status response
- This should be exposed as a new API route or added to the existing `/api/onyx/health` route

### 3.7 Google Drive Bridge — COMPLETE

Environment variables for the dashboard "Source Drive" action button:
- `GOOGLE_DRIVE_PHOTOS_FOLDER_URL` — Full Google Drive folder URL (in `.env.example` and `src/lib/env.ts`)
- `NEXT_PUBLIC_GOOGLE_DRIVE_PHOTOS_FOLDER_URL` — Client-side accessible version (used in `AppShell.tsx:199`)

The existing AppShell already renders a "Source Drive" link using this env var. The Content Map Dashboard can similarly use it as a prominent action button.

### 3.8 Article Store (Zustand) — COMPLETE

`src/lib/store/article-store.ts` is the single Zustand store for the article editor. Key observations:

**Current state shape** (48 fields): Focused entirely on single-article editing — selection, generation, document, HTML, validation, version history, conversation, UI modes, undo/redo, canvas edit, HTML overrides, QA scorecard, photo manifest.

**NOT in scope for extension:** The article-store.ts is specifically designed for the single-article Composer workflow. The Content Map Dashboard should have its **own separate store** (e.g., `src/lib/store/dashboard-store.ts`) for dashboard-specific state:
- Batch selection (Set of selected article IDs)
- Active view mode (table vs hub)
- Filter state (hub, status, type, audience, date range)
- Sort state (column, direction)
- Detail panel state (selected article ID, open/closed)
- Loading states

---

## 4. Dependencies Missing or Needing Extension

### 4.1 New Files to Create

| File | Purpose | Guide 10 Owns |
|---|---|---|
| `src/app/api/content-map/recommendations/route.ts` | GET — Content gap analysis (hubs with fewest published spokes, highest-value unpublished articles) | Yes |
| `src/app/api/links/graph/route.ts` | GET — Link graph data for visualization (articles + their link relationships) | Yes |
| `src/components/dashboard/ContentMapDashboard.tsx` | Main dashboard component (Table View + Hub View toggle) | Yes |
| `src/components/dashboard/TableView.tsx` | Sortable/filterable table of all articles | Yes |
| `src/components/dashboard/HubView.tsx` | Visual hub-and-spoke tree with status indicators | Yes |
| `src/components/dashboard/ArticleDetailPanel.tsx` | Slide-out or full-page article detail view | Yes |
| `src/components/dashboard/FilterBar.tsx` | Filter controls (hub, status, type, audience, date) | Yes |
| `src/components/dashboard/StatusBadge.tsx` | Status indicator component (planned/drafting/finalized/published/needs_update) | Yes |
| `src/components/dashboard/index.ts` | Barrel export | Yes |
| `src/lib/store/dashboard-store.ts` | Zustand store for dashboard state | New (shared) |
| `src/app/dashboard/content-map/page.tsx` | Dashboard page route at `/dashboard/content-map` | New |

### 4.2 Existing Files to Modify

| File | Change | Reason |
|---|---|---|
| `src/components/layout/AppShell.tsx` | Add "Content Map" nav link alongside Composer/Photos | Navigation to new dashboard |
| `src/types/content-map.ts` | Potentially add `spokes?: ContentMapEntry[]` relation field for Hub View | Hub View needs nested spoke data |
| `src/types/ui.ts` | Add dashboard-specific types (DashboardView, FilterState, SortState) | Type safety for dashboard store |
| `src/types/index.ts` | Re-export any new types | Barrel consistency |

### 4.3 Content Map API — Enrichment Needed

The existing GET `/api/content-map` returns flat entries without relation data. For the Hub View, we need entries with their spoke children. Options:
1. **New query parameter:** `GET /api/content-map?include=spokes` — extends existing route
2. **New endpoint:** `GET /api/content-map/hubs` — dedicated hub-with-spokes endpoint
3. **Client-side grouping:** Fetch all entries, group by `hubName`/`parentHubId` in the frontend

**Recommended:** Option 3 (client-side grouping) for simplicity — the content_map table has only 39 rows. All data is already returned by the existing GET endpoint. The dashboard can group articles by `hubName` and build the tree from `parentHubId` references client-side. No new API route needed for this.

---

## 5. Established Patterns to Follow

### 5.1 API Route Handler Pattern

From `src/app/api/content-map/route.ts` (the closest sibling to Guide 10's new routes):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

// Zod schema for validation (if needed)
const SomeSchema = z.object({ ... });

// Select object for consistent field projection
const contentMapSelect = { id: true, hubName: true, /* ... all fields */ };

export async function GET() {
  try {
    await requireRole("admin", "editor", "viewer"); // Read access

    const data = await prisma.contentMap.findMany({ select: contentMapSelect });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
```

**Key patterns:**
- `requireRole()` first in every handler
- `{ success: true, data }` / `{ success: false, error: { code, message } }` response shape
- Zod `.safeParse()` for POST/PATCH body validation
- Error handling: check for "AUTH_REQUIRED" / "AUTH_FORBIDDEN" strings, then generic 500

### 5.2 Dashboard Page Pattern

From `src/app/dashboard/photos/page.tsx`:

```typescript
import { PhotoManager } from "@/components/photo-manager";

export default function PhotosPage() {
  return <PhotoManager />;
}
```

Pattern: Dashboard pages are thin wrappers that import a main component. Auth is handled by `layout.tsx`.

### 5.3 Component Pattern

From `src/components/photo-manager/PhotoManager.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { IconName } from "lucide-react";
import Link from "next/link";

interface LocalType { /* ... */ }

export function ComponentName() {
  const [state, setState] = useState<Type[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/endpoint");
      const data = await res.json();
      if (data.success) setState(data.data);
    } finally {
      setLoading(false);
    }
  }

  // Filter logic as pure functions

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "20px" }}>
      {/* Header with back link, title, actions */}
      {/* Filter bar */}
      {/* Content grid/table */}
    </div>
  );
}
```

**Key patterns:**
- `"use client"` directive at top
- All styling via inline `style={{}}` objects (NOT Tailwind in JSX)
- Icons from `lucide-react`
- `Link` from `next/link` for internal navigation
- Fetches from API routes, checks `data.success`
- Barrel export in `index.ts`

### 5.4 Navigation Pattern

From `AppShell.tsx` (lines 164–217):

Nav items are hardcoded `<Link>` elements with:
- Active state tracked via `usePathname()` — active item gets `color: "#bc9b5d"` and `fontWeight: 600`
- Inactive items get `color: "#414141"` and `fontWeight: 400`
- Icons from `lucide-react` at 14x14px
- Gap of 4px between icon and label
- External links use `<a>` with `target="_blank"` and `ExternalLink` icon

**Current nav order:** Composer | Photos | Source Drive | [spacer] | UserMenu

Guide 10 should add a "Content Map" link between Composer and Photos (or as the first item, since the dashboard is the "mission control" view).

### 5.5 Zustand Store Pattern

From `src/lib/store/article-store.ts`:

```typescript
import { create } from "zustand";
import type { SomeType } from "@/types/some-type";

const initialState: StateType = { /* ... */ };

export const useStore = create<StateType & ActionsType>((set, get) => ({
  ...initialState,

  // Actions
  actionName: (arg: Type) => set({ field: arg }),
  asyncAction: async () => { /* ... */ set({ field: value }); },

  // Reset
  reset: () => set(initialState),
}));

// Selectors (exported separately)
export function selectDerived(state: StateType): DerivedType { /* ... */ }
```

### 5.6 Type Export Pattern

Types organized by domain in `src/types/`:
- One file per domain: `content-map.ts`, `article.ts`, `api.ts`, etc.
- `index.ts` re-exports everything: `export * from "./content-map";`
- Interfaces use PascalCase
- Type literals use PascalCase for unions: `type ArticleStatus = "planned" | "drafting" | ...`

---

## 6. Integration Readiness

| Service | Guide 10 Usage | Status | Notes |
|---|---|---|---|
| Neon Postgres | Content map queries, link graph, article counts | Verified | 39 content_map rows, 10 internal_links, hub/spoke relations intact |
| Onyx CE | "Sync Onyx" button — trigger re-indexing | PARTIAL | Health endpoint OK; admin endpoints return 403 — use read-only health display + "Open Admin" link |
| Google Drive | "Source Drive" action button | Verified | `NEXT_PUBLIC_GOOGLE_DRIVE_PHOTOS_FOLDER_URL` already rendered in AppShell |
| Vercel | Dashboard page deployment | Verified | Build passes, all routes compile |

### Onyx Admin API — Re-Index Trigger

**CRITICAL FINDING (Integration Verifier):** The `ONYX_API_KEY` is rejected (HTTP 403) by all Onyx admin endpoints including `/api/admin/search` and `/api/manage/admin/connector/indexing-status`. Only the unauthenticated `GET /api/health` works. This means:

1. **KB search in article generation** — currently cannot authenticate against Onyx admin endpoints
2. **Proposed "Sync Onyx" button** — cannot programmatically trigger re-indexing

**What works:**
- `GET /api/health` — unauthenticated, returns 200 (healthy/unhealthy badge)

**What doesn't work:**
- `POST /api/manage/admin/connector/indexing-status` — 403 Forbidden
- `POST /api/manage/admin/connector/run-once` — 403 Forbidden
- `POST /api/admin/search` — 403 Forbidden

**Recommendation for Guide 10:**
- Implement "Sync Onyx" as a **read-only health status display** (healthy/unhealthy badge from `/api/health`)
- Add an **"Open Onyx Admin" external link** to `https://rmoss-onyx.xyz` for manual re-indexing
- The Onyx API key authentication issue should be investigated separately (likely needs a different API key or OAuth token for admin endpoints)

---

## 7. Risks and Blockers

### 7.1 No Blockers

All dependencies are satisfied. Guide 10 can proceed immediately.

### 7.2 Low-Risk Items

| Risk | Severity | Mitigation |
|---|---|---|
| Dashboard route conflicts with existing `/dashboard` (Composer) | LOW | Place Content Map at `/dashboard/content-map` — follows the existing pattern (`/dashboard/photos`) |
| Content Map GET returns flat list (no nested spokes) | LOW | Client-side grouping is sufficient for 39 rows. No API change needed. |
| No existing table/sort UI primitives | LOW | Build inline — the project uses inline styles, no component library |
| Onyx admin endpoints return 403 | MEDIUM | API key rejected by admin endpoints. Use read-only health display + "Open Onyx Admin" link. Investigate auth separately. |

### 7.3 Architectural Decision: Dashboard Page Placement

**Option A — New route `/dashboard/content-map`** (Recommended)
- Follows existing pattern: `/dashboard/photos`, `/dashboard/settings`
- Composer stays at `/dashboard` as the primary work surface
- Clean separation of concerns

**Option B — Replace `/dashboard` with Content Map, move Composer**
- Content Map becomes the landing page at `/dashboard`
- Composer moves to `/dashboard/compose` or similar
- Better matches "Mission Control" concept but is a breaking change to the existing route

**Recommendation:** Option A — non-breaking, follows established patterns

---

## 8. Deviations from Plan

### 8.1 Dashboard Directory Structure

The orchestration doc's file tree (§5B) shows `src/app/(dashboard)/page.tsx` but the actual codebase uses `src/app/dashboard/page.tsx` (without route group parentheses). Guide 10 should follow the **actual** codebase pattern:

```
src/app/dashboard/
├── layout.tsx          ← Existing (auth + providers)
├── page.tsx            ← Existing (Composer)
├── providers.tsx       ← Existing
├── settings/page.tsx   ← Existing
├── photos/page.tsx     ← Existing (Guide 9)
└── content-map/        ← NEW (Guide 10)
    └── page.tsx
```

### 8.2 Component Directory

The orchestration doc §5E says Guide 10 owns `src/components/dashboard/`. This is correct — the dashboard components should live here, NOT in `src/app/dashboard/`. Following established convention:
- Page files in `src/app/dashboard/content-map/page.tsx` (thin wrapper)
- Components in `src/components/dashboard/` (all logic)

### 8.3 Inline Styles (Not Tailwind)

The orchestration doc doesn't specify styling approach, but the codebase consistently uses **inline `style={{}}` objects** throughout all components (AppShell, ChatPanel, PhotoManager, etc.). Guide 10 MUST follow this pattern — NOT Tailwind utility classes in JSX.

### 8.4 Photo Manager Exists (Guide 9 Complete)

The orchestration doc §2 listed Photo Manager as "NOT Built Yet" but it's now complete. Guide 9 delivered:
- `src/components/photo-manager/` with PhotoManager, PhotoCard, PhotoSelector, index
- `src/app/api/photos/` routes
- `src/app/dashboard/photos/page.tsx`
- Navigation links in AppShell

---

## 9. User-Requested Investigation Items

### 9.1 Dashboard Directory Mapping

```
src/app/dashboard/           ← Route: /dashboard
├── layout.tsx               ← Auth guard + DashboardProviders
├── providers.tsx             ← SessionProvider wrapper
├── page.tsx                  ← Composer (SplitPane: ChatPanel + PreviewPanel)
├── settings/
│   └── page.tsx              ← Settings page
└── photos/
    └── page.tsx              ← PhotoManager wrapper (Guide 9)

RECOMMENDED for Guide 10:
└── content-map/
    └── page.tsx              ← ContentMapDashboard wrapper
```

### 9.2 Onyx Admin Integration — Re-Index Endpoint

**Existing infrastructure:**
- `src/lib/onyx/health-checker.ts` already calls `POST /api/manage/admin/connector/indexing-status`
- Returns connector ID, credential ID, indexed document count, last success time
- The Onyx base URL is `https://rmoss-onyx.xyz` (from `env.ONYX_BASE_URL`)

**For "Sync Onyx" button:**
- **Programmatic approach:** `POST ${ONYX_BASE_URL}/api/manage/admin/connector/run-once` with `{ connector_id, credential_id }` extracted from indexing-status
- **Simple approach:** External link to `https://rmoss-onyx.xyz` (Onyx admin UI)
- **Recommended:** Show indexing status (docs indexed, last sync time) from existing health check + "Open Onyx Admin" link. Add programmatic trigger as a future enhancement.

### 9.3 Store Extension — Batch Selection

The existing `article-store.ts` is scoped to the Composer workflow (single-article editing). **Do NOT extend it** for dashboard state.

Create a new **`src/lib/store/dashboard-store.ts`** with:

```typescript
interface DashboardState {
  // View mode
  activeView: "table" | "hub";

  // Filters
  hubFilter: string | null;        // Filter by hubName
  statusFilter: ArticleStatus | null;
  typeFilter: ArticleType | null;
  audienceFilter: string | null;
  dateRange: { from: Date | null; to: Date | null };

  // Sort
  sortColumn: string;
  sortDirection: "asc" | "desc";

  // Batch selection
  selectedIds: Set<number>;        // Article IDs selected for batch operations

  // Detail panel
  detailArticleId: number | null;  // Currently open article detail
  isDetailOpen: boolean;

  // Data
  articles: ContentMapEntry[];
  isLoading: boolean;
}

interface DashboardActions {
  setActiveView: (view: "table" | "hub") => void;
  setFilter: (key: string, value: unknown) => void;
  clearFilters: () => void;
  setSort: (column: string, direction: "asc" | "desc") => void;
  toggleSelection: (id: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  openDetail: (id: number) => void;
  closeDetail: () => void;
  fetchArticles: () => Promise<void>;
  batchUpdateStatus: (ids: number[], status: ArticleStatus) => Promise<void>;
}
```

### 9.4 Cluster Visualization — Content Map Table Audit

The `content_map` table (Prisma `ContentMap` model) has all fields needed for hub-and-spoke grouping:

| Field | Type | Purpose for Hub View |
|---|---|---|
| `id` | int | Primary key, used for parent reference |
| `hubName` | string | Cluster grouping key (e.g., "Complete Guide to Bhutan Wine") |
| `articleType` | string | "hub" \| "spoke" \| "news" — visual differentiation |
| `parentHubId` | int? | FK to self — spokes reference their hub's ID |
| `status` | string | Status badge rendering |
| `title` | string | Display text |
| `scheduledDate` | Date? | Show planned date |
| `publishedDate` | Date? | Show actual publish date |

**Hub View algorithm (client-side):**

```typescript
function buildHubTree(articles: ContentMapEntry[]) {
  const hubs = articles.filter(a => a.articleType === "hub");
  return hubs.map(hub => ({
    hub,
    spokes: articles.filter(a => a.parentHubId === hub.id),
    spokeCount: articles.filter(a => a.parentHubId === hub.id).length,
    publishedCount: articles.filter(a => a.parentHubId === hub.id && a.status === "published").length,
  }));
}
```

**News articles** (no parent hub) should appear in a separate "Unclustered / News" section.

### 9.5 Navigation Logic — AppShell.tsx

**Current nav structure** (`src/components/layout/AppShell.tsx:164-217`):

```
[BWC Content Engine] | [ArticleSelector] | [Composer] | [Photos] | [Source Drive] | [spacer] | [UserMenu]
```

**Guide 10 should add** a "Content Map" link:

```
[BWC Content Engine] | [ArticleSelector] | [Composer] | [Content Map] | [Photos] | [Source Drive] | [spacer] | [UserMenu]
```

**Implementation:** Add a new `<Link>` element after the Composer link with:
- `href="/dashboard/content-map"`
- Icon: `LayoutDashboard` or `Map` from lucide-react
- Active state: `pathname === "/dashboard/content-map"` or `pathname.startsWith("/dashboard/content-map")`
- Same styling pattern as Composer/Photos links

**Active state update needed:** The current `isPhotos` boolean only tracks one route. Refactor to a more flexible active detection:

```typescript
const pathname = usePathname();
const activeNav = pathname.startsWith("/dashboard/content-map") ? "content-map"
  : pathname === "/dashboard/photos" ? "photos"
  : "composer";
```

### 9.6 Google Drive Bridge

The env var `NEXT_PUBLIC_GOOGLE_DRIVE_PHOTOS_FOLDER_URL` is already used in:
- `AppShell.tsx:199` — Renders "Source Drive" external link in header
- `PhotoManager.tsx:129` — Renders "Source Drive" button in photo library

For the Content Map Dashboard, the same env var can power a "Source Drive" action button. Since it's a `NEXT_PUBLIC_` variable, it's available client-side. Pattern already established.

Additionally, the dashboard could show a broader "Source Documents" link. Check if there's a separate env var for the main KB folder (not just photos). Currently only `GOOGLE_DRIVE_PHOTOS_FOLDER_URL` exists — the general KB folder URL is not configured as an env var.

---

## 10. Hub-and-Spoke Visualization Concept

### ASCII Layout — Hub View

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Content Map           [Hub View *] [Table View]  [+ New Article] [Sync]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Complete Guide to Bhutan Wine                      5/8 published │  │
│  │ ████████████████████░░░░░░░░  62%                                │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  🏛 ✅ Bhutan Wine: The Complete Guide (Hub)      Published      │  │
│  │  ◗  ✅ Himalayan Terroir Explained                Published      │  │
│  │  ◗  📦 Traminette Grape Guide                    Finalized      │  │
│  │  ◗  ✅ The Ser Kem Auction Story                  Published      │  │
│  │  ◗  ✅ Buddhist Winemaking: Ahimsa                Published      │  │
│  │  ◗  ⬜ Bhutan Grape Varieties Deep Dive           Planned        │  │
│  │  ◗  ⬜ 2024 Vintage Tasting Notes                 Planned        │  │
│  │  ◗  ⬜ Visiting BWC: The Vineyard Tour Guide      Planned        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ High-Altitude Viticulture                         2/6 published  │  │
│  │ █████░░░░░░░░░░░░░░░░░░░░░░  33%                                │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  🏛 ✅ High-Altitude Viticulture (Hub)            Published      │  │
│  │  ◗  ✅ UV Exposure and Phenolic Ripeness          Published      │  │
│  │  ◗  🔶 World's Highest Vineyards Compared         Drafting       │  │
│  │  ◗  ⬜ Frost Protection in Mountain Vineyards     Planned        │  │
│  │  ◗  ⬜ Diurnal Temperature and Flavor Complexity  Planned        │  │
│  │  ◗  ⬜ High-Altitude Harvest Logistics            Planned        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Emerging Wine Regions                             0/4 published  │  │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░  0%                                 │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  🏛 ⬜ Emerging Wine Regions (Hub)                 Planned        │  │
│  │  ◗  ⬜ Bhutan vs Nepal vs India                    Planned        │  │
│  │  ...                                                              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Status Badge Mapping

| Status | Icon | Color | Label |
|---|---|---|---|
| planned | ⬜ | `#94a3b8` (gray) | Planned |
| drafting | 🔶 | `#f59e0b` (amber) | Drafting |
| finalized | 📦 | `#3b82f6` (blue) | Finalized |
| published | ✅ | `#22c55e` (green) | Published |
| needs_update | 🔄 | `#ef4444` (red) | Needs Update |

### Article Type Icons

| Type | Icon | Description |
|---|---|---|
| hub | 🏛 | Hub article (parent) |
| spoke | ◗ | Spoke article (child) |
| news | 📰 | News article (standalone) |

---

## 11. Recommended Build Phases

### Phase 1: Foundation (Types + Store + Route)
- Add dashboard types to `src/types/ui.ts` or new `src/types/dashboard.ts`
- Create `src/lib/store/dashboard-store.ts`
- Create page route `src/app/dashboard/content-map/page.tsx`
- Create `src/components/dashboard/index.ts` barrel

### Phase 2: Table View
- Create `src/components/dashboard/ContentMapDashboard.tsx`
- Create `src/components/dashboard/StatusBadge.tsx`
- Create `src/components/dashboard/FilterBar.tsx`
- Create `src/components/dashboard/TableView.tsx`
- Fetch data from existing `GET /api/content-map`

### Phase 3: Hub View
- Create `src/components/dashboard/HubView.tsx`
- Build client-side hub-spoke tree from flat data
- Progress bar per hub (published/total)
- Toggle between Table View and Hub View

### Phase 4: Article Detail Panel
- Create `src/components/dashboard/ArticleDetailPanel.tsx`
- Show metadata, actions (Edit in Chat, View QA, Copy HTML link)
- Version history summary (from article_documents/article_html)
- Internal link list

### Phase 5: API Routes + Batch Operations
- Create `src/app/api/content-map/recommendations/route.ts`
- Create `src/app/api/links/graph/route.ts`
- Batch status update using existing PATCH `/api/content-map/[id]`
- Onyx health display + link to admin

### Phase 6: Navigation + Integration
- Update `AppShell.tsx` with "Content Map" nav link
- Wire "Edit in Chat" to navigate to Composer with article pre-selected
- Wire "Sync Onyx" to display indexing status
- Integration gate tests

---

## 12. Files Quick Reference

### Files to CREATE

```
src/app/dashboard/content-map/page.tsx
src/app/api/content-map/recommendations/route.ts
src/app/api/links/graph/route.ts
src/components/dashboard/ContentMapDashboard.tsx
src/components/dashboard/TableView.tsx
src/components/dashboard/HubView.tsx
src/components/dashboard/ArticleDetailPanel.tsx
src/components/dashboard/FilterBar.tsx
src/components/dashboard/StatusBadge.tsx
src/components/dashboard/index.ts
src/lib/store/dashboard-store.ts
scripts/test-guide-10.ts
```

### Files to MODIFY

```
src/components/layout/AppShell.tsx     ← Add "Content Map" nav link
src/types/ui.ts                        ← Add dashboard types (or new file)
src/types/index.ts                     ← Re-export new types
```

### Files NOT to Modify (owned by other guides)

```
src/app/api/content-map/route.ts       ← Guide 2 owns
src/app/api/content-map/[id]/route.ts  ← Guide 2 owns
src/lib/store/article-store.ts         ← Guide 6/7/8 own
prisma/schema.prisma                   ← Guide 1 owns
src/lib/onyx/                          ← Guide 3 owns (read-only import)
```
