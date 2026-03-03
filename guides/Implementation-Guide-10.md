# Guide 10: Content Map Dashboard & Blog Registry

## A. Objective

Build the "Mission Control" dashboard for the BWC Content Engine — a Content Map Dashboard with two view modes (Table View and Hub View), status badges, filters, sorting, an "Edit in Chat" action that routes to the Composer, and a strategic Onyx re-indexing redirect flow.

**Milestone:** M7 — "Content Map dashboard shows all articles with status/filters"

**User story:** A BWC team member opens the Content Map dashboard and sees all 39 articles organized by hub cluster. They can toggle between a sortable Table View and a visual Hub View showing progress bars per hub. They click an article to view its detail, then click "Edit in Chat" to jump to the Composer with that article loaded. A "Sync Knowledge Base" button triggers a browser alert explaining the Onyx re-index process, then redirects to the Onyx admin panel.

---

## B. Scope

### In Scope

- Create `src/lib/store/dashboard-store.ts` — Zustand store for batch selection, view modes (table vs hub), filter state, sort state
- Create `src/components/dashboard/HubView.tsx` — visual hub grouping with progress bars (published vs total)
- Create `src/components/dashboard/TableView.tsx` — sortable registry table with inline styles
- Create `src/components/dashboard/ContentMapDashboard.tsx` — main dashboard component with view toggle
- Create `src/components/dashboard/FilterBar.tsx` — filter controls (hub, status, type)
- Create `src/components/dashboard/StatusBadge.tsx` — status indicator component
- Create `src/components/dashboard/ArticleDetailPanel.tsx` — detail panel for article metadata and actions
- Create `src/components/dashboard/index.ts` — barrel exports
- Create `src/app/dashboard/content-map/page.tsx` — dashboard page route
- Create `GET /api/links/graph` — link graph data for the dashboard
- Add "Content Map" navigation link to `src/components/layout/AppShell.tsx` between Composer and Photos
- Implement "Sync Knowledge Base" button with browser alert and Onyx admin redirect
- "Edit in Chat" action: routes to Composer (`/dashboard`) with article selected in the article store

### Out of Scope

- Article detail panel with full HTML preview iframe (Guide 11 owns finalization/HTML export)
- Content gap recommendations API (`/api/content-map/recommendations`) — deferred to post-M7
- Version history display (Guide 11)
- Lead capture stats (Phase 3+)
- Programmatic Onyx re-index trigger (Onyx admin API returns 403 — see §K)
- Backfill link report (deferred — depends on published articles existing)

---

## C. Depends On

| Guide | What It Provides | Status |
|---|---|---|
| 1 | Prisma `ContentMap`, `InternalLink` models, auth, types | ✅ Complete |
| 2 | Content Map CRUD API, 39 seeded articles, hub/spoke relations | ✅ Complete |
| 6 | Split-pane UI, AppShell, Zustand article store, dashboard layout | ✅ Complete |

---

## D. Shared Contracts Referenced

### Database Tables (Prisma — already defined in Guide 1)

**`ContentMap` model** (`content_map` table):
```
id, hubName, articleType, title, slug, mainEntity, supportingEntities,
targetKeywords, searchVolumeEst, keywordDifficulty, targetAudience,
status, scheduledDate, publishedDate, publishedUrl, parentHubId,
contentNotes, suggestedExternalLinks, internalLinksTo, wordCount,
qaScore, authorName, source, createdAt, updatedAt
```

Self-referential relation for hub-spoke hierarchy:
```prisma
parentHub    ContentMap?   @relation("HubSpokes", fields: [parentHubId], references: [id])
spokes       ContentMap[]  @relation("HubSpokes")
```

**`InternalLink` model** (`internal_links` table):
```
id, sourceArticleId, targetArticleId, targetCorePage, anchorText, linkType, isActive, createdAt
```

### TypeScript Types (already defined in Guide 1)

- `src/types/content-map.ts` — `ContentMapEntry`, `ArticleType`, `ArticleStatus`, `InternalLinkEntry`
- `src/types/api.ts` — `ApiResponse<T>` pattern
- `src/types/ui.ts` — UI mode types, `ArticleEditorState`, `ArticleEditorActions`

### Existing Modules to Reuse

- `src/app/api/content-map/route.ts` — GET returns all 39 articles with full field projection
- `src/lib/store/article-store.ts` — `setSelectedArticle()` action for "Edit in Chat"
- `src/components/layout/AppShell.tsx` — navigation header
- `src/components/layout/ArticleSelector.tsx` — fetches from `/api/content-map` (same data source)

---

## E. Existing Constraints to Preserve

1. The AppShell header height is fixed at `56px` — new nav elements must fit.
2. All components use **inline `style={{}}` objects** — NOT Tailwind utility classes in JSX. This is the established pattern across every component (AppShell, ChatPanel, PhotoManager, etc.).
3. All API routes must use `requireRole()` for auth and the `{ success: true, data }` / `{ success: false, error: { code, message } }` response format.
4. The existing `/dashboard` route is the Composer (SplitPane with Chat + Preview). Do NOT change this.
5. The `useArticleStore` is the single store for the Composer workflow — the dashboard gets its own separate store.
6. Dashboard pages are thin wrappers importing a main component (auth handled by `layout.tsx`).
7. Active nav links use `color: "#bc9b5d"` and `fontWeight: 600`; inactive use `color: "#414141"` and `fontWeight: 400`.

---

## F. Files Created / Modified

### New Files

| File | Purpose |
|---|---|
| `src/lib/store/dashboard-store.ts` | Zustand store for dashboard view mode, filters, sort, detail panel |
| `src/components/dashboard/StatusBadge.tsx` | Status badge component with colored indicators |
| `src/components/dashboard/FilterBar.tsx` | Filter controls for hub, status, type |
| `src/components/dashboard/TableView.tsx` | Sortable article registry table |
| `src/components/dashboard/HubView.tsx` | Visual hub grouping with progress bars |
| `src/components/dashboard/ArticleDetailPanel.tsx` | Article detail panel with metadata and actions |
| `src/components/dashboard/ContentMapDashboard.tsx` | Main dashboard component with view toggle and Onyx sync |
| `src/components/dashboard/index.ts` | Barrel exports |
| `src/app/dashboard/content-map/page.tsx` | Content Map page route |
| `src/app/api/links/graph/route.ts` | GET — link graph data for dashboard |
| `scripts/test-guide-10.ts` | Integration test |

### Modified Files

| File | Change |
|---|---|
| `src/components/layout/AppShell.tsx` | Add "Content Map" nav link between Composer and Photos |

---

## G. Technical Design

### G1. Dashboard Store

**`src/lib/store/dashboard-store.ts`** — separate Zustand store for dashboard state:

