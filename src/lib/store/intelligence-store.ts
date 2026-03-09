import { create } from "zustand";
import type { PerformanceWithContentMap, ContentRecommendation, AggregatedQueryRow, QuerySyncResult } from "@/types/intelligence";

/** "Last N months of data" means from (latestDate - N months) to latestDate */
export type DateRange = "3m" | "6m" | "12m" | "all" | "custom";
export type ChartGranularity = "daily" | "weekly" | "monthly";
export type PageType = "blog" | "product" | "static";
/** @deprecated Use PageType instead */
export type PageTypeFilter = "all" | PageType;

export interface TimeseriesPoint {
  date: string;
  clicks: number;
  impressions: number;
}

interface IntelligenceStoreState {
  performanceData: PerformanceWithContentMap[];
  timeseries: TimeseriesPoint[];
  recommendations: ContentRecommendation[];
  isLoadingPerformance: boolean;
  isLoadingTimeseries: boolean;
  isLoadingRecommendations: boolean;
  isAnalyzing: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  /** The most recent date with data, detected from API */
  latestDataDate: string | null;
  /** The earliest date with data */
  earliestDataDate: string | null;
  dateRange: DateRange;
  customStartDate: string;
  customEndDate: string;
  chartGranularity: ChartGranularity;
  /** Active page type filters — when all 3 are selected, no filtering is applied */
  pageTypes: Set<PageType>;
  queryData: AggregatedQueryRow[];
  selectedPageForQueries: string | null;
  isLoadingQueryData: boolean;
  querySyncResult: QuerySyncResult | null;
  isQuerySyncing: boolean;
}

interface IntelligenceStoreActions {
  fetchPerformance: () => Promise<void>;
  fetchTimeseries: () => Promise<void>;
  fetchRecommendations: () => Promise<void>;
  runAnalysis: () => Promise<void>;
  triggerSync: () => Promise<void>;
  approveRecommendation: (rec: ContentRecommendation) => Promise<void>;
  dismissRecommendation: (id: number) => Promise<void>;
  setDateRange: (range: DateRange) => void;
  setCustomDateRange: (start: string, end: string) => void;
  setChartGranularity: (g: ChartGranularity) => void;
  togglePageType: (type: PageType) => void;
  fetchQueryData: (page: string) => Promise<void>;
  triggerQuerySync: () => Promise<void>;
  setSelectedPageForQueries: (page: string | null) => void;
}

function subtractMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0];
}

function defaultDate(): string {
  return new Date().toISOString().split("T")[0];
}

