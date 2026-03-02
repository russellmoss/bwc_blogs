import { ArticleType } from "./content-map";

// ============================================================
// CANONICAL ARTICLE DOCUMENT — the central data structure
// Claude generates this. Renderer consumes it. QA validates it. DB stores it.
// ============================================================

export interface CanonicalArticleDocument {
  version: string; // Schema version, e.g. "1.0"
  articleId: number; // FK to content_map.id
  slug: string;
  articleType: ArticleType;
  hubId: number | null;
  title: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  publishDate: string; // ISO 8601
  modifiedDate: string; // ISO 8601
  author: AuthorInfo;
  executiveSummary: string;
  heroImage: ImagePlacement | null;
  sections: ArticleSection[];
  faq: FAQItem[];
  internalLinks: InternalLinkRef[];
  externalLinks: ExternalLinkRef[];
  ctaType: CaptureType;
  captureComponents: CaptureType[];
  schema: SchemaFlags;
  dataNosnippetSections: string[];
}

export interface AuthorInfo {
  name: string;
  credentials: string;
  bio: string;
  linkedinUrl: string | null;
}

export interface ArticleSection {
  id: string; // "section-1", "section-2", etc.
  heading: string;
  headingLevel: 2 | 3;
  content: ContentNode[];
}

// ============================================================
// CONTENT NODES — the building blocks of article sections
// ============================================================

export type ContentNodeType =
  | "paragraph"
  | "image"
  | "pullQuote"
  | "keyFacts"
  | "table"
  | "list"
  | "callout";

export interface ContentNodeBase {
  type: ContentNodeType;
  id: string;
}

export interface ParagraphNode extends ContentNodeBase {
  type: "paragraph";
  text: string; // HTML-safe text (may contain <a>, <strong>, <em>)
}

export interface ImageNode extends ContentNodeBase {
  type: "image";
  placement: ImagePlacement;
}

export interface PullQuoteNode extends ContentNodeBase {
  type: "pullQuote";
  text: string;
  attribution: string | null;
}

export interface KeyFactsNode extends ContentNodeBase {
  type: "keyFacts";
  title: string;
  facts: { label: string; value: string }[];
}

export interface TableNode extends ContentNodeBase {
  type: "table";
  caption: string | null;
  headers: string[];
  rows: string[][];
}

export interface ListNode extends ContentNodeBase {
  type: "list";
  ordered: boolean;
  items: string[];
}

export interface CalloutNode extends ContentNodeBase {
  type: "callout";
  variant: "info" | "tip" | "warning";
  text: string;
}

export type ContentNode =
  | ParagraphNode
  | ImageNode
  | PullQuoteNode
  | KeyFactsNode
  | TableNode
  | ListNode
  | CalloutNode;

// ============================================================
// IMAGES & LINKS
// ============================================================

export interface ImagePlacement {
  photoId: number | null; // FK to photos table, null if external
  src: string; // URL (Cloudinary CDN or Drive fallback)
  alt: string; // Descriptive text (empty for decorative)
  caption: string | null;
  classification: "informative" | "decorative";
  width: number | null;
  height: number | null;
}

export type TrustTier = "primary" | "authority" | "niche_expert" | "general";

export interface InternalLinkRef {
  targetUrl: string;
  targetArticleId: number | null;
  targetCorePage: string | null;
  anchorText: string;
  linkType: string;
  sectionId: string; // Which section this link appears in
}

export interface ExternalLinkRef {
  url: string;
  anchorText: string;
  trustTier: TrustTier;
  sourceName: string;
  sectionId: string;
}

// ============================================================
// FAQ & SCHEMA
// ============================================================

export interface FAQItem {
  question: string;
  answer: string;
}

export interface SchemaFlags {
  blogPosting: boolean;
  faqPage: boolean;
  product: boolean;
}

export type CaptureType =
  | "newsletter"
  | "allocation"
  | "tour"
  | "content_upgrade"
  | "waitlist";
