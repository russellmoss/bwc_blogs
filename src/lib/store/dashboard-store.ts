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
  (set) => ({
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

// === Pure utility functions (use inside useMemo, NOT as Zustand selectors) ===

export function getFilteredArticles(
  articles: ContentMapEntry[],
  filters: DashboardFilterState
): ContentMapEntry[] {
  let result = articles;

  if (filters.hubName) {
    result = result.filter((a) => a.hubName === filters.hubName);
  }
  if (filters.articleType) {
    result = result.filter((a) => a.articleType === filters.articleType);
  }
  if (filters.status) {
    result = result.filter((a) => a.status === filters.status);
  }
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    result = result.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.mainEntity.toLowerCase().includes(q)
    );
  }

  return result;
}

export function getSortedArticles(
  filtered: ContentMapEntry[],
  sortColumn: SortColumn,
  sortDirection: SortDirection
): ContentMapEntry[] {
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

export function getUniqueHubNames(articles: ContentMapEntry[]): string[] {
  const hubs = new Set(articles.map((a) => a.hubName));
  return Array.from(hubs).sort();
}

export function getDetailArticle(
  articles: ContentMapEntry[],
  detailArticleId: number | null
): ContentMapEntry | null {
  if (!detailArticleId) return null;
  return articles.find((a) => a.id === detailArticleId) ?? null;
}