export const useIntelligenceStore = create<IntelligenceStoreState & IntelligenceStoreActions>(
  (set, get) => ({
    performanceData: [],
    timeseries: [],
    recommendations: [],
    isLoadingPerformance: false,
    isLoadingTimeseries: false,
    isLoadingRecommendations: false,
    isAnalyzing: false,
    isSyncing: false,
    lastSyncedAt: null,
    latestDataDate: null,
    earliestDataDate: null,
    dateRange: "3m",
    customStartDate: subtractMonths(defaultDate(), 3),
    customEndDate: defaultDate(),
    chartGranularity: "daily",
    pageTypes: new Set<PageType>(["blog", "product", "static"]),
    queryData: [],
    selectedPageForQueries: null,
    isLoadingQueryData: false,
    querySyncResult: null,
    isQuerySyncing: false,

    fetchPerformance: async () => {
      set({ isLoadingPerformance: true });
      try {
        const { dateRange, customStartDate, customEndDate, latestDataDate, earliestDataDate, pageTypes } = get();

        let start: string;
        let end: string;

        if (dateRange === "custom") {
          start = customStartDate;
          end = customEndDate;
        } else if (dateRange === "all") {
          start = earliestDataDate ?? "2020-01-01";
          end = latestDataDate ?? defaultDate();
        } else {
          const anchor = latestDataDate ?? defaultDate();
          end = anchor;
          const months = dateRange === "3m" ? 3 : dateRange === "6m" ? 6 : 12;
          start = subtractMonths(anchor, months);
        }

        const allTypes: PageType[] = ["blog", "product", "static"];
        const typesParam = pageTypes.size < allTypes.length
          ? `&types=${Array.from(pageTypes).join(",")}`
          : "";
        const url = `/api/intelligence/performance?start=${start}&end=${end}${typesParam}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          set({ performanceData: data.data });
        }
      } catch (error) {
        console.error("[IntelligenceStore] Failed to fetch performance:", error);
      } finally {
        set({ isLoadingPerformance: false });
      }
    },

    fetchTimeseries: async () => {
      set({ isLoadingTimeseries: true });
      try {
        const { dateRange, customStartDate, customEndDate, latestDataDate, earliestDataDate, pageTypes } = get();

        let start: string;
        let end: string;

        if (dateRange === "custom") {
          start = customStartDate;
          end = customEndDate;
        } else if (dateRange === "all") {
          start = earliestDataDate ?? "2020-01-01";
          end = latestDataDate ?? defaultDate();
        } else {
          const anchor = latestDataDate ?? defaultDate();
          end = anchor;
          const months = dateRange === "3m" ? 3 : dateRange === "6m" ? 6 : 12;
          start = subtractMonths(anchor, months);
        }

        const allTypes: PageType[] = ["blog", "product", "static"];
        const typesParam = pageTypes.size < allTypes.length
          ? `&types=${Array.from(pageTypes).join(",")}`
          : "";
        const url = `/api/intelligence/timeseries?start=${start}&end=${end}${typesParam}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          set({ timeseries: data.data });

          // Detect date boundaries from timeseries data
          const points: TimeseriesPoint[] = data.data;
          if (points.length > 0) {
            const latest = points[points.length - 1].date;
            const earliest = points[0].date;
            const state = get();
            set({
              latestDataDate: state.latestDataDate && state.latestDataDate > latest ? state.latestDataDate : latest,
              earliestDataDate: state.earliestDataDate && state.earliestDataDate < earliest ? state.earliestDataDate : earliest,
            });
          }
        }
      } catch (error) {
        console.error("[IntelligenceStore] Failed to fetch timeseries:", error);
      } finally {
        set({ isLoadingTimeseries: false });
      }
    },

    fetchRecommendations: async () => {
      set({ isLoadingRecommendations: true });
      try {
        const res = await fetch("/api/intelligence/recommendations");
        const data = await res.json();
        if (data.success) {
          set({ recommendations: data.data });
        }
      } catch (error) {
        console.error("[IntelligenceStore] Failed to fetch recommendations:", error);
      } finally {
        set({ isLoadingRecommendations: false });
      }
    },

    runAnalysis: async () => {
      set({ isAnalyzing: true });
      try {
        const res = await fetch("/api/intelligence/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: 90 }),
        });
        const data = await res.json();
        if (data.success) {
          set({ recommendations: data.data.recommendations });
        }
      } catch (error) {
        console.error("[IntelligenceStore] Analysis failed:", error);
      } finally {
        set({ isAnalyzing: false });
      }
    },

    triggerSync: async () => {
      set({ isSyncing: true });
      try {
        const res = await fetch("/api/intelligence/sync", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          // Reset date boundaries so re-fetch uses today's date, discovering new data
          set({ lastSyncedAt: new Date().toISOString(), latestDataDate: null, earliestDataDate: null });
          // Re-detect date boundaries then refresh
          await get().fetchTimeseries();
          await get().fetchPerformance();
        }
      } catch (error) {
        console.error("[IntelligenceStore] Sync failed:", error);
      } finally {
        set({ isSyncing: false });
      }
    },

    approveRecommendation: async (rec) => {
      await fetch("/api/intelligence/recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rec.id, action: "approve" }),
      });
      set((state) => ({
        recommendations: state.recommendations.filter((r) => r.id !== rec.id),
      }));
      if (rec.contentMapId) {
        try {
          const articleRes = await fetch(`/api/content-map/${rec.contentMapId}`);
          const articleData = await articleRes.json();
          if (articleData.success) {
            const { useArticleStore } = await import("@/lib/store/article-store");
            const articleStore = useArticleStore.getState();
            articleStore.setSelectedArticle(articleData.data);
            articleStore.setPendingChatMessage(rec.suggestedPrompt);
          }
        } catch (error) {
          console.error("[IntelligenceStore] Failed to pre-load article:", error);
        }
      }
    },

    dismissRecommendation: async (id) => {
      await fetch("/api/intelligence/recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "dismiss" }),
      });
      set((state) => ({
        recommendations: state.recommendations.filter((r) => r.id !== id),
      }));
    },

    setDateRange: (range) => set({ dateRange: range }),
    setCustomDateRange: (start, end) => set({ customStartDate: start, customEndDate: end, dateRange: "custom" }),
    setChartGranularity: (g) => set({ chartGranularity: g }),
    fetchQueryData: async (page: string) => {
      set({ isLoadingQueryData: true, selectedPageForQueries: page });
      try {
        const res = await fetch(`/api/intelligence/query-performance?page=${encodeURIComponent(page)}&limit=20`);
        const data = await res.json();
        if (data.success) {
          set({ queryData: data.data });
        }
      } catch (error) {
        console.error("[IntelligenceStore] Failed to fetch query data:", error);
      } finally {
        set({ isLoadingQueryData: false });
      }
    },

    triggerQuerySync: async () => {
      set({ isQuerySyncing: true });
      try {
        const res = await fetch("/api/intelligence/query-sync", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          set({ querySyncResult: data.data });
        }
      } catch (error) {
        console.error("[IntelligenceStore] Query sync failed:", error);
      } finally {
        set({ isQuerySyncing: false });
      }
    },

    setSelectedPageForQueries: (page) => set({ selectedPageForQueries: page, queryData: [] }),

    togglePageType: (type) => {
      const current = get().pageTypes;
      const next = new Set(current);
      if (next.has(type)) {
        // Don't allow deselecting the last one
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      set({ pageTypes: next });
    },
  })
);

/** Classify a GSC page URL into a page type for filtering */
export function classifyPageType(page: string): PageType {
  const path = page.replace(/https?:\/\/[^/]+/, "");
  if (path.startsWith("/blog/") || path.startsWith("/post/")) return "blog";
  if (path.startsWith("/product-page/") || path.startsWith("/category/")) return "product";
  return "static";
}