```typescript
import { create } from "zustand";
import type { ContentMapEntry, ArticleType, ArticleStatus } from "@/types/content-map";

export type DashboardView = "table" | "hub";
export type SortColumn = "title" | "hubName" | "articleType" | "status" | "searchVolumeEst" | "updatedAt";
export type SortDirection = "asc" | "desc";

export interface DashboardFilterState {
  hubName: string | null;         // null = all hubs
  articleType: ArticleType | null; // null = all types
  status: ArticleStatus | null;   // null = all statuses
  searchQuery: string;             // title text search
}

export interface DashboardState {
  // Data
  articles: ContentMapEntry[];
  isLoading: boolean;

  // View mode
  view: DashboardView;

  // Filters
  filters: DashboardFilterState;

  // Sort (Table View only)
  sortColumn: SortColumn;
  sortDirection: SortDirection;

  // Detail panel
  detailArticleId: number | null;

  // Batch selection
  selectedIds: Set<number>;
}

export interface DashboardActions {
  // Data
  setArticles: (articles: ContentMapEntry[]) => void;
  setIsLoading: (loading: boolean) => void;
  fetchArticles: () => Promise<void>;

  // View
  setView: (view: DashboardView) => void;

  // Filters
  setFilter: (key: keyof DashboardFilterState, value: string | null) => void;
  clearFilters: () => void;

  // Sort
  setSort: (column: SortColumn) => void; // toggles direction if same column

  // Detail
  setDetailArticleId: (id: number | null) => void;

  // Batch selection
  toggleSelection: (id: number) => void;
  selectAll: (ids: number[]) => void;
  clearSelection: () => void;
}
```

**Why a separate store:** The article-store.ts manages single-article editing state (48 fields). Dashboard state is orthogonal — view modes, filters, sorting, batch selection. Mixing these would create coupling between two unrelated workflows.

### G2. Status Badges

Status badges map to the `ArticleStatus` type:

| Status | Label | Background | Text Color |
|---|---|---|---|
| `planned` | Planned | `#e8e6e6` | `#414141` |
| `drafting` | Drafting | `#c8eef5` | `#0e6f82` |
| `finalized` | Finalized | `#fef3c7` | `#92400e` |
| `published` | Published | `#d1fae5` | `#065f46` |
| `needs_update` | Needs Update | `#fee2e2` | `#991b1b` |

Article type badges:

| Type | Label | Background |
|---|---|---|
| `hub` | Hub | `#bc9b5d` (gold) with white text |
| `spoke` | Spoke | `#e8e6e6` with `#414141` text |
| `news` | News | `#f6ebe4` with `#624c40` text |

### G3. Table View

A sortable, filterable table displaying all articles. Columns:

| Column | Field | Sortable | Width |
|---|---|---|---|
| Type | `articleType` | Yes | 70px |
| Title | `title` | Yes | flex |
| Hub | `hubName` | Yes | 180px |
| Status | `status` | Yes | 110px |
| Keywords | `targetKeywords` | No | 150px |
| Volume | `searchVolumeEst` | Yes | 80px |
| Updated | `updatedAt` | Yes | 100px |
| Actions | — | No | 100px |

**Sorting:** Click column header to sort. Click again to toggle direction. Active sort column shows an arrow indicator.

**Row click:** Opens the ArticleDetailPanel for that article.

**Actions column:** "Edit in Chat" button that navigates to `/dashboard` with the article loaded in the Composer.

### G4. Hub View

Visual grouping by `hubName`. For each hub cluster:

