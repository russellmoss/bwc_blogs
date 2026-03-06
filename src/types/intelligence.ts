export interface ArticlePerformanceRow {
  id: number;
  contentMapId: number;
  date: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  syncedAt: string;
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
  } | null;
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
