export type ArticleType = "hub" | "spoke" | "news";

export type ArticleStatus =
  | "planned"
  | "drafting"
  | "finalized"
  | "published"
  | "needs_update";

export interface ContentMapEntry {
  id: number;
  hubName: string;
  articleType: ArticleType;
  title: string;
  slug: string | null;
  mainEntity: string;
  supportingEntities: string[];
  targetKeywords: string[];
  searchVolumeEst: number | null;
  keywordDifficulty: string | null;
  targetAudience: string | null;
  status: ArticleStatus;
  scheduledDate: Date | null;
  publishedDate: Date | null;
  publishedUrl: string | null;
  parentHubId: number | null;
  contentNotes: string | null;
  suggestedExternalLinks: string[];
  internalLinksTo: string[];
  wordCount: number | null;
  qaScore: string | null;
  authorName: string | null;
  source: "engine" | "external";
  createdAt: Date;
  updatedAt: Date;
}

export interface InternalLinkEntry {
  id: number;
  sourceArticleId: number | null;
  targetArticleId: number | null;
  targetCorePage: string | null;
  anchorText: string | null;
  linkType: string | null;
  isActive: boolean;
  createdAt: Date;
}