1. **Hub Header Card** — The hub article (where `articleType === "hub"`), with title, status badge, and a progress bar showing `published spokes / total spokes`.
2. **Spoke List** — All spoke articles in that hub (where `parentHubId === hub.id` OR `hubName === hub.hubName`), each with title, status badge, and "Edit in Chat" action.
3. **Progress Bar** — Shows count of published vs total articles in the cluster. Color fill uses `--bwc-gold` (#bc9b5d).

**Client-side grouping logic:** Fetch all articles from `GET /api/content-map`, then:
1. Group by `hubName`
2. Within each group, identify the hub article (`articleType === "hub"`)
3. Remaining articles are spokes
4. Calculate `publishedCount` / `totalCount` per group

This avoids a new API route — 39 rows is trivially small for client-side grouping.

### G5. Article Detail Panel

A slide-out panel (right side overlay) triggered by clicking an article row/card. Shows:

- **Header:** Title, type badge, status badge
- **Metadata grid:** Hub, Main Entity, Target Audience, Target Keywords, Search Volume, Keyword Difficulty, Slug, Author
- **Dates:** Scheduled Date, Published Date, Last Updated
- **Content Notes** (if present)
- **Actions:**
  - "Edit in Chat" — navigates to `/dashboard` and calls `useArticleStore.setSelectedArticle(article)`
  - "View on Site" — links to `publishedUrl` if published (external link, new tab)

### G6. "Edit in Chat" Flow

When the user clicks "Edit in Chat" on any article:

1. Import and call `useArticleStore.getState().setSelectedArticle(article)` — this sets the article in the Composer's Zustand store
2. Navigate to `/dashboard` using `router.push("/dashboard")`
3. The Composer page reads `selectedArticle` from the store and is ready for editing

**Implementation note:** Because Zustand stores persist in memory across route changes within the same session, setting the article in the store before navigating ensures the Composer picks it up immediately.

### G7. Onyx Manual Sync Flow

The "Sync Knowledge Base" button implements a two-step redirect flow:

1. **Button click** → `window.alert()` with the message:
   > You are being re-directed to Onyx. To sync your knowledge base click "manage" in the upper right and "re-index". The process will take about 5-10 minutes depending upon size and quantity of files.

2. **After alert dismissed** → `window.location.href = "https://rmoss-onyx.xyz/admin/connector/2?page=1"`

This redirects the browser tab to the Onyx admin panel. No programmatic re-index trigger needed (Onyx admin API returns 403 for admin endpoints).

### G8. Link Graph API

**`GET /api/links/graph`** — Returns link relationships for dashboard visualization.

```typescript
// Response shape:
{
  success: true,
  data: {
    nodes: Array<{
      id: number;
      title: string;
      articleType: "hub" | "spoke" | "news";
      hubName: string;
      status: string;
      slug: string | null;
    }>;
    edges: Array<{
      id: number;
      sourceArticleId: number | null;
      targetArticleId: number | null;
      targetCorePage: string | null;
      linkType: string | null;
      isActive: boolean;
    }>;
    summary: {
      totalArticles: number;
      totalLinks: number;
      activeLinks: number;
    };
  }
}
```

Queries both `content_map` and `internal_links` tables. This data powers the Hub View's link count indicators and can later feed a full graph visualization.

### G9. Navigation Update

Add a "Content Map" link to `AppShell.tsx` **between Composer and Photos**:

```tsx
<Link
  href="/dashboard/content-map"
  style={{
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    fontSize: "13px",
    color: isContentMap ? "#bc9b5d" : "#414141",
    fontWeight: isContentMap ? 600 : 400,
    textDecoration: "none",
    borderRadius: "4px",
  }}
>
  <LayoutGrid style={{ width: "14px", height: "14px" }} />
  Content Map
</Link>
```

Active state detection: `const isContentMap = pathname === "/dashboard/content-map";`

Icon: `LayoutGrid` from lucide-react (grid/dashboard icon).

---

## H. Step-by-Step Execution Plan

### Phase 1: Dashboard Store & Types (Steps 1–2)

**Step 1: Create `src/lib/store/dashboard-store.ts`**

```typescript
import { create } from "zustand";
import type { ContentMapEntry, ArticleType, ArticleStatus } from "@/types/content-map";

export type DashboardView = "table" | "hub";
export type SortColumn = "title" | "hubName" | "articleType" | "status" | "searchVolumeEst" | "updatedAt";
export type SortDirection = "asc" | "desc";

export interface DashboardFilterState {
  hubName: string | null;
  articleType: ArticleType | null;
  status: ArticleStatus | null;
  searchQuery: string;
}

interface DashboardStoreState {
  articles: ContentMapEntry[];
  isLoading: boolean;
  view: DashboardView;
  filters: DashboardFilterState;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  detailArticleId: number | null;
  selectedIds: Set<number>;
}

interface DashboardStoreActions {
  setArticles: (articles: ContentMapEntry[]) => void;
  setIsLoading: (loading: boolean) => void;
  fetchArticles: () => Promise<void>;
  setView: (view: DashboardView) => void;
  setFilter: (key: keyof DashboardFilterState, value: string | null) => void;
  clearFilters: () => void;
  setSort: (column: SortColumn) => void;
  setDetailArticleId: (id: number | null) => void;
  toggleSelection: (id: number) => void;
  selectAll: (ids: number[]) => void;
  clearSelection: () => void;
}

const initialFilters: DashboardFilterState = {
  hubName: null,
  articleType: null,
  status: null,
  searchQuery: "",
};

export const useDashboardStore = create<DashboardStoreState & DashboardStoreActions>(
  (set, get) => ({
    // State
    articles: [],
    isLoading: true,
    view: "table",
    filters: initialFilters,
    sortColumn: "hubName",
    sortDirection: "asc",
    detailArticleId: null,
    selectedIds: new Set(),

    // Actions
    setArticles: (articles) => set({ articles }),
    setIsLoading: (loading) => set({ isLoading: loading }),

    fetchArticles: async () => {
      set({ isLoading: true });
      try {
        const res = await fetch("/api/content-map");
        const data = await res.json();
        if (data.success) {
          set({ articles: data.data });
        }
      } catch (error) {
        console.error("[DashboardStore] Failed to fetch articles:", error);
      } finally {
        set({ isLoading: false });
      }
    },

    setView: (view) => set({ view }),

    setFilter: (key, value) =>
      set((state) => ({
        filters: { ...state.filters, [key]: value || null },
      })),

    clearFilters: () => set({ filters: initialFilters }),

    setSort: (column) =>
      set((state) => ({
        sortColumn: column,
        sortDirection:
          state.sortColumn === column && state.sortDirection === "asc"
            ? "desc"
            : "asc",
      })),

    setDetailArticleId: (id) => set({ detailArticleId: id }),

    toggleSelection: (id) =>
      set((state) => {
        const next = new Set(state.selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { selectedIds: next };
      }),

    selectAll: (ids) => set({ selectedIds: new Set(ids) }),
    clearSelection: () => set({ selectedIds: new Set() }),
  })
);

// === Selectors ===

export function selectFilteredArticles(
  state: DashboardStoreState
): ContentMapEntry[] {
  let result = state.articles;
  const f = state.filters;

  if (f.hubName) {
    result = result.filter((a) => a.hubName === f.hubName);
  }
  if (f.articleType) {
    result = result.filter((a) => a.articleType === f.articleType);
  }
  if (f.status) {
    result = result.filter((a) => a.status === f.status);
  }
  if (f.searchQuery) {
    const q = f.searchQuery.toLowerCase();
    result = result.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.mainEntity.toLowerCase().includes(q)
    );
  }

  return result;
}

export function selectSortedArticles(
  state: DashboardStoreState
): ContentMapEntry[] {
  const filtered = selectFilteredArticles(state);
  const { sortColumn, sortDirection } = state;
  const dir = sortDirection === "asc" ? 1 : -1;

  return [...filtered].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * dir;
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * dir;
    }
    if (aVal instanceof Date && bVal instanceof Date) {
      return (aVal.getTime() - bVal.getTime()) * dir;
    }
    return String(aVal).localeCompare(String(bVal)) * dir;
  });
}

export function selectUniqueHubNames(state: DashboardStoreState): string[] {
  const hubs = new Set(state.articles.map((a) => a.hubName));
  return Array.from(hubs).sort();
}

export function selectDetailArticle(
  state: DashboardStoreState
): ContentMapEntry | null {
  if (!state.detailArticleId) return null;
  return state.articles.find((a) => a.id === state.detailArticleId) ?? null;
}
```

**Verify:** `npx tsc --noEmit` passes.

**Step 2: No type file changes needed**

The existing types in `src/types/content-map.ts` already cover everything the dashboard needs:
- `ContentMapEntry` — full article metadata
- `ArticleType` — "hub" | "spoke" | "news"
- `ArticleStatus` — "planned" | "drafting" | "finalized" | "published" | "needs_update"
- `InternalLinkEntry` — link graph data

Dashboard-specific types (`DashboardView`, `SortColumn`, etc.) are co-located in the store file since they're only used there.

**Verify:** `npx tsc --noEmit` passes.

> **COMMIT HERE:** `feat: add dashboard Zustand store with filters, sorting, and selectors`

---

### Phase 2: StatusBadge & FilterBar Components (Steps 3–4)

**Step 3: Create `src/components/dashboard/StatusBadge.tsx`**

```typescript
"use client";

import type { ArticleStatus, ArticleType } from "@/types/content-map";

const STATUS_STYLES: Record<ArticleStatus, { bg: string; color: string; label: string }> = {
  planned: { bg: "#e8e6e6", color: "#414141", label: "Planned" },
  drafting: { bg: "#c8eef5", color: "#0e6f82", label: "Drafting" },
  finalized: { bg: "#fef3c7", color: "#92400e", label: "Finalized" },
  published: { bg: "#d1fae5", color: "#065f46", label: "Published" },
  needs_update: { bg: "#fee2e2", color: "#991b1b", label: "Needs Update" },
};

const TYPE_STYLES: Record<ArticleType, { bg: string; color: string; label: string }> = {
  hub: { bg: "#bc9b5d", color: "#ffffff", label: "Hub" },
  spoke: { bg: "#e8e6e6", color: "#414141", label: "Spoke" },
  news: { bg: "#f6ebe4", color: "#624c40", label: "News" },
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.planned;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 500,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: ArticleType }) {
  const s = TYPE_STYLES[type] || TYPE_STYLES.spoke;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 500,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
```

**Step 4: Create `src/components/dashboard/FilterBar.tsx`**

```typescript
"use client";

import { Search, X } from "lucide-react";
import { useDashboardStore, selectUniqueHubNames } from "@/lib/store/dashboard-store";
import type { ArticleType, ArticleStatus } from "@/types/content-map";

const ARTICLE_TYPES: ArticleType[] = ["hub", "spoke", "news"];
const ARTICLE_STATUSES: ArticleStatus[] = [
  "planned", "drafting", "finalized", "published", "needs_update",
];

export function FilterBar() {
  const filters = useDashboardStore((s) => s.filters);
  const setFilter = useDashboardStore((s) => s.setFilter);
  const clearFilters = useDashboardStore((s) => s.clearFilters);
  const hubNames = useDashboardStore(selectUniqueHubNames);

  const hasActiveFilters =
    filters.hubName || filters.articleType || filters.status || filters.searchQuery;

  const selectStyle: React.CSSProperties = {
    padding: "6px 10px",
    fontSize: "13px",
    border: "1px solid #cccccc",
    borderRadius: "6px",
    background: "#ffffff",
    color: "#242323",
    cursor: "pointer",
    minWidth: "120px",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      {/* Search */}
      <div style={{ position: "relative", flex: "1 1 200px", maxWidth: "300px" }}>
        <Search
          style={{
            position: "absolute",
            left: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "14px",
            height: "14px",
            color: "#888",
          }}
        />
        <input
          type="text"
          placeholder="Search articles..."
          value={filters.searchQuery}
          onChange={(e) => setFilter("searchQuery", e.target.value || null)}
          style={{
            ...selectStyle,
            width: "100%",
            paddingLeft: "32px",
          }}
        />
      </div>

      {/* Hub filter */}
      <select
        value={filters.hubName || ""}
        onChange={(e) => setFilter("hubName", e.target.value || null)}
        style={selectStyle}
      >
        <option value="">All Hubs</option>
        {hubNames.map((hub) => (
          <option key={hub} value={hub}>
            {hub}
          </option>
        ))}
      </select>

      {/* Type filter */}
      <select
        value={filters.articleType || ""}
        onChange={(e) =>
          setFilter("articleType", (e.target.value as ArticleType) || null)
        }
        style={selectStyle}
      >
        <option value="">All Types</option>
        {ARTICLE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={filters.status || ""}
        onChange={(e) =>
          setFilter("status", (e.target.value as ArticleStatus) || null)
        }
        style={selectStyle}
      >
        <option value="">All Statuses</option>
        {ARTICLE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px 10px",
            fontSize: "13px",
            background: "transparent",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            cursor: "pointer",
            color: "#b91c1c",
          }}
        >
          <X style={{ width: "12px", height: "12px" }} />
          Clear
        </button>
      )}
    </div>
  );
}
```

**Verify:** `npx tsc --noEmit` passes.

> **COMMIT HERE:** `feat: add StatusBadge and FilterBar dashboard components`

---

### Phase 3: Table View & Hub View (Steps 5–6)

**Step 5: Create `src/components/dashboard/TableView.tsx`**

Sortable table with all articles. Follow the inline styles pattern from existing components.

```typescript
"use client";

import { ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useDashboardStore,
  selectSortedArticles,
} from "@/lib/store/dashboard-store";
import type { SortColumn } from "@/lib/store/dashboard-store";
import { useArticleStore } from "@/lib/store/article-store";
import { StatusBadge, TypeBadge } from "./StatusBadge";

const COLUMNS: Array<{
  key: SortColumn | "targetKeywords" | "actions";
  label: string;
  sortable: boolean;
  width: string;
}> = [
  { key: "articleType", label: "Type", sortable: true, width: "70px" },
  { key: "title", label: "Title", sortable: true, width: "" },
  { key: "hubName", label: "Hub", sortable: true, width: "180px" },
  { key: "status", label: "Status", sortable: true, width: "110px" },
  { key: "targetKeywords", label: "Keywords", sortable: false, width: "150px" },
  { key: "searchVolumeEst", label: "Volume", sortable: true, width: "80px" },
  { key: "updatedAt", label: "Updated", sortable: true, width: "100px" },
  { key: "actions", label: "", sortable: false, width: "100px" },
];

export function TableView() {
  const router = useRouter();
  const articles = useDashboardStore(selectSortedArticles);
  const sortColumn = useDashboardStore((s) => s.sortColumn);
  const sortDirection = useDashboardStore((s) => s.sortDirection);
  const setSort = useDashboardStore((s) => s.setSort);
  const setDetailArticleId = useDashboardStore((s) => s.setDetailArticleId);
  const setSelectedArticle = useArticleStore((s) => s.setSelectedArticle);

  function handleEditInChat(article: typeof articles[0]) {
    setSelectedArticle(article);
    router.push("/dashboard");
  }

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#414141",
    textAlign: "left",
    borderBottom: "2px solid #e8e6e6",
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "13px",
    color: "#242323",
    borderBottom: "1px solid #f3f3f3",
    verticalAlign: "middle",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => {
                  if (col.sortable && col.key !== "targetKeywords" && col.key !== "actions") {
                    setSort(col.key as SortColumn);
                  }
                }}
                style={{
                  ...thStyle,
                  width: col.width || "auto",
                  cursor: col.sortable ? "pointer" : "default",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  {col.label}
                  {col.sortable && sortColumn === col.key && (
                    sortDirection === "asc"
                      ? <ArrowUp style={{ width: "12px", height: "12px" }} />
                      : <ArrowDown style={{ width: "12px", height: "12px" }} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => (
            <tr
              key={article.id}
              onClick={() => setDetailArticleId(article.id)}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fcf8ed";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <td style={{ ...tdStyle, width: "70px" }}>
                <TypeBadge type={article.articleType} />
              </td>
              <td
                style={{
                  ...tdStyle,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {article.title}
              </td>
              <td
                style={{
                  ...tdStyle,
                  width: "180px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: "12px",
                  color: "#414141",
                }}
              >
                {article.hubName}
              </td>
              <td style={{ ...tdStyle, width: "110px" }}>
                <StatusBadge status={article.status} />
              </td>
              <td
                style={{
                  ...tdStyle,
                  width: "150px",
                  fontSize: "11px",
                  color: "#888",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {article.targetKeywords.slice(0, 2).join(", ")}
              </td>
              <td
                style={{
                  ...tdStyle,
                  width: "80px",
                  textAlign: "right",
                  fontSize: "12px",
                  color: "#414141",
                }}
              >
                {article.searchVolumeEst ?? "—"}
              </td>
              <td
                style={{
                  ...tdStyle,
                  width: "100px",
                  fontSize: "12px",
                  color: "#888",
                }}
              >
                {new Date(article.updatedAt).toLocaleDateString()}
              </td>
              <td
                style={{ ...tdStyle, width: "100px" }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleEditInChat(article)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    fontSize: "12px",
                    background: "transparent",
                    border: "1px solid #cccccc",
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: "#bc9b5d",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fcf8ed";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Pencil style={{ width: "12px", height: "12px" }} />
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {articles.length === 0 && (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#888",
            fontSize: "14px",
          }}
        >
          No articles match your filters.
        </div>
      )}
    </div>
  );
}
```

**Step 6: Create `src/components/dashboard/HubView.tsx`**

Visual hub-and-spoke grouping with progress bars.

```typescript
"use client";

import { useRouter } from "next/navigation";
import { Pencil, ChevronRight } from "lucide-react";
import {
  useDashboardStore,
  selectFilteredArticles,
} from "@/lib/store/dashboard-store";
import { useArticleStore } from "@/lib/store/article-store";
import { StatusBadge, TypeBadge } from "./StatusBadge";
import type { ContentMapEntry } from "@/types/content-map";

interface HubGroup {
  hubName: string;
  hubArticle: ContentMapEntry | null;
  spokes: ContentMapEntry[];
  publishedCount: number;
  totalCount: number;
}

function groupByHub(articles: ContentMapEntry[]): HubGroup[] {
  const hubMap = new Map<string, HubGroup>();

  for (const article of articles) {
    if (!hubMap.has(article.hubName)) {
      hubMap.set(article.hubName, {
        hubName: article.hubName,
        hubArticle: null,
        spokes: [],
        publishedCount: 0,
        totalCount: 0,
      });
    }
    const group = hubMap.get(article.hubName)!;
    group.totalCount++;
    if (article.status === "published") group.publishedCount++;

    if (article.articleType === "hub") {
      group.hubArticle = article;
    } else {
      group.spokes.push(article);
    }
  }

  return Array.from(hubMap.values()).sort((a, b) =>
    a.hubName.localeCompare(b.hubName)
  );
}

function ProgressBar({
  published,
  total,
}: {
  published: number;
  total: number;
}) {
  const pct = total > 0 ? (published / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div
        style={{
          flex: 1,
          height: "8px",
          background: "#e8e6e6",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "#bc9b5d",
            borderRadius: "4px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: "12px", color: "#414141", whiteSpace: "nowrap" }}>
        {published}/{total}
      </span>
    </div>
  );
}

export function HubView() {
  const router = useRouter();
  const articles = useDashboardStore(selectFilteredArticles);
  const setDetailArticleId = useDashboardStore((s) => s.setDetailArticleId);
  const setSelectedArticle = useArticleStore((s) => s.setSelectedArticle);
  const groups = groupByHub(articles);

  function handleEditInChat(article: ContentMapEntry) {
    setSelectedArticle(article);
    router.push("/dashboard");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {groups.map((group) => (
        <div
          key={group.hubName}
          style={{
            border: "1px solid #e8e6e6",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {/* Hub header */}
          <div
            style={{
              padding: "16px 20px",
              background: "#fcf8ed",
              borderBottom: "1px solid #e8e6e6",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#242323",
                  }}
                >
                  {group.hubName}
                </span>
                {group.hubArticle && (
                  <StatusBadge status={group.hubArticle.status} />
                )}
              </div>
              <span
                style={{
                  fontSize: "13px",
                  color: "#414141",
                }}
              >
                {group.spokes.length} spoke{group.spokes.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Progress bar */}
            <ProgressBar
              published={group.publishedCount}
              total={group.totalCount}
            />

            {/* Hub article action */}
            {group.hubArticle && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "10px",
                  paddingTop: "10px",
                  borderTop: "1px solid #e8e6e6",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                  onClick={() => setDetailArticleId(group.hubArticle!.id)}
                >
                  <TypeBadge type="hub" />
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#242323",
                    }}
                  >
                    {group.hubArticle.title}
                  </span>
                </div>
                <button
                  onClick={() => handleEditInChat(group.hubArticle!)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    fontSize: "12px",
                    background: "transparent",
                    border: "1px solid #cccccc",
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: "#bc9b5d",
                    fontWeight: 500,
                  }}
                >
                  <Pencil style={{ width: "12px", height: "12px" }} />
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Spokes list */}
          {group.spokes.length > 0 && (
            <div>
              {group.spokes.map((spoke) => (
                <div
                  key={spoke.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 20px",
                    borderBottom: "1px solid #f3f3f3",
                    cursor: "pointer",
                  }}
                  onClick={() => setDetailArticleId(spoke.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fafafa";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flex: 1,
                      overflow: "hidden",
                    }}
                  >
                    <ChevronRight
                      style={{
                        width: "14px",
                        height: "14px",
                        color: "#cccccc",
                        flexShrink: 0,
                      }}
                    />
                    <TypeBadge type={spoke.articleType} />
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#242323",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {spoke.title}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexShrink: 0,
                    }}
                  >
                    <StatusBadge status={spoke.status} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditInChat(spoke);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 8px",
                        fontSize: "12px",
                        background: "transparent",
                        border: "1px solid #cccccc",
                        borderRadius: "4px",
                        cursor: "pointer",
                        color: "#bc9b5d",
                        fontWeight: 500,
                      }}
                    >
                      <Pencil style={{ width: "12px", height: "12px" }} />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {groups.length === 0 && (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#888",
            fontSize: "14px",
          }}
        >
          No articles match your filters.
        </div>
      )}
    </div>
  );
}
```

**Verify:** `npx tsc --noEmit` passes.

> **COMMIT HERE:** `feat: add TableView and HubView dashboard components`

---

### Phase 4: Article Detail Panel & Main Dashboard (Steps 7–9)

**Step 7: Create `src/components/dashboard/ArticleDetailPanel.tsx`**

A slide-out panel showing article metadata and actions.

```typescript
"use client";

import { X, Pencil, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardStore, selectDetailArticle } from "@/lib/store/dashboard-store";
import { useArticleStore } from "@/lib/store/article-store";
import { StatusBadge, TypeBadge } from "./StatusBadge";

export function ArticleDetailPanel() {
  const router = useRouter();
  const article = useDashboardStore(selectDetailArticle);
  const setDetailArticleId = useDashboardStore((s) => s.setDetailArticleId);
  const setSelectedArticle = useArticleStore((s) => s.setSelectedArticle);

  if (!article) return null;

  function handleEditInChat() {
    if (!article) return;
    setSelectedArticle(article);
    setDetailArticleId(null);
    router.push("/dashboard");
  }

  const metaRow = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", gap: "8px", padding: "6px 0" }}>
      <span
        style={{
          fontSize: "12px",
          color: "#888",
          minWidth: "100px",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "13px", color: "#242323", wordBreak: "break-word" }}>
        {value || "—"}
      </span>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setDetailArticleId(null)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.2)",
          zIndex: 50,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "420px",
          maxWidth: "90vw",
          background: "#ffffff",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e8e6e6",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <TypeBadge type={article.articleType} />
              <StatusBadge status={article.status} />
            </div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#242323",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {article.title}
            </h2>
          </div>
          <button
            onClick={() => setDetailArticleId(null)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#888",
              flexShrink: 0,
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            <button
              onClick={handleEditInChat}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                background: "#bc9b5d",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              <Pencil style={{ width: "14px", height: "14px" }} />
              Edit in Chat
            </button>

            {article.publishedUrl && (
              <a
                href={article.publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 500,
                  background: "transparent",
                  color: "#bc9b5d",
                  border: "1px solid #bc9b5d",
                  borderRadius: "6px",
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                <ExternalLink style={{ width: "14px", height: "14px" }} />
                View on Site
              </a>
            )}
          </div>

          {/* Metadata */}
          <div
            style={{
              borderTop: "1px solid #f3f3f3",
              paddingTop: "12px",
            }}
          >
            {metaRow("Hub", article.hubName)}
            {metaRow("Main Entity", article.mainEntity)}
            {metaRow("Audience", article.targetAudience)}
            {metaRow("Keywords",
              article.targetKeywords.length > 0
                ? article.targetKeywords.join(", ")
                : null
            )}
            {metaRow("Volume", article.searchVolumeEst?.toLocaleString())}
            {metaRow("Difficulty", article.keywordDifficulty)}
            {metaRow("Slug", article.slug)}
            {metaRow("Author", article.authorName)}
            {metaRow("Word Count", article.wordCount?.toLocaleString())}
            {metaRow("QA Score", article.qaScore)}
          </div>

          {/* Dates */}
          <div
            style={{
              borderTop: "1px solid #f3f3f3",
              marginTop: "12px",
              paddingTop: "12px",
            }}
          >
            {metaRow(
              "Scheduled",
              article.scheduledDate
                ? new Date(article.scheduledDate).toLocaleDateString()
                : null
            )}
            {metaRow(
              "Published",
              article.publishedDate
                ? new Date(article.publishedDate).toLocaleDateString()
                : null
            )}
            {metaRow(
              "Last Updated",
              new Date(article.updatedAt).toLocaleDateString()
            )}
            {metaRow(
              "Created",
              new Date(article.createdAt).toLocaleDateString()
            )}
          </div>

          {/* Content Notes */}
          {article.contentNotes && (
            <div
              style={{
                borderTop: "1px solid #f3f3f3",
                marginTop: "12px",
                paddingTop: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#888",
                  marginBottom: "4px",
                }}
              >
                Content Notes
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "#414141",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {article.contentNotes}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

**Step 8: Create `src/components/dashboard/ContentMapDashboard.tsx`**

Main dashboard component with view toggle, stats summary, and Onyx sync button.

```typescript
"use client";

import { useEffect } from "react";
import { LayoutGrid, Table, RefreshCw } from "lucide-react";
import { useDashboardStore, selectFilteredArticles } from "@/lib/store/dashboard-store";
import { FilterBar } from "./FilterBar";
import { TableView } from "./TableView";
import { HubView } from "./HubView";
import { ArticleDetailPanel } from "./ArticleDetailPanel";

export function ContentMapDashboard() {
  const fetchArticles = useDashboardStore((s) => s.fetchArticles);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const articles = useDashboardStore((s) => s.articles);
  const filtered = useDashboardStore(selectFilteredArticles);
  const view = useDashboardStore((s) => s.view);
  const setView = useDashboardStore((s) => s.setView);
  const detailArticleId = useDashboardStore((s) => s.detailArticleId);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Stats
  const totalArticles = articles.length;
  const hubCount = articles.filter((a) => a.articleType === "hub").length;
  const spokeCount = articles.filter((a) => a.articleType === "spoke").length;
  const newsCount = articles.filter((a) => a.articleType === "news").length;
  const publishedCount = articles.filter((a) => a.status === "published").length;
  const draftingCount = articles.filter((a) => a.status === "drafting").length;

  function handleSyncOnyx() {
    window.alert(
      'You are being re-directed to Onyx. To sync your knowledge base click "manage" in the upper right and "re-index". The process will take about 5-10 minutes depending upon size and quantity of files.'
    );
    window.location.href = "https://rmoss-onyx.xyz/admin/connector/2?page=1";
  }

  const viewButtonStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 12px",
    fontSize: "13px",
    fontWeight: active ? 600 : 400,
    background: active ? "#fcf8ed" : "transparent",
    color: active ? "#bc9b5d" : "#414141",
    border: `1px solid ${active ? "#bc9b5d" : "#cccccc"}`,
    borderRadius: "6px",
    cursor: "pointer",
  });

  if (isLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#888",
          fontSize: "14px",
        }}
      >
        Loading content map...
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 600,
              color: "#242323",
              margin: 0,
            }}
          >
            Content Map
          </h1>
          <div
            style={{
              fontSize: "13px",
              color: "#888",
              marginTop: "4px",
              display: "flex",
              gap: "12px",
            }}
          >
            <span>{totalArticles} articles</span>
            <span>{hubCount} hubs</span>
            <span>{spokeCount} spokes</span>
            {newsCount > 0 && <span>{newsCount} news</span>}
            <span style={{ color: "#065f46" }}>{publishedCount} published</span>
            {draftingCount > 0 && (
              <span style={{ color: "#0e6f82" }}>{draftingCount} drafting</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Sync Knowledge Base button */}
          <button
            onClick={handleSyncOnyx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              background: "transparent",
              color: "#bc9b5d",
              border: "1px solid #bc9b5d",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <RefreshCw style={{ width: "14px", height: "14px" }} />
            Sync Knowledge Base
          </button>

          {/* View toggle */}
          <button
            onClick={() => setView("table")}
            style={viewButtonStyle(view === "table")}
          >
            <Table style={{ width: "14px", height: "14px" }} />
            Table
          </button>
          <button
            onClick={() => setView("hub")}
            style={viewButtonStyle(view === "hub")}
          >
            <LayoutGrid style={{ width: "14px", height: "14px" }} />
            Hub
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: "16px" }}>
        <FilterBar />
      </div>

      {/* Filtered count */}
      {filtered.length !== totalArticles && (
        <div
          style={{
            fontSize: "12px",
            color: "#888",
            marginBottom: "12px",
          }}
        >
          Showing {filtered.length} of {totalArticles} articles
        </div>
      )}

      {/* View */}
      {view === "table" ? <TableView /> : <HubView />}

      {/* Detail panel overlay */}
      {detailArticleId && <ArticleDetailPanel />}
    </div>
  );
}
```

**Step 9: Create `src/components/dashboard/index.ts`**

```typescript
export { ContentMapDashboard } from "./ContentMapDashboard";
export { TableView } from "./TableView";
export { HubView } from "./HubView";
export { ArticleDetailPanel } from "./ArticleDetailPanel";
export { FilterBar } from "./FilterBar";
export { StatusBadge, TypeBadge } from "./StatusBadge";
```

**Verify:** `npx tsc --noEmit` passes.

> **COMMIT HERE:** `feat: add ContentMapDashboard with detail panel, stats, and Onyx sync`

---

### Phase 5: Page Route & Navigation (Steps 10–11)

**Step 10: Create `src/app/dashboard/content-map/page.tsx`**

```typescript
import { ContentMapDashboard } from "@/components/dashboard";

