import { z } from "zod";

// === Sub-schemas ===

export const AuthorInfoSchema = z.object({
  name: z.string().min(1),
  credentials: z.string().min(1),
  bio: z.string(),
  linkedinUrl: z.string().nullable(),
});

export const ImagePlacementSchema = z.object({
  photoId: z.number().nullable(),
  cloudinaryPublicId: z.string().nullable().default(null),
  src: z.string().min(1),
  alt: z.string(),
  caption: z.string().nullable(),
  classification: z.enum(["informative", "decorative"]),
  width: z.number().nullable(),
  height: z.number().nullable(),
});

export const FAQItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const InternalLinkRefSchema = z.object({
  targetUrl: z.string().min(1),
  targetArticleId: z.number().nullable(),
  targetCorePage: z.string().nullable(),
  anchorText: z.string().min(1),
  linkType: z.string(),
  sectionId: z.string(),
});

export const ExternalLinkRefSchema = z.object({
  url: z.string().min(1),
  anchorText: z.string().min(1),
  trustTier: z.enum(["primary", "authority", "niche_expert", "general"]),
  sourceName: z.string(),
  sectionId: z.string(),
});

export const SchemaFlagsSchema = z.object({
  blogPosting: z.boolean(),
  faqPage: z.boolean(),
  product: z.boolean(),
});

// === Content Node Schemas (discriminated union on "type") ===

const ParagraphNodeSchema = z.object({
  type: z.literal("paragraph"),
  id: z.string(),
  text: z.string().min(1),
});

const ImageNodeSchema = z.object({
  type: z.literal("image"),
  id: z.string(),
  placement: ImagePlacementSchema,
});

const PullQuoteNodeSchema = z.object({
  type: z.literal("pullQuote"),
  id: z.string(),
  text: z.string().min(1),
  attribution: z.string().nullable(),
});

const KeyFactsNodeSchema = z.object({
  type: z.literal("keyFacts"),
  id: z.string(),
  title: z.string().min(1),
  facts: z.array(z.object({ label: z.string(), value: z.string() })).min(1),
});

const TableNodeSchema = z.object({
  type: z.literal("table"),
  id: z.string(),
  caption: z.string().nullable(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const ListNodeSchema = z.object({
  type: z.literal("list"),
  id: z.string(),
  ordered: z.boolean(),
  items: z.array(z.string()).min(1),
});

const CalloutNodeSchema = z.object({
  type: z.literal("callout"),
  id: z.string(),
  variant: z.enum(["info", "tip", "warning"]),
  text: z.string().min(1),
});

export const ContentNodeSchema = z.discriminatedUnion("type", [
  ParagraphNodeSchema,
  ImageNodeSchema,
  PullQuoteNodeSchema,
  KeyFactsNodeSchema,
  TableNodeSchema,
  ListNodeSchema,
  CalloutNodeSchema,
]);

export const ArticleSectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  headingLevel: z.union([z.literal(2), z.literal(3)]),
  content: z.array(ContentNodeSchema),
});

// === Top-level document schema ===

export const CaptureTypeSchema = z.enum([
  "newsletter",
  "allocation",
  "tour",
  "content_upgrade",
  "waitlist",
]);

export const ArticleTypeSchema = z.enum(["hub", "spoke", "news"]);

export const CanonicalArticleDocumentSchema = z.object({
  version: z.string(),
  articleId: z.number(),
  slug: z.string().min(1),
  articleType: ArticleTypeSchema,
  hubId: z.number().nullable(),
  title: z.string().min(1),
  metaTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  canonicalUrl: z.string().min(1),
  publishDate: z.string().min(1),
  modifiedDate: z.string().min(1),
  author: AuthorInfoSchema,
  executiveSummary: z.string().min(1),
  heroImage: ImagePlacementSchema.nullable(),
  sections: z.array(ArticleSectionSchema).min(1),
  faq: z.array(FAQItemSchema),
  internalLinks: z.array(InternalLinkRefSchema),
  externalLinks: z.array(ExternalLinkRefSchema),
  ctaType: CaptureTypeSchema,
  captureComponents: z.array(CaptureTypeSchema),
  schema: SchemaFlagsSchema,
  dataNosnippetSections: z.array(z.string()),
});