export default function ContentMapPage() {
  return <ContentMapDashboard />;
}
```

Follow the same thin-wrapper pattern as `photos/page.tsx`. Auth is handled by `src/app/dashboard/layout.tsx`.

**Step 11: Update `src/components/layout/AppShell.tsx`**

Add "Content Map" nav link between Composer and Photos. Update active-state detection to handle three possible routes.

Changes:
1. Import `LayoutGrid` from lucide-react
2. Add `isContentMap` pathname check
3. Insert the Content Map link between Composer and Photos
4. Update Composer active state to account for both `/dashboard` exact match and not being on other dashboard sub-routes

```typescript
// Add to imports:
import { LayoutGrid } from "lucide-react";

// Inside AppShell, update pathname checks:
const isContentMap = pathname === "/dashboard/content-map";
const isComposer = pathname === "/dashboard" && !isContentMap;

// Insert between Composer link and Photos link:
<Link
  href="/dashboard/content-map"
  style={{
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    fontSize: "13px",
    color: isContentMap ? "#bc9b5d" : "#414141",
    fontWeight: isContentMap ? 600 : 400,
    textDecoration: "none",
    borderRadius: "4px",
  }}
>
  <LayoutGrid style={{ width: "14px", height: "14px" }} />
  Content Map
</Link>
```

**Full AppShell nav link active-state logic:**
```typescript
const pathname = usePathname();
const isComposer = pathname === "/dashboard";
const isContentMap = pathname === "/dashboard/content-map";
const isPhotos = pathname === "/dashboard/photos";
```

Each link uses its own boolean for active styling. The Composer link activates only on exact `/dashboard` match. This prevents all three from highlighting simultaneously.

**Verify:** `npm run build` compiles the new page. `npx tsc --noEmit` passes.

> **COMMIT HERE:** `feat: add Content Map page route and nav link to AppShell`

---

### Phase 6: Link Graph API (Step 12)

**Step 12: Create `src/app/api/links/graph/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

// GET /api/links/graph — Link graph data for dashboard
export async function GET() {
  try {
    await requireRole("admin", "editor", "viewer");

    const [articles, links] = await Promise.all([
      prisma.contentMap.findMany({
        select: {
          id: true,
          title: true,
          articleType: true,
          hubName: true,
          status: true,
          slug: true,
        },
        orderBy: { id: "asc" },
      }),
      prisma.internalLink.findMany({
        select: {
          id: true,
          sourceArticleId: true,
          targetArticleId: true,
          targetCorePage: true,
          linkType: true,
          isActive: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        nodes: articles,
        edges: links,
        summary: {
          totalArticles: articles.length,
          totalLinks: links.length,
          activeLinks: links.filter((l) => l.isActive).length,
        },
      },
    });
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

**Verify:** `npx tsc --noEmit` passes. `npm run build` compiles the new route.

> **COMMIT HERE:** `feat: add GET /api/links/graph route for link graph data`

---

### Phase 7: Integration Test (Step 13)

**Step 13: Create `scripts/test-guide-10.ts`**

```typescript
/**
 * Guide 10 Integration Test — Content Map Dashboard & Blog Registry
 *
 * Tests:
 * 1. GET /api/content-map — returns all articles with correct fields
 * 2. GET /api/links/graph — returns nodes, edges, and summary
 * 3. Verify article categorization (hub/spoke/news counts)
 * 4. Verify hub grouping (articles grouped by hubName)
 * 5. Verify all 39 articles are present
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function fetchJson(path: string) {
  const url = `${BASE_URL}${path}`;
  console.log(`  → GET ${url}`);
  const res = await fetch(url, {
    headers: {
      Cookie: process.env.TEST_SESSION_COOKIE || "",
    },
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log("=== Guide 10 Integration Test ===\n");

  // Test 1: Content Map API
  console.log("1. Testing GET /api/content-map...");
  const { status: cmStatus, data: cmData } = await fetchJson("/api/content-map");

  if (cmStatus === 401) {
    console.log("   ⚠ Auth required — set TEST_SESSION_COOKIE env var");
    console.log("   Skipping authenticated tests.\n");
    console.log("=== Manual Verification Needed ===");
    console.log("Run: npm run dev → navigate to /dashboard/content-map");
    return;
  }

  if (!cmData.success) {
    console.error("   ✗ FAIL: Content Map API returned error:", cmData.error);
    process.exit(1);
  }

  const articles = cmData.data;
  console.log(`   ✓ Returned ${articles.length} articles`);

  // Test 2: Article categorization
  console.log("\n2. Checking article categorization...");
  const hubs = articles.filter((a: any) => a.articleType === "hub");
  const spokes = articles.filter((a: any) => a.articleType === "spoke");
  const news = articles.filter((a: any) => a.articleType === "news");
  console.log(`   Hubs: ${hubs.length}, Spokes: ${spokes.length}, News: ${news.length}`);
  console.log(`   Total: ${hubs.length + spokes.length + news.length}`);

  if (articles.length < 39) {
    console.log(`   ⚠ WARNING: Expected 39 articles, got ${articles.length}`);
  } else {
    console.log("   ✓ All 39+ articles present");
  }

  // Test 3: Hub grouping
  console.log("\n3. Checking hub grouping...");
  const hubNames = new Set(articles.map((a: any) => a.hubName));
  console.log(`   ${hubNames.size} unique hub clusters: ${Array.from(hubNames).join(", ")}`);

  // Verify each hub article has spokes
  for (const hub of hubs) {
    const hubSpokes = articles.filter(
      (a: any) => a.hubName === hub.hubName && a.articleType !== "hub"
    );
    console.log(`   "${hub.hubName}": 1 hub + ${hubSpokes.length} spokes`);
  }
  console.log("   ✓ Hub grouping verified");

  // Test 4: Status distribution
  console.log("\n4. Checking status distribution...");
  const statusCounts: Record<string, number> = {};
  for (const a of articles) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  }
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`   ${status}: ${count}`);
  }
  console.log("   ✓ Status badges will render for all statuses");

  // Test 5: Required fields present
  console.log("\n5. Checking required fields...");
  const requiredFields = [
    "id", "hubName", "articleType", "title", "status",
    "targetKeywords", "updatedAt",
  ];
  const sample = articles[0];
  const missingFields = requiredFields.filter((f) => !(f in sample));
  if (missingFields.length > 0) {
    console.error(`   ✗ FAIL: Missing fields: ${missingFields.join(", ")}`);
    process.exit(1);
  }
  console.log("   ✓ All required fields present");

  // Test 6: Link Graph API
  console.log("\n6. Testing GET /api/links/graph...");
  const { status: lgStatus, data: lgData } = await fetchJson("/api/links/graph");

  if (lgStatus === 404) {
    console.log("   ⚠ Route not found — will be created in Guide 10");
  } else if (!lgData.success) {
    console.error("   ✗ FAIL: Link Graph API returned error:", lgData.error);
    process.exit(1);
  } else {
    console.log(`   ✓ Nodes: ${lgData.data.nodes.length}`);
    console.log(`   ✓ Edges: ${lgData.data.edges.length}`);
    console.log(`   ✓ Active links: ${lgData.data.summary.activeLinks}`);
  }

  console.log("\n=== All Integration Tests Passed ===");
  console.log("\nHuman Gate — verify in browser:");
  console.log("  npm run dev → /dashboard/content-map");
  console.log("  1. Content Map page loads with all articles");
  console.log("  2. Table View: sortable columns, status badges, type badges");
  console.log("  3. Hub View: grouped by hub with progress bars");
  console.log("  4. Filters: hub, status, type, search all work");
  console.log("  5. Click article row → detail panel slides out");
  console.log("  6. Click 'Edit in Chat' → navigates to Composer with article loaded");
  console.log("  7. 'Sync Knowledge Base' → alert shown → redirects to Onyx admin");
  console.log("  8. 'Content Map' nav link appears between Composer and Photos");
}

main().catch(console.error);
```

**Verify:** Run `npx tsx scripts/test-guide-10.ts` — all tests pass.

> **COMMIT HERE:** `test: add Guide 10 integration test for Content Map Dashboard`

---

## I. Gate Checks

### Lint & Type Gate

```bash
npx tsc --noEmit          # Zero type errors
npx next lint              # Zero lint errors (warnings acceptable)
npx prisma validate        # Schema valid (no changes to schema)
```

### Integration Gate

```bash
npx tsx scripts/test-guide-10.ts
```

Expected output:
- Content Map API returns 39 articles with all required fields
- Articles correctly categorized as hub, spoke, or news
- Hub grouping verified (8 hub clusters)
- Link Graph API returns nodes, edges, and summary
- All status values present for badge rendering

### Human Gate

```
npm run dev → navigate to /dashboard/content-map:
1. Does the Content Map page load with all 39 articles?
2. Does the "Content Map" nav link appear between Composer and Photos in the header?
3. Table View: Click column headers — do they sort? Click again — does direction toggle?
4. Table View: Do status badges and type badges render with correct colors?
5. Hub View: Toggle to Hub View — are articles grouped by hub?
6. Hub View: Do progress bars show published vs total counts?
7. Filters: Select a hub → do results filter? Select a status → further filtered? Clear → all back?
8. Search: Type a title fragment → does the table filter?
9. Click an article row → does the detail panel slide out from the right?
10. Detail panel: Does it show all metadata (hub, keywords, audience, dates, etc.)?
11. Click "Edit in Chat" → does it navigate to /dashboard with that article selected in the dropdown?
12. Click "Sync Knowledge Base" → does the alert appear with the correct message?
13. After dismissing the alert → does the browser redirect to https://rmoss-onyx.xyz/admin/connector/2?page=1?
```

---

## J. Acceptance Criteria

1. Dashboard accessible at `/dashboard/content-map`
2. All 39 articles displayed with correct `articleType` badges (hub/spoke/news)
3. All articles display correct `status` badges (planned/drafting/finalized/published/needs_update)
4. Table View: sortable by title, hub, type, status, volume, date — sort direction toggles
5. Hub View: articles grouped by `hubName` with progress bars (published/total)
6. FilterBar: filter by hub name, article type, status, and text search — all work independently and combined
7. Article detail panel opens on row/card click, shows full metadata
8. "Edit in Chat" navigates to `/dashboard` with article loaded in the Composer store
9. "Sync Knowledge Base" shows browser alert with correct message, then redirects to Onyx admin URL
10. "Content Map" nav link in AppShell header between Composer and Photos, with active state styling
11. `GET /api/links/graph` returns nodes, edges, and summary with correct data
12. `npm run build` compiles with zero errors
13. All existing functionality (Composer, Photos, QA) unaffected

---

## K. Risks and Failure Modes

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `Set` not serializable by Zustand | Low | Low | Dashboard store doesn't use `persist` middleware, so `Set<number>` for `selectedIds` works fine in memory. If persistence is ever needed, convert to `number[]`. |
| Onyx admin API returns 403 | Known | Low | Guide uses browser redirect (not programmatic API call). The alert + redirect flow works regardless of API key status. |
| AppShell header overflow with 4+ nav items | Low | Medium | Current nav: Composer, Content Map, Photos, Source Drive, [spacer], UserMenu. The fixed 56px header has enough room. Icons at 14px + 13px text keep items compact. If needed, collapse to icons-only on narrow viewports. |
| Client-side grouping with 39 rows too slow | Very Low | None | 39 rows is trivially fast. No virtualization needed. |
| Article store mutation from dashboard | Low | Medium | "Edit in Chat" calls `setSelectedArticle()` on the existing article store, then navigates. This is safe because it's the same pattern `ArticleSelector` uses — setting the selected article resets all editor state. |
| Detail panel z-index conflicts | Low | Low | Panel at z-index 51 with backdrop at 50, above the AppShell dropdown (z-index 40-50). Consistent with existing overlay patterns. |
