# Implementation Guide 4: Canonical Article Schema + Article Renderer

**Status:** Ready for execution
**Depends on:** Guide 1 (auth, DB), Guide 2 (content map), Guide 3 (Onyx — not used directly)
**Blocks:** Guide 5 (orchestration), Guide 6 (UI), Guide 7 (Canvas Edit), Guide 10 (QA Scorecard), Guide 11 (finalization)
**Criticality:** CRITICAL — defines the data contract between Claude and every downstream consumer
**Exploration source:** `exploration-results.md` (2026-03-02)

---

## What This Guide Builds

Two architecturally critical subsystems:

1. **Article Schema** (`src/lib/article-schema/`) — Zod v4 runtime validation for the CanonicalArticleDocument, a repair pass that auto-fixes common LLM output issues, and 20+ FAIL-level SOP checks.

2. **Article Renderer** (`src/lib/renderer/`) — A deterministic, pure function that converts a validated CanonicalArticleDocument into Wix-ready HTML with embedded CSS, JSON-LD schema markup, Cloudinary CDN URLs, and correct BEM classes.

Plus two API routes, a test fixture, and an integration test script.

### Files This Guide Creates

```
src/types/api.ts                              ← MODIFY: add ValidationResult interface
src/lib/article-schema/
  schema.ts                                   ← Zod v4 schema for CanonicalArticleDocument
  validate.ts                                 ← validateCanonicalDocument() + SOP checks
  repair.ts                                   ← repairCanonicalDocument() auto-fixer
  index.ts                                    ← barrel re-exports
src/lib/renderer/
  cloudinary.ts                               ← buildCloudinaryUrl()
  css.ts                                      ← BWC embedded stylesheet string
  jsonld.ts                                   ← buildSchemaJson() JSON-LD builder
  components.ts                               ← HTML template functions per ContentNode type
  compiled-template.ts                        ← Google Fonts + full CSS + component reference
  renderer.ts                                 ← renderArticle() pure function
  index.ts                                    ← barrel re-exports
src/app/api/articles/render/route.ts          ← POST: RendererInput -> RendererOutput
src/app/api/articles/validate/route.ts        ← POST: unknown JSON -> ValidationResult
scripts/fixtures/sample-canonical-doc.json    ← Minimal valid test fixture
scripts/test-guide-4.ts                       ← Integration tests
```

### Key Constraints

- **Renderer is a PURE FUNCTION** — no database calls, no API calls, no side effects
- **Zod v4** (^4.3.6) — use `z.discriminatedUnion()`, `safeParse()`, `error.flatten()`
- **Match ACTUAL types** in `src/types/article.ts` — not the abbreviated orchestration doc spec (see Deviations section in exploration-results.md)
- **`import type`** for all TypeScript interfaces from `@/types/`
- **`env.CLOUDINARY_CLOUD_NAME`** from `@/lib/env` — never `process.env` directly
- **BEM prefix** `bwc-` for all rendered HTML component classes

---

## Phase 0: Type Update — Add ValidationResult

**Gate: Must complete before Phase 1.**

### Step 0.1: Add ValidationResult to src/types/api.ts

Open `src/types/api.ts` and add the `ValidationResult` interface after the existing `ErrorCode` type:

```typescript
// Validation result returned by article schema validation
export interface ValidationResult {
  valid: boolean;
  errors: { path: string; message: string }[];
  warnings: string[];
}
```

### Step 0.2: Verify

Run `npx tsc --noEmit`. Must exit 0 with zero errors.

---

## Phase 1: Article Schema — `src/lib/article-schema/`

### Step 1.1: Create `src/lib/article-schema/schema.ts`

This file defines Zod v4 schemas that mirror the TypeScript interfaces in `src/types/article.ts` exactly.

**CRITICAL: Match the ACTUAL types, not the orchestration doc abbreviations.**

Deviations to account for (from exploration-results.md §8):
- `InternalLinkRef` has 6 fields: `targetUrl, targetArticleId, targetCorePage, anchorText, linkType, sectionId`
- `ExternalLinkRef` has 5 fields: `url, anchorText, trustTier, sourceName, sectionId` — NO `newSource` field
- Every ContentNode has `id: string` via `ContentNodeBase`
- `CaptureType` is a string literal union, not an enum
- `ImagePlacement` has `width: number | null` and `height: number | null` (nullable)

```typescript
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
```

### Step 1.2: Create `src/lib/article-schema/validate.ts`

This file runs structural validation PLUS the SOP FAIL-level checks.

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { ValidationResult } from "@/types/api";
import { CanonicalArticleDocumentSchema } from "./schema";

/** Count words in a text string (strip HTML tags first) */
function countWords(text: string): number {
  const stripped = text.replace(/<[^>]*>/g, "").trim();
  if (!stripped) return 0;
  return stripped.split(/\s+/).length;
}

/** Count total words across all text content in the document */
function countDocumentWords(doc: CanonicalArticleDocument): number {
  let total = 0;

  // Executive summary
  total += countWords(doc.executiveSummary);

  // All sections
  for (const section of doc.sections) {
    total += countWords(section.heading);
    for (const node of section.content) {
      switch (node.type) {
        case "paragraph":
          total += countWords(node.text);
          break;
        case "pullQuote":
          total += countWords(node.text);
          break;
        case "keyFacts":
          for (const fact of node.facts) {
            total += countWords(fact.label) + countWords(fact.value);
          }
          break;
        case "table":
          for (const row of node.rows) {
            for (const cell of row) {
              total += countWords(cell);
            }
          }
          break;
        case "list":
          for (const item of node.items) {
            total += countWords(item);
          }
          break;
        case "callout":
          total += countWords(node.text);
          break;
      }
    }
  }

  // FAQ
  for (const faq of doc.faq) {
    total += countWords(faq.question) + countWords(faq.answer);
  }

  return total;
}

/**
 * Validate a CanonicalArticleDocument with strict Zod schema + SOP FAIL-level checks.
 * Returns ValidationResult with errors (FAIL) and warnings (WARN).
 */
export function validateCanonicalDocument(doc: unknown): ValidationResult {
  const errors: { path: string; message: string }[] = [];
  const warnings: string[] = [];

  // 1. Zod structural validation
  const parsed = CanonicalArticleDocumentSchema.safeParse(doc);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        path: issue.path.join("."),
        message: issue.message,
      });
    }
    return { valid: false, errors, warnings };
  }

  const d = parsed.data;

  // 2. SOP FAIL-level checks (from exploration-results.md Appendix C)

  // --- Structure checks ---

  // Executive summary length: 25-40 words
  const execWords = countWords(d.executiveSummary);
  if (execWords < 25 || execWords > 40) {
    errors.push({
      path: "executiveSummary",
      message: `Executive summary must be 25-40 words, got ${execWords}`,
    });
  }

  // Meta title length: 50-60 characters
  if (d.metaTitle.length < 50 || d.metaTitle.length > 60) {
    errors.push({
      path: "metaTitle",
      message: `Meta title must be 50-60 characters, got ${d.metaTitle.length}`,
    });
  }

  // Meta description length: 150-160 characters
  if (d.metaDescription.length < 150 || d.metaDescription.length > 160) {
    errors.push({
      path: "metaDescription",
      message: `Meta description must be 150-160 characters, got ${d.metaDescription.length}`,
    });
  }

  // H2 count by article type
  const h2Count = d.sections.filter((s) => s.headingLevel === 2).length;
  const h2Ranges: Record<string, [number, number]> = {
    hub: [5, 8],
    spoke: [3, 5],
    news: [2, 3],
  };
  const [h2Min, h2Max] = h2Ranges[d.articleType] || [2, 8];
  if (h2Count < h2Min || h2Count > h2Max) {
    errors.push({
      path: "sections",
      message: `${d.articleType} articles need ${h2Min}-${h2Max} H2 sections, got ${h2Count}`,
    });
  }

  // Heading hierarchy: H3 must not appear before any H2
  let hasSeenH2 = false;
  for (let i = 0; i < d.sections.length; i++) {
    const s = d.sections[i];
    if (s.headingLevel === 2) hasSeenH2 = true;
    if (s.headingLevel === 3 && !hasSeenH2) {
      errors.push({
        path: `sections[${i}].headingLevel`,
        message: "H3 appears before any H2 — heading hierarchy violation",
      });
    }
  }

  // --- Volume checks ---

  // Word count minimum
  const wordCount = countDocumentWords(d);
  const wordMins: Record<string, number> = {
    hub: 2500,
    spoke: 1200,
    news: 600,
  };
  const wordMin = wordMins[d.articleType] || 600;
  if (wordCount < wordMin) {
    errors.push({
      path: "sections",
      message: `${d.articleType} articles need >= ${wordMin} words, got ${wordCount}`,
    });
  }

  // Internal link minimum
  const ilMins: Record<string, number> = { hub: 8, spoke: 5, news: 3 };
  const ilMin = ilMins[d.articleType] || 3;
  if (d.internalLinks.length < ilMin) {
    errors.push({
      path: "internalLinks",
      message: `${d.articleType} articles need >= ${ilMin} internal links, got ${d.internalLinks.length}`,
    });
  }

  // External link minimum
  const elMins: Record<string, number> = { hub: 5, spoke: 3, news: 2 };
  const elMin = elMins[d.articleType] || 2;
  if (d.externalLinks.length < elMin) {
    errors.push({
      path: "externalLinks",
      message: `${d.articleType} articles need >= ${elMin} external links, got ${d.externalLinks.length}`,
    });
  }

  // Core page links: at least 3
  const corePageLinks = d.internalLinks.filter(
    (l) => l.targetCorePage !== null
  ).length;
  if (corePageLinks < 3) {
    errors.push({
      path: "internalLinks",
      message: `Need >= 3 core page links, got ${corePageLinks}`,
    });
  }

  // --- Image & Accessibility checks ---

  // All images: check alt text and dimensions
  const allImages: { placement: typeof d.heroImage; path: string }[] = [];
  if (d.heroImage) {
    allImages.push({ placement: d.heroImage, path: "heroImage" });
  }
  for (let si = 0; si < d.sections.length; si++) {
    for (let ci = 0; ci < d.sections[si].content.length; ci++) {
      const node = d.sections[si].content[ci];
      if (node.type === "image") {
        allImages.push({
          placement: node.placement,
          path: `sections[${si}].content[${ci}].placement`,
        });
      }
    }
  }

  for (const { placement, path } of allImages) {
    if (!placement) continue;
    // Dimensions required
    if (placement.width === null || placement.height === null) {
      errors.push({
        path: `${path}.width/height`,
        message: "Image must have explicit width and height",
      });
    }
    // Alt text rules
    if (placement.classification === "informative") {
      const altWords = countWords(placement.alt);
      if (altWords < 10 || altWords > 25) {
        errors.push({
          path: `${path}.alt`,
          message: `Informative image alt must be 10-25 words, got ${altWords}`,
        });
      }
    }
    if (placement.classification === "decorative" && placement.alt !== "") {
      errors.push({
        path: `${path}.alt`,
        message: 'Decorative image alt must be empty string ""',
      });
    }
  }

  // --- Schema & Metadata checks ---

  // BlogPosting must be true
  if (!d.schema.blogPosting) {
    errors.push({
      path: "schema.blogPosting",
      message: "BlogPosting schema must be true on every article",
    });
  }

  // FAQPage sync
  if (d.faq.length > 0 && !d.schema.faqPage) {
    errors.push({
      path: "schema.faqPage",
      message: "faqPage must be true when faq array is non-empty",
    });
  }
  if (d.faq.length === 0 && d.schema.faqPage) {
    errors.push({
      path: "schema.faqPage",
      message: "faqPage must be false when faq array is empty",
    });
  }

  // Author present
  if (!d.author.name || !d.author.credentials) {
    errors.push({
      path: "author",
      message: "Author name and credentials are required",
    });
  }

  // Dates must be valid ISO 8601
  if (isNaN(Date.parse(d.publishDate))) {
    errors.push({
      path: "publishDate",
      message: "publishDate must be a valid ISO 8601 date",
    });
  }
  if (isNaN(Date.parse(d.modifiedDate))) {
    errors.push({
      path: "modifiedDate",
      message: "modifiedDate must be a valid ISO 8601 date",
    });
  }

  // Canonical URL must start with https://www.bhutanwine.com/
  if (!d.canonicalUrl.startsWith("https://www.bhutanwine.com/")) {
    errors.push({
      path: "canonicalUrl",
      message:
        'canonicalUrl must start with "https://www.bhutanwine.com/"',
    });
  }

  // --- WARN-level checks (don't block, but surface) ---

  // Generic anchor text
  const genericAnchors = ["click here", "read more", "learn more"];
  for (const link of d.internalLinks) {
    if (genericAnchors.includes(link.anchorText.toLowerCase())) {
      warnings.push(
        `Internal link "${link.anchorText}" uses generic anchor text`
      );
    }
    const anchorWords = countWords(link.anchorText);
    if (anchorWords < 3 || anchorWords > 8) {
      warnings.push(
        `Internal link anchor "${link.anchorText}" should be 3-8 words (got ${anchorWords})`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

### Step 1.3: Create `src/lib/article-schema/repair.ts`

Handles common Claude model output issues. Repair is cheap; rendering a broken doc is expensive.

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import { CanonicalArticleDocumentSchema } from "./schema";

/**
 * Attempt to repair a potentially malformed CanonicalArticleDocument.
 * Returns the repaired document, a list of human-readable changes, and
 * whether the input was valid BEFORE repairs.
 */
export function repairCanonicalDocument(doc: unknown): {
  repaired: CanonicalArticleDocument;
  changes: string[];
  valid: boolean;
} {
  const changes: string[] = [];

  // Check if already valid
  const preCheck = CanonicalArticleDocumentSchema.safeParse(doc);
  const wasValid = preCheck.success;

  if (typeof doc !== "object" || doc === null) {
    throw new Error("RENDER_ERROR");
  }

  // Work on a mutable copy
  const d = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  // 1. Missing version
  if (!d.version || typeof d.version !== "string") {
    d.version = "1.0";
    changes.push('Set missing version to "1.0"');
  }

  // 2. Missing optional arrays
  const arrayFields = [
    "faq",
    "internalLinks",
    "externalLinks",
    "captureComponents",
    "dataNosnippetSections",
  ];
  for (const field of arrayFields) {
    if (!Array.isArray(d[field])) {
      d[field] = [];
      changes.push(`Set missing ${field} to []`);
    }
  }

  // 3. Missing optional nullable fields
  if (!("heroImage" in d) || d.heroImage === undefined) {
    d.heroImage = null;
    changes.push("Set missing heroImage to null");
  }
  if (!("hubId" in d) || d.hubId === undefined) {
    d.hubId = null;
    changes.push("Set missing hubId to null");
  }

  // 4. Schema flags missing or incomplete
  if (typeof d.schema !== "object" || d.schema === null) {
    const faqArr = d.faq as unknown[];
    d.schema = {
      blogPosting: true,
      faqPage: Array.isArray(faqArr) && faqArr.length > 0,
      product: false,
    };
    changes.push("Set missing schema flags to defaults");
  } else {
    const s = d.schema as Record<string, unknown>;
    if (typeof s.blogPosting !== "boolean") {
      s.blogPosting = true;
      changes.push("Set schema.blogPosting to true");
    }
    if (typeof s.faqPage !== "boolean") {
      const faqArr = d.faq as unknown[];
      s.faqPage = Array.isArray(faqArr) && faqArr.length > 0;
      changes.push(`Set schema.faqPage to ${s.faqPage}`);
    }
    if (typeof s.product !== "boolean") {
      s.product = false;
      changes.push("Set schema.product to false");
    }
  }

  // 5. Duplicate section IDs
  if (Array.isArray(d.sections)) {
    const sectionIds = new Set<string>();
    for (const section of d.sections as Record<string, unknown>[]) {
      if (typeof section.id === "string") {
        let id = section.id;
        let counter = 2;
        while (sectionIds.has(id)) {
          id = `${section.id}-${counter}`;
          counter++;
        }
        if (id !== section.id) {
          changes.push(`Renamed duplicate section ID "${section.id}" to "${id}"`);
          section.id = id;
        }
        sectionIds.add(id);
      }
    }

    // 6. Missing content node IDs
    for (const section of d.sections as Record<string, unknown>[]) {
      if (Array.isArray(section.content)) {
        const nodes = section.content as Record<string, unknown>[];
        for (let i = 0; i < nodes.length; i++) {
          if (!nodes[i].id || typeof nodes[i].id !== "string") {
            nodes[i].id = `${section.id}-node-${i}`;
            changes.push(
              `Generated missing node ID: "${nodes[i].id}"`
            );
          }
        }
      }
    }

    // 7. headingLevel out of range — clamp to 2 or 3
    for (const section of d.sections as Record<string, unknown>[]) {
      const level = section.headingLevel;
      if (typeof level === "number" && (level < 2 || level > 3)) {
        section.headingLevel = level < 2 ? 2 : 3;
        changes.push(
          `Clamped headingLevel ${level} to ${section.headingLevel}`
        );
      }
    }
  }

  // 8. Remove malformed link entries (missing required fields)
  if (Array.isArray(d.internalLinks)) {
    const before = (d.internalLinks as unknown[]).length;
    d.internalLinks = (d.internalLinks as Record<string, unknown>[]).filter(
      (l) =>
        typeof l.targetUrl === "string" &&
        l.targetUrl.length > 0 &&
        typeof l.anchorText === "string" &&
        l.anchorText.length > 0
    );
    const removed = before - (d.internalLinks as unknown[]).length;
    if (removed > 0) {
      changes.push(`Removed ${removed} malformed internal link(s)`);
    }
  }

  if (Array.isArray(d.externalLinks)) {
    const before = (d.externalLinks as unknown[]).length;
    d.externalLinks = (d.externalLinks as Record<string, unknown>[]).filter(
      (l) =>
        typeof l.url === "string" &&
        l.url.length > 0 &&
        typeof l.anchorText === "string" &&
        l.anchorText.length > 0
    );
    const removed = before - (d.externalLinks as unknown[]).length;
    if (removed > 0) {
      changes.push(`Removed ${removed} malformed external link(s)`);
    }
  }

  // Re-parse after repairs
  const postCheck = CanonicalArticleDocumentSchema.safeParse(d);
  if (!postCheck.success) {
    // If still invalid after repairs, throw — the document is too broken
    throw new Error("RENDER_ERROR");
  }

  return {
    repaired: postCheck.data as unknown as CanonicalArticleDocument,
    changes,
    valid: wasValid,
  };
}
```

### Step 1.4: Create `src/lib/article-schema/index.ts`

Barrel re-exports following the established pattern (named exports only, no defaults):

```typescript
export { validateCanonicalDocument } from './validate';
export { repairCanonicalDocument } from './repair';
export {
  CanonicalArticleDocumentSchema,
  ArticleSectionSchema,
  ContentNodeSchema,
  ImagePlacementSchema,
  AuthorInfoSchema,
  FAQItemSchema,
  InternalLinkRefSchema,
  ExternalLinkRefSchema,
  SchemaFlagsSchema,
  CaptureTypeSchema,
  ArticleTypeSchema,
} from './schema';
```

### Phase 1 Gate

Run `npx tsc --noEmit`. Must exit 0. Then verify in the test script (Phase 5).

---

## Phase 2: Article Renderer — `src/lib/renderer/`

### Step 2.1: Create `src/lib/renderer/cloudinary.ts`

```typescript
import type { CloudinaryTransform } from "@/types/photo";
import { env } from "@/lib/env";

/**
 * Build a Cloudinary CDN URL with optional transforms.
 * Returns empty string if publicId is null/empty.
 * URL pattern: https://res.cloudinary.com/{cloudName}/image/upload/{transforms}/{publicId}
 */
export function buildCloudinaryUrl(
  publicId: string | null,
  transforms?: Partial<CloudinaryTransform>
): string {
  if (!publicId) return "";

  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return "";

  const parts: string[] = [];
  if (transforms?.width) parts.push(`w_${transforms.width}`);
  parts.push(`f_${transforms?.format || "auto"}`);
  parts.push(`q_${transforms?.quality || "auto"}`);
  if (transforms?.additionalParams) parts.push(transforms.additionalParams);

  const transformStr = parts.join(",");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformStr}/${publicId}`;
}
```

### Step 2.2: Create `src/lib/renderer/css.ts`

This embeds the complete BWC stylesheet from the Brand Style Guide. Every CSS rule comes directly from the exploration-results.md Appendix D and the Brand Style Guide §3, §6, §7, §13, §14.

```typescript
/**
 * Complete embedded BWC blog stylesheet.
 * Source: Brand Style Guide §3 (variables), §6 (typography), §7 (layout),
 * §13 (mobile), §14 (links).
 * NEVER modify these values — they come from the Brand Style Guide.
 */
export const BWC_STYLESHEET = `
:root {
  /* Primary */
  --bwc-gold: #bc9b5d;
  --bwc-black: #000000;
  --bwc-white: #ffffff;

  /* Text */
  --bwc-text-primary: #000000;
  --bwc-text-secondary: #414141;
  --bwc-text-dark-alt: #242323;
  --bwc-text-footer: #292929;
  --bwc-text-brown: #624c40;

  /* Backgrounds */
  --bwc-bg-cream: #fcf8ed;
  --bwc-bg-peach: #f6ebe4;
  --bwc-bg-light: #f7f7f7;
  --bwc-bg-soft-gray: #e8e6e6;
  --bwc-bg-blue: #c8eef5;
  --bwc-bg-green: #316142;

  /* Borders */
  --bwc-border-light: #cccccc;

  /* Spacing */
  --space-xs: 8px;
  --space-sm: 16px;
  --space-md: 24px;
  --space-lg: 48px;
  --space-xl: 80px;
  --space-2xl: 120px;
}

/* Layout */
.bwc-article {
  max-width: 980px;
  margin: 0 auto;
  padding: 0 var(--space-sm);
  font-family: 'Nunito Sans', sans-serif;
}

.blog-content {
  max-width: 760px;
  margin: 0 auto;
}

/* Blog Post Typography Mapping — Brand Style Guide §6 */
article h1 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 48px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--bwc-gold);
  margin: 0 0 0.5em;
}

article h2 {
  font-family: 'Fraunces', serif;
  font-size: 36px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--bwc-text-dark-alt);
  margin: 2em 0 0.75em;
}

article h3 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--bwc-text-primary);
  margin: 1.5em 0 0.5em;
}

article h4 {
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--bwc-text-secondary);
  margin: 1.25em 0 0.5em;
}

article p,
article li {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 16px;
  font-weight: 300;
  line-height: 1.7;
  color: var(--bwc-text-primary);
}

article p {
  margin: 0 0 1.25em;
}

article ul,
article ol {
  margin: 0 0 1.5em 1.25em;
  padding: 0;
}

article li + li {
  margin-top: 0.45em;
}

article blockquote {
  font-family: 'Cormorant Garamond', serif;
  font-size: 24px;
  font-weight: 300;
  line-height: 1.5;
  letter-spacing: 0.5px;
  color: var(--bwc-text-brown);
  border-left: 3px solid var(--bwc-gold);
  padding-left: 1.25em;
  margin: 2em 0;
  font-style: italic;
}

/* Links — Brand Style Guide §14 */
article a {
  color: var(--bwc-gold);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.14em;
  transition: opacity 0.2s ease;
}

article a:hover,
article a:focus-visible {
  opacity: 0.85;
}

/* Images — Brand Style Guide §6 */
article figure {
  margin: 2em 0;
}

article img {
  display: block;
  width: 100%;
  height: auto;
}

article figcaption {
  font-family: 'Trirong', serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.45;
  color: var(--bwc-text-secondary);
  margin-top: 0.5em;
}

/* Lead / Intro — Brand Style Guide §6 */
article .lead,
article .intro {
  font-family: 'Fraunces', serif;
  font-size: 21px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--bwc-text-secondary);
  margin-bottom: 2em;
}

/* Meta / Eyebrow / Last Updated — Brand Style Guide §6 */
article .meta,
article .eyebrow,
article .last-updated {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--bwc-text-secondary);
}

/* BEM Components */
.bwc-executive-summary {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.7;
  color: var(--bwc-text-primary);
  margin-bottom: 1.5em;
}

.bwc-pullquote {
  font-family: 'Cormorant Garamond', serif;
  font-size: 24px;
  font-weight: 300;
  line-height: 1.5;
  color: var(--bwc-text-brown);
  border-left: 3px solid var(--bwc-gold);
  padding-left: 1.25em;
  margin: 2em 0;
  font-style: italic;
}

.bwc-pullquote cite {
  font-style: normal;
  font-size: 14px;
  color: var(--bwc-text-secondary);
  display: block;
  margin-top: 0.5em;
}

.bwc-key-facts {
  background: var(--bwc-bg-cream);
  padding: var(--space-md);
  margin: 2em 0;
  border-radius: 4px;
}

.bwc-key-facts__title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-weight: 600;
  color: var(--bwc-text-primary);
  margin: 0 0 var(--space-sm);
}

.bwc-key-facts__list {
  margin: 0;
  padding: 0;
}

.bwc-key-facts__list dt {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: var(--bwc-text-secondary);
  margin-top: var(--space-xs);
}

.bwc-key-facts__list dd {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 16px;
  font-weight: 300;
  color: var(--bwc-text-primary);
  margin: 2px 0 0 0;
}

.bwc-callout {
  padding: var(--space-md);
  margin: 2em 0;
  border-radius: 4px;
  border-left: 3px solid var(--bwc-gold);
}

.bwc-callout--info {
  background: var(--bwc-bg-blue);
}

.bwc-callout--tip {
  background: var(--bwc-bg-cream);
}

.bwc-callout--warning {
  background: var(--bwc-bg-peach);
}

.bwc-figure {
  margin: 2em 0;
}

.bwc-figure--decorative img {
  margin: 0 auto;
}

.bwc-faq {
  margin: var(--space-lg) 0;
}

.bwc-author-bio {
  border-top: 1px solid var(--bwc-border-light);
  padding-top: var(--space-md);
  margin-top: var(--space-lg);
}

.bwc-author-bio__name {
  font-family: 'Cormorant Garamond', serif;
  font-size: 20px;
  font-weight: 600;
  color: var(--bwc-text-primary);
}

.bwc-author-bio__credentials {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 14px;
  color: var(--bwc-text-secondary);
}

.article-footer {
  border-top: 1px solid var(--bwc-border-light);
  padding-top: var(--space-sm);
  margin-top: var(--space-lg);
}

article table {
  width: 100%;
  border-collapse: collapse;
  margin: 2em 0;
  font-family: 'Nunito Sans', sans-serif;
  font-size: 15px;
}

article table caption {
  font-family: 'Trirong', serif;
  font-size: 13px;
  color: var(--bwc-text-secondary);
  text-align: left;
  margin-bottom: 0.5em;
}

article th {
  font-weight: 700;
  text-align: left;
  padding: 0.75em 1em;
  border-bottom: 2px solid var(--bwc-gold);
  color: var(--bwc-text-primary);
}

article td {
  padding: 0.75em 1em;
  border-bottom: 1px solid var(--bwc-border-light);
  color: var(--bwc-text-primary);
}

/* Mobile — Brand Style Guide §13 */
@media (max-width: 768px) {
  article h1 {
    font-size: 38px;
    line-height: 1.15;
  }

  article h2 {
    font-size: 30px;
    line-height: 1.2;
  }

  article h3 {
    font-size: 24px;
    line-height: 1.3;
  }

  article p,
  article li {
    font-size: 16px;
    line-height: 1.7;
  }

  article .lead,
  article .intro {
    font-size: 19px;
    line-height: 1.5;
  }
}
`.trim();
```

### Step 2.3: Create `src/lib/renderer/jsonld.ts`

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import { buildCloudinaryUrl } from "./cloudinary";

/**
 * Build JSON-LD schema blocks from the canonical document metadata.
 * Returns a string containing one or more <script type="application/ld+json"> blocks.
 */
export function buildSchemaJson(doc: CanonicalArticleDocument): string {
  const blocks: string[] = [];

  // BlogPosting (always present — enforced by validation)
  if (doc.schema.blogPosting) {
    const heroUrl = doc.heroImage
      ? doc.heroImage.src || buildCloudinaryUrl(doc.heroImage.photoId ? `blog/${doc.heroImage.photoId}` : null)
      : undefined;

    const blogPosting: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: doc.title,
      datePublished: doc.publishDate,
      dateModified: doc.modifiedDate,
      author: {
        "@type": "Person",
        name: doc.author.name,
        ...(doc.author.credentials && { jobTitle: doc.author.credentials }),
        ...(doc.author.linkedinUrl && { url: doc.author.linkedinUrl }),
      },
      publisher: {
        "@type": "Organization",
        name: "Bhutan Wine Company",
        url: "https://www.bhutanwine.com",
      },
      description: doc.metaDescription,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": doc.canonicalUrl,
      },
    };

    if (heroUrl) {
      blogPosting.image = heroUrl;
    }

    blocks.push(
      `<script type="application/ld+json">\n${JSON.stringify(blogPosting, null, 2)}\n</script>`
    );
  }

  // FAQPage (only when faq items exist and flag is true)
  if (doc.schema.faqPage && doc.faq.length > 0) {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: doc.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };

    blocks.push(
      `<script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n</script>`
    );
  }

  return blocks.join("\n");
}
```

### Step 2.4: Create `src/lib/renderer/components.ts`

HTML template functions for each ContentNode type:

```typescript
import type {
  ContentNode,
  ImagePlacement,
  FAQItem,
  CanonicalArticleDocument,
} from "@/types/article";
import { buildCloudinaryUrl } from "./cloudinary";

/** Escape HTML special characters in user-provided text */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format ISO date to human-readable */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Render an image placement (figure + img + figcaption) */
function renderImage(
  placement: ImagePlacement,
  isHero: boolean
): string {
  // Determine image src: use Cloudinary URL if photoId is set, otherwise use src directly
  const src = placement.photoId
    ? buildCloudinaryUrl(`blog/${placement.photoId}`, {
        width: placement.width || 1200,
      })
    : placement.src;

  const loading = isHero ? "eager" : "lazy";
  const fetchPriority = isHero ? '\n      fetchpriority="high"' : "";

  const isDecorative = placement.classification === "decorative";
  const altAttr = isDecorative ? 'alt=""' : `alt="${escapeHtml(placement.alt)}"`;
  const roleAttr = isDecorative ? '\n      role="presentation"' : "";

  const figureClass = isDecorative
    ? 'class="bwc-figure bwc-figure--decorative"'
    : 'class="bwc-figure"';

  const widthAttr = placement.width ? `\n      width="${placement.width}"` : "";
  const heightAttr = placement.height ? `\n      height="${placement.height}"` : "";

  let html = `<figure ${figureClass}>
    <img
      src="${escapeHtml(src)}"
      ${altAttr}${widthAttr}${heightAttr}
      loading="${loading}"${fetchPriority}${roleAttr}
    />`;

  if (!isDecorative && placement.caption) {
    html += `\n    <figcaption>${escapeHtml(placement.caption)}</figcaption>`;
  }

  html += "\n  </figure>";
  return html;
}

/** Render a content node to HTML */
export function renderContentNode(
  node: ContentNode,
  dataCadPrefix: string
): string {
  const path = `${dataCadPrefix}`;

  switch (node.type) {
    case "paragraph":
      // Paragraph text may contain inline HTML (links, bold, italic) — pass through
      return `<p data-cad-path="${path}.text">${node.text}</p>`;

    case "image":
      return renderImage(node.placement, false);

    case "pullQuote": {
      let html = `<blockquote class="bwc-pullquote">
    <p data-cad-path="${path}.text">${escapeHtml(node.text)}</p>`;
      if (node.attribution) {
        html += `\n    <cite data-cad-path="${path}.attribution">${escapeHtml(node.attribution)}</cite>`;
      }
      html += "\n  </blockquote>";
      return html;
    }

    case "keyFacts": {
      let html = `<aside class="bwc-key-facts">
    <h3 class="bwc-key-facts__title" data-cad-path="${path}.title">${escapeHtml(node.title)}</h3>
    <dl class="bwc-key-facts__list">`;
      for (const fact of node.facts) {
        html += `\n      <dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd>`;
      }
      html += "\n    </dl>\n  </aside>";
      return html;
    }

    case "table": {
      let html = "<table>";
      if (node.caption) {
        html += `\n    <caption>${escapeHtml(node.caption)}</caption>`;
      }
      if (node.headers.length > 0) {
        html += "\n    <thead><tr>";
        for (const h of node.headers) {
          html += `<th>${escapeHtml(h)}</th>`;
        }
        html += "</tr></thead>";
      }
      html += "\n    <tbody>";
      for (const row of node.rows) {
        html += "\n      <tr>";
        for (const cell of row) {
          html += `<td>${escapeHtml(cell)}</td>`;
        }
        html += "</tr>";
      }
      html += "\n    </tbody>\n  </table>";
      return html;
    }

    case "list": {
      const tag = node.ordered ? "ol" : "ul";
      let html = `<${tag}>`;
      for (const item of node.items) {
        // List items may contain inline HTML — pass through
        html += `\n    <li>${item}</li>`;
      }
      html += `\n  </${tag}>`;
      return html;
    }

    case "callout":
      return `<aside class="bwc-callout bwc-callout--${node.variant}">
    <p data-cad-path="${path}.text">${node.text}</p>
  </aside>`;

    default:
      return `<!-- Unknown content node type -->`;
  }
}

/** Render the hero header section */
export function renderHero(doc: CanonicalArticleDocument): string {
  return `<header class="blog-hero">
    <p class="eyebrow">Bhutan Wine Company Journal</p>
    <h1 data-cad-path="title">${escapeHtml(doc.title)}</h1>
    <p class="bwc-executive-summary" data-cad-path="executiveSummary"><strong>${escapeHtml(doc.executiveSummary)}</strong></p>
    <p class="meta">
      <time datetime="${doc.publishDate}">${formatDate(doc.publishDate)}</time>
      <span aria-hidden="true"> &middot; </span>
      <span>By ${escapeHtml(doc.author.name)}${doc.author.credentials ? `, ${escapeHtml(doc.author.credentials)}` : ""}</span>
    </p>
  </header>`;
}

/** Render the hero image (separate from hero header for loading priority) */
export function renderHeroImage(doc: CanonicalArticleDocument): string {
  if (!doc.heroImage) return "";
  return renderImage(doc.heroImage, true);
}

/** Render FAQ section */
export function renderFaq(items: FAQItem[]): string {
  if (items.length === 0) return "";

  let html = `<section class="bwc-faq">
    <h2>Frequently Asked Questions</h2>`;

  for (let i = 0; i < items.length; i++) {
    html += `\n    <h3 data-cad-path="faq[${i}].question">${escapeHtml(items[i].question)}</h3>`;
    html += `\n    <p data-cad-path="faq[${i}].answer">${escapeHtml(items[i].answer)}</p>`;
  }

  html += "\n  </section>";
  return html;
}

/** Render author bio footer */
export function renderAuthorBio(doc: CanonicalArticleDocument): string {
  let html = `<footer class="bwc-author-bio">
    <p class="bwc-author-bio__name">${escapeHtml(doc.author.name)}</p>
    <p class="bwc-author-bio__credentials">${escapeHtml(doc.author.credentials)}</p>`;

  if (doc.author.bio) {
    html += `\n    <p>${escapeHtml(doc.author.bio)}</p>`;
  }
  if (doc.author.linkedinUrl) {
    html += `\n    <p><a href="${escapeHtml(doc.author.linkedinUrl)}" target="_blank" rel="noopener noreferrer">LinkedIn Profile</a></p>`;
  }

  html += "\n  </footer>";
  return html;
}

/** Render article footer with last-updated date */
export function renderArticleFooter(doc: CanonicalArticleDocument): string {
  return `<footer class="article-footer">
    <p class="last-updated">Last updated: <time datetime="${doc.modifiedDate}">${formatDate(doc.modifiedDate)}</time></p>
  </footer>`;
}
```

### Step 2.5: Create `src/lib/renderer/compiled-template.ts`

This combines the Google Fonts import and the CSS into the "compiled template" consumed by the renderer.

```typescript
import { BWC_STYLESHEET } from "./css";

/** Google Fonts preconnect + stylesheet links */
export const GOOGLE_FONTS_HTML = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Nunito+Sans:wght@300;400;700&family=Trirong&display=swap" rel="stylesheet">`;

/** The full embedded <style> block */
export const STYLE_BLOCK = `<style>\n${BWC_STYLESHEET}\n</style>`;

/** Template version constant */
export const TEMPLATE_VERSION = "2026.1";
```

### Step 2.6: Create `src/lib/renderer/renderer.ts`

The main renderer — a pure function with no side effects.

```typescript
import type { CanonicalArticleDocument } from "@/types/article";
import type { RendererInput, RendererOutput } from "@/types/renderer";
import type { HtmlOverride } from "@/types/renderer";
import { repairCanonicalDocument } from "@/lib/article-schema";
import { buildSchemaJson } from "./jsonld";
import { GOOGLE_FONTS_HTML, STYLE_BLOCK } from "./compiled-template";
import {
  renderHero,
  renderHeroImage,
  renderContentNode,
  renderFaq,
  renderAuthorBio,
  renderArticleFooter,
} from "./components";

/** Count words in rendered text (strip HTML tags) */
function countRenderedWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, "").trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

/** Escape HTML for attribute values */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Render a CanonicalArticleDocument into complete Wix-ready HTML.
 * This is a PURE FUNCTION — no DB calls, no API calls, no side effects.
 */
export function renderArticle(input: RendererInput): RendererOutput {
  // Auto-repair before rendering (repair is cheap, rendering broken doc is expensive)
  const { repaired: doc } = repairCanonicalDocument(input.document);

  // Build JSON-LD schema blocks
  const schemaJson = buildSchemaJson(doc);

  // Build sections HTML
  let sectionsHtml = "";
  for (let si = 0; si < doc.sections.length; si++) {
    const section = doc.sections[si];
    const tag = section.headingLevel === 2 ? "h2" : "h3";
    const cadPath = `sections[${si}]`;

    // data-nosnippet wrapper
    const isNosnippet = doc.dataNosnippetSections.includes(section.id);
    if (isNosnippet) {
      sectionsHtml += '\n    <div data-nosnippet>';
    }

    sectionsHtml += `\n    <${tag} data-cad-path="${cadPath}.heading">${escapeAttr(section.heading)}</${tag}>`;

    for (let ci = 0; ci < section.content.length; ci++) {
      const nodePath = `${cadPath}.content[${ci}]`;
      sectionsHtml += "\n    " + renderContentNode(section.content[ci], nodePath);
    }

    if (isNosnippet) {
      sectionsHtml += '\n    </div>';
    }
  }

  // Assemble the full HTML document
  const bodyHtml = `
  <article class="bwc-article">
    ${renderHero(doc)}
    ${renderHeroImage(doc)}
    <section class="blog-content">${sectionsHtml}
    </section>
    ${renderFaq(doc.faq)}
    ${renderAuthorBio(doc)}
    ${renderArticleFooter(doc)}
  </article>`;

  let fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeAttr(doc.metaTitle)}</title>
  <meta name="description" content="${escapeAttr(doc.metaDescription)}">
  <link rel="canonical" href="${escapeAttr(doc.canonicalUrl)}">
  ${GOOGLE_FONTS_HTML}
  ${STYLE_BLOCK}
  ${schemaJson}
</head>
<body>${bodyHtml}
</body>
</html>`;

  // Apply HTML overrides (if any)
  const overrides: HtmlOverride[] = input.htmlOverrides || [];
  for (const override of overrides) {
    // Simple path-based replacement: find element with matching data-cad-path
    const pattern = `data-cad-path="${override.path}"`;
    const idx = fullHtml.indexOf(pattern);
    if (idx !== -1) {
      // Find the containing element's opening and closing tags
      const tagStart = fullHtml.lastIndexOf("<", idx);
      const tagEnd = fullHtml.indexOf(">", idx);
      if (tagStart !== -1 && tagEnd !== -1) {
        // Find closing tag
        const afterTag = fullHtml.substring(tagEnd + 1);
        const tagName = fullHtml.substring(tagStart + 1, fullHtml.indexOf(" ", tagStart + 1));
        const closeIdx = afterTag.indexOf(`</${tagName}>`);
        if (closeIdx !== -1) {
          const absoluteCloseStart = tagEnd + 1 + closeIdx;
          const absoluteCloseEnd = absoluteCloseStart + tagName.length + 3;
          fullHtml =
            fullHtml.substring(0, tagStart) +
            override.html +
            fullHtml.substring(absoluteCloseEnd);
        }
      }
    }
  }

  // Count words from body content only (not head/schema)
  const wordCount = countRenderedWords(bodyHtml);

  return {
    html: fullHtml,
    metaTitle: doc.metaTitle,
    metaDescription: doc.metaDescription,
    schemaJson,
    wordCount,
  };
}
```

### Step 2.7: Create `src/lib/renderer/index.ts`

```typescript
export { renderArticle } from './renderer';
export { buildCloudinaryUrl } from './cloudinary';
export { buildSchemaJson } from './jsonld';
export { BWC_STYLESHEET } from './css';
export { GOOGLE_FONTS_HTML, STYLE_BLOCK, TEMPLATE_VERSION } from './compiled-template';
```

### Phase 2 Gate

Run `npx tsc --noEmit`. Must exit 0.

---

## Phase 3: API Routes

### Step 3.1: Create `src/app/api/articles/render/route.ts`

Follow the established route handler pattern exactly:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { renderArticle } from "@/lib/renderer";
import { z } from "zod";

const RenderRequestSchema = z.object({
  document: z.record(z.unknown()),
  htmlOverrides: z
    .array(
      z.object({
        path: z.string(),
        html: z.string(),
        reason: z.string(),
      })
    )
    .nullable()
    .default(null),
  templateVersion: z.string().default("1.0"),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = RenderRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const result = renderArticle({
      document: parsed.data.document as never,
      htmlOverrides: parsed.data.htmlOverrides,
      templateVersion: parsed.data.templateVersion,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_REQUIRED", message: "Authentication required" },
        },
        { status: 401 }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_FORBIDDEN", message: "Admin access required" },
        },
        { status: 403 }
      );
    }
    if (message === "RENDER_ERROR") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RENDER_ERROR", message: "Article rendering failed" },
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
```

### Step 3.2: Create `src/app/api/articles/validate/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { validateCanonicalDocument } from "@/lib/article-schema";
import { repairCanonicalDocument } from "@/lib/article-schema";
import { z } from "zod";

const ValidateRequestSchema = z.object({
  document: z.record(z.unknown()),
  repair: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = ValidateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { document, repair } = parsed.data;

    if (repair) {
      try {
        const repairResult = repairCanonicalDocument(document);
        const postValidation = validateCanonicalDocument(repairResult.repaired);
        return NextResponse.json({
          success: true,
          data: {
            ...postValidation,
            repaired: repairResult.repaired,
            changes: repairResult.changes,
            validBeforeRepair: repairResult.valid,
          },
        });
      } catch {
        return NextResponse.json({
          success: true,
          data: {
            valid: false,
            errors: [{ path: "", message: "Document too broken to repair" }],
            warnings: [],
          },
        });
      }
    }

    const result = validateCanonicalDocument(document);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_REQUIRED", message: "Authentication required" },
        },
        { status: 401 }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_FORBIDDEN", message: "Admin access required" },
        },
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

### Phase 3 Gate

Run `npx tsc --noEmit`. Must exit 0. Run `npm run build`. Must compile all routes with zero errors.

---

## Phase 4: Test Fixture + Test Script

### Step 4.1: Create `scripts/fixtures/sample-canonical-doc.json`

A minimal valid CanonicalArticleDocument that passes all SOP FAIL checks for a "spoke" article:

```json
{
  "version": "1.0",
  "articleId": 1,
  "slug": "traminette-grape-guide",
  "articleType": "spoke",
  "hubId": 1,
  "title": "Traminette: The Aromatic White Grape Thriving in Bhutan's Himalayas",
  "metaTitle": "Traminette Grape Guide | Bhutan Wine Company Journal",
  "metaDescription": "Discover Traminette, the aromatic white grape producing perfumed wines in Bhutan's Himalayas. Growing conditions, tasting notes, and where to find Ser Kem.",
  "canonicalUrl": "https://www.bhutanwine.com/post/traminette-grape-guide",
  "publishDate": "2026-03-01",
  "modifiedDate": "2026-03-01",
  "author": {
    "name": "Michael Smith",
    "credentials": "WSET Diploma, MW Candidate",
    "bio": "Michael is a wine writer and MW candidate with extensive experience in emerging wine regions.",
    "linkedinUrl": "https://www.linkedin.com/in/example"
  },
  "executiveSummary": "Traminette is an aromatic white hybrid grape that has emerged as one of Bhutan Wine Company's most expressive varieties, producing a perfumed Gewurztraminer-like wine from vineyards in the eastern Himalayas.",
  "heroImage": {
    "photoId": null,
    "src": "https://res.cloudinary.com/deahtb4kj/image/upload/w_1200,f_auto,q_auto/main-sample",
    "alt": "Traminette grape clusters showing golden green color on VSP trained vines at the Norzenthang vineyard in eastern Bhutan",
    "caption": "Traminette clusters at Norzenthang vineyard, eastern Bhutan.",
    "classification": "informative",
    "width": 1200,
    "height": 800
  },
  "sections": [
    {
      "id": "section-1",
      "heading": "The Story of Traminette in Bhutan",
      "headingLevel": 2,
      "content": [
        {
          "type": "paragraph",
          "id": "s1-p1",
          "text": "The Traminette vines at Norzenthang present a striking sight in late summer — clusters of golden-green grapes hanging in tight, compact bunches against the deep green canopy of the VSP trellises. When you walk between the rows in the weeks before harvest, the perfume is unmistakable: lychee, rose petal, and a honeyed spice that intensifies as the afternoon sun warms the eastern slopes. This is Traminette at its most expressive, a grape that has found an unlikely but extraordinary home in the Himalayas. The variety was first planted here as part of Bhutan Wine Company's experimental program, when founder's vision guided the selection of varietals that could thrive at extreme elevation. What began as an experiment has become one of BWC's signature expressions — a wine that captures the essence of high-altitude viticulture in every glass. The aromatic intensity of Traminette grown at these elevations surpasses what is typically achieved in more temperate growing regions, a testament to the unique terroir of eastern Bhutan."
        },
        {
          "type": "pullQuote",
          "id": "s1-pq1",
          "text": "The perfume is unmistakable — lychee, rose petal, and a honeyed spice that intensifies as the afternoon sun warms the eastern slopes.",
          "attribution": null
        }
      ]
    },
    {
      "id": "section-2",
      "heading": "Where Traminette Thrives in the Himalayas",
      "headingLevel": 2,
      "content": [
        {
          "type": "paragraph",
          "id": "s2-p1",
          "text": "The <a href=\"https://www.bhutanwine.com/the-grapes-vineyards\">BWC vineyard sites</a> in eastern Bhutan offer conditions that are ideal for aromatic white varieties. The combination of high elevation, dramatic diurnal temperature variation, and intense UV radiation creates a growing environment that amplifies the aromatic compounds — terpenes and thiols — that define Traminette's character. At Norzenthang, the vines sit at approximately 2,250 meters above sea level, experiencing daytime temperatures that promote sugar accumulation and nighttime temperatures that preserve the delicate acidity essential to balanced aromatic wines. The glacial alluvial clay loam soils provide excellent drainage while retaining enough moisture to sustain the vines through the dry pre-monsoon period. This terroir produces wines with a concentration and aromatic purity that is difficult to achieve at lower elevations."
        },
        {
          "type": "keyFacts",
          "id": "s2-kf1",
          "title": "Key Growing Facts",
          "facts": [
            { "label": "Elevation", "value": "2,250m above sea level" },
            { "label": "Soil Type", "value": "Glacial alluvial clay loam" },
            { "label": "Climate", "value": "Continental with monsoon influence" },
            { "label": "Planted Varieties", "value": "Traminette, Riesling, Sauvignon Blanc" }
          ]
        }
      ]
    },
    {
      "id": "section-3",
      "heading": "Tasting Notes and Wine Character",
      "headingLevel": 2,
      "content": [
        {
          "type": "paragraph",
          "id": "s3-p1",
          "text": "Bhutan Wine Company's Ser Kem Traminette is a wine of remarkable aromatic intensity and structural balance. On the nose, it opens with pronounced notes of lychee and rose petal, layered with white spice, honeysuckle, and a distinctive minerality that speaks to the high-altitude terroir. The palate delivers a richly textured wine with the weight and concentration one expects from low-yielding mountain vines, balanced by a crisp, almost electric acidity that is the hallmark of grapes grown above 2,000 meters. The finish is long and spice-driven, with lingering notes of ginger and white pepper that distinguish it from its Gewurztraminer parent. This is not a wine that fades quietly — it commands attention and rewards contemplation. The <a href=\"https://www.bhutanwine.com/our-wine\">BWC wine portfolio</a> showcases this variety as one of its most distinctive offerings, a wine unlike anything else being produced in Asia."
        },
        {
          "type": "paragraph",
          "id": "s3-p2",
          "text": "International wine critics have taken note of Traminette's potential in Bhutan. The <a href=\"https://www.oiv.int/\">International Organisation of Vine and Wine (OIV)</a> has recognized the significance of high-altitude viticulture programs in developing nations, and BWC's Traminette program represents one of the most ambitious expressions of this movement. According to the <a href=\"https://www.decanter.com/wine-travel/bhutan-wine/\">Decanter's coverage of emerging Asian wine regions</a>, Bhutan's unique position at the intersection of Himalayan geography and an organic-by-mandate agricultural policy creates conditions found nowhere else in the winemaking world. The <a href=\"https://www.jancisrobinson.com/\">Jancis Robinson MW assessment</a> of frontier wine regions highlights the importance of site selection and varietal matching — principles that guided BWC's decision to plant Traminette at Norzenthang."
        }
      ]
    },
    {
      "id": "section-4",
      "heading": "Visiting the Vineyards",
      "headingLevel": 2,
      "content": [
        {
          "type": "paragraph",
          "id": "s4-p1",
          "text": "For those planning to <a href=\"https://www.bhutanwine.com/visit-us\">visit BWC's vineyard sites</a>, the eastern vineyards offer a particularly memorable experience during the pre-harvest period from August through October. The Traminette rows at Norzenthang are accessible as part of BWC's guided vineyard tours, which provide an intimate look at high-altitude viticulture practices and the challenges of growing wine grapes in the Himalayas. Visitors can arrange tastings through the <a href=\"https://www.bhutanwine.com/2024-inquiry-request\">BWC allocation inquiry process</a>, which provides access to current and library vintages including the Ser Kem Traminette. The <a href=\"https://www.bhutanwine.com/about-us\">story of BWC's founding</a> adds depth to the tasting experience, connecting each wine to the broader narrative of Bhutan's emergence as a wine-producing nation."
        }
      ]
    }
  ],
  "faq": [
    {
      "question": "What does Traminette wine taste like?",
      "answer": "Traminette produces an aromatic white wine with pronounced notes of lychee, rose petal, and white spice — similar in profile to Gewurztraminer, which is one of its parent grapes. BWC's Ser Kem Traminette expresses these aromatics with a crisp high-altitude acidity that balances the richness."
    },
    {
      "question": "Where are Traminette grapes grown in Bhutan?",
      "answer": "Traminette is grown primarily at BWC's Norzenthang vineyard site in eastern Bhutan, at approximately 2,250 meters above sea level. The glacial alluvial clay loam soils and dramatic diurnal temperature variation create ideal conditions for aromatic white varieties."
    }
  ],
  "internalLinks": [
    { "targetUrl": "https://www.bhutanwine.com/the-grapes-vineyards", "targetArticleId": null, "targetCorePage": "https://www.bhutanwine.com/the-grapes-vineyards", "anchorText": "BWC vineyard sites", "linkType": "to-core-page", "sectionId": "section-2" },
    { "targetUrl": "https://www.bhutanwine.com/our-wine", "targetArticleId": null, "targetCorePage": "https://www.bhutanwine.com/our-wine", "anchorText": "BWC wine portfolio", "linkType": "to-core-page", "sectionId": "section-3" },
    { "targetUrl": "https://www.bhutanwine.com/visit-us", "targetArticleId": null, "targetCorePage": "https://www.bhutanwine.com/visit-us", "anchorText": "visit BWC's vineyard sites", "linkType": "to-core-page", "sectionId": "section-4" },
    { "targetUrl": "https://www.bhutanwine.com/2024-inquiry-request", "targetArticleId": null, "targetCorePage": "https://www.bhutanwine.com/2024-inquiry-request", "anchorText": "BWC allocation inquiry process", "linkType": "to-core-page", "sectionId": "section-4" },
    { "targetUrl": "https://www.bhutanwine.com/about-us", "targetArticleId": null, "targetCorePage": "https://www.bhutanwine.com/about-us", "anchorText": "story of BWC's founding", "linkType": "to-core-page", "sectionId": "section-4" }
  ],
  "externalLinks": [
    { "url": "https://www.oiv.int/", "anchorText": "International Organisation of Vine and Wine (OIV)", "trustTier": "primary", "sourceName": "OIV", "sectionId": "section-3" },
    { "url": "https://www.decanter.com/wine-travel/bhutan-wine/", "anchorText": "Decanter's coverage of emerging Asian wine regions", "trustTier": "authority", "sourceName": "Decanter", "sectionId": "section-3" },
    { "url": "https://www.jancisrobinson.com/", "anchorText": "Jancis Robinson MW assessment", "trustTier": "authority", "sourceName": "Jancis Robinson", "sectionId": "section-3" }
  ],
  "ctaType": "newsletter",
  "captureComponents": ["newsletter", "allocation"],
  "schema": {
    "blogPosting": true,
    "faqPage": true,
    "product": false
  },
  "dataNosnippetSections": []
}
```

### Step 4.2: Create `scripts/test-guide-4.ts`

Following the Guide 3 test script pattern exactly:

```typescript
/**
 * Integration test for Guide 4: Canonical Article Schema + Article Renderer
 *
 * Run with: npx tsx scripts/test-guide-4.ts
 *
 * Tests:
 * 1. Zod schema — valid doc passes, invalid fails
 * 2. Repair — fixes common LLM issues
 * 3. Validation — SOP FAIL-level checks
 * 4. Renderer — produces valid HTML with correct structure
 * 5. Cloudinary URL builder
 * 6. JSON-LD schema builder
 * 7. API endpoints (if dev server running)
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load .env from project root BEFORE importing modules that read env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

let passed = 0;
let failed = 0;

function check(name: string, result: boolean, detail?: string) {
  if (result) {
    console.log(`  PASS ${name}`);
    passed++;
  } else {
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function test() {
  // Dynamic imports AFTER env is loaded
  const { validateCanonicalDocument } = await import(
    "../src/lib/article-schema"
  );
  const { repairCanonicalDocument } = await import(
    "../src/lib/article-schema"
  );
  const { CanonicalArticleDocumentSchema } = await import(
    "../src/lib/article-schema"
  );
  const { renderArticle } = await import("../src/lib/renderer");
  const { buildCloudinaryUrl } = await import("../src/lib/renderer");
  const { buildSchemaJson } = await import("../src/lib/renderer");

  // Load sample fixture
  const fixturePath = path.resolve(
    __dirname,
    "fixtures/sample-canonical-doc.json"
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

  console.log("\n=== Guide 4 Integration Tests ===\n");

  // ─── Test 1: Zod schema validation ─────────────────────────────
  console.log("1. Zod schema validation");

  const zodResult = CanonicalArticleDocumentSchema.safeParse(fixture);
  check("Valid fixture passes Zod schema", zodResult.success);

  const invalidDoc = { ...fixture, title: "" };
  const invalidResult = CanonicalArticleDocumentSchema.safeParse(invalidDoc);
  check("Empty title fails Zod schema", !invalidResult.success);

  const noSections = { ...fixture, sections: [] };
  const noSectionsResult = CanonicalArticleDocumentSchema.safeParse(noSections);
  check("Empty sections array fails Zod schema", !noSectionsResult.success);

  // ─── Test 2: Repair pass ───────────────────────────────────────
  console.log("\n2. Repair pass");

  // Test repair of missing optional fields
  const brokenDoc = { ...fixture };
  delete (brokenDoc as Record<string, unknown>).faq;
  delete (brokenDoc as Record<string, unknown>).version;
  delete (brokenDoc as Record<string, unknown>).dataNosnippetSections;

  const repairResult = repairCanonicalDocument(brokenDoc);
  check("Repair returns repaired document", !!repairResult.repaired);
  check("Repair reports changes", repairResult.changes.length > 0, `${repairResult.changes.length} changes`);
  check("Repair notes input was invalid", !repairResult.valid);
  check("Repaired doc has faq array", Array.isArray(repairResult.repaired.faq));
  check('Repaired doc has version "1.0"', repairResult.repaired.version === "1.0");

  // Test duplicate section IDs
  const dupSections = JSON.parse(JSON.stringify(fixture));
  dupSections.sections[1].id = dupSections.sections[0].id;
  const dupResult = repairCanonicalDocument(dupSections);
  const sectionIds = dupResult.repaired.sections.map((s: { id: string }) => s.id);
  const uniqueIds = new Set(sectionIds);
  check("Duplicate section IDs get renamed", uniqueIds.size === sectionIds.length);

  // ─── Test 3: SOP validation checks ─────────────────────────────
  console.log("\n3. SOP validation checks");

  const validationResult = validateCanonicalDocument(fixture);
  check("Sample fixture passes validation", validationResult.valid, validationResult.errors.length > 0 ? validationResult.errors[0].message : undefined);

  // Test meta title length violation
  const shortMeta = { ...fixture, metaTitle: "Too Short" };
  const shortMetaResult = validateCanonicalDocument(shortMeta);
  check("Short meta title fails validation", !shortMetaResult.valid);
  check(
    "Error mentions meta title",
    shortMetaResult.errors.some((e: { path: string }) => e.path === "metaTitle")
  );

  // Test missing author credentials
  const noCredentials = {
    ...fixture,
    author: { ...fixture.author, credentials: "" },
  };
  const noCredResult = validateCanonicalDocument(noCredentials);
  check("Empty credentials fails validation", !noCredResult.valid);

  // ─── Test 4: Renderer ──────────────────────────────────────────
  console.log("\n4. Renderer");

  const renderResult = renderArticle({
    document: fixture,
    htmlOverrides: null,
    templateVersion: "1.0",
  });

  check("Renderer returns html string", typeof renderResult.html === "string" && renderResult.html.length > 0);
  check("Renderer returns metaTitle", renderResult.metaTitle === fixture.metaTitle);
  check("Renderer returns metaDescription", renderResult.metaDescription === fixture.metaDescription);
  check("Renderer returns schemaJson", typeof renderResult.schemaJson === "string" && renderResult.schemaJson.length > 0);
  check("Renderer returns wordCount > 0", renderResult.wordCount > 0, `wordCount = ${renderResult.wordCount}`);

  // HTML structure checks
  check("HTML contains <!DOCTYPE html>", renderResult.html.includes("<!DOCTYPE html>"));
  check("HTML contains <article class=\"bwc-article\">", renderResult.html.includes('<article class="bwc-article">'));
  check("HTML contains <h1", renderResult.html.includes("<h1"));
  check("HTML contains blog-hero header", renderResult.html.includes('class="blog-hero"'));
  check("HTML contains executive summary", renderResult.html.includes("bwc-executive-summary"));
  check("HTML contains Google Fonts link", renderResult.html.includes("fonts.googleapis.com"));
  check("HTML contains CSS variables", renderResult.html.includes("--bwc-gold: #bc9b5d"));
  check("HTML contains JSON-LD", renderResult.html.includes("application/ld+json"));
  check('Hero img has loading="eager"', renderResult.html.includes('loading="eager"'));
  check("HTML contains data-cad-path attributes", renderResult.html.includes("data-cad-path="));

  // ─── Test 5: Cloudinary URL builder ────────────────────────────
  console.log("\n5. Cloudinary URL builder");

  const cdnUrl = buildCloudinaryUrl("blog/test-image", { width: 800, format: "auto", quality: "auto" });
  check("Cloudinary URL contains cloud name", cdnUrl.includes("deahtb4kj") || cdnUrl.includes("res.cloudinary.com"));
  check("Cloudinary URL contains transforms", cdnUrl.includes("w_800"));
  check("Cloudinary URL contains publicId", cdnUrl.includes("blog/test-image"));

  const nullUrl = buildCloudinaryUrl(null);
  check("Null publicId returns empty string", nullUrl === "");

  // ─── Test 6: JSON-LD builder ───────────────────────────────────
  console.log("\n6. JSON-LD builder");

  const schemaOutput = buildSchemaJson(fixture);
  check("Schema contains BlogPosting", schemaOutput.includes("BlogPosting"));
  check("Schema contains FAQPage", schemaOutput.includes("FAQPage"));
  check("Schema contains headline", schemaOutput.includes(fixture.title));
  check("Schema contains author name", schemaOutput.includes(fixture.author.name));

  // ─── Test 7: API endpoints (requires dev server) ───────────────
  console.log("\n7. API endpoints");

  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  try {
    const renderRes = await fetch(`${appUrl}/api/articles/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document: fixture,
        htmlOverrides: null,
        templateVersion: "1.0",
      }),
    });
    check(
      "POST /api/articles/render responds",
      renderRes.status === 200 || renderRes.status === 401
    );

    const validateRes = await fetch(`${appUrl}/api/articles/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: fixture }),
    });
    check(
      "POST /api/articles/validate responds",
      validateRes.status === 200 || validateRes.status === 401
    );

    // Test validate with repair flag
    const repairRes = await fetch(`${appUrl}/api/articles/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: fixture, repair: true }),
    });
    check(
      "POST /api/articles/validate?repair responds",
      repairRes.status === 200 || repairRes.status === 401
    );
  } catch {
    console.log("  SKIP API tests — dev server not running");
    console.log(`       (Start with npm run dev, then re-run this test)`);
  }

  // ─── Summary ───────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

test();
```

### Phase 4 Gate

Run `npx tsx scripts/test-guide-4.ts`. All lib-level tests must pass (API tests may SKIP if dev server is not running).

---

## Phase 5: Final Validation Gates

### Gate 1: TypeScript compilation

```bash
npx tsc --noEmit
```

Must exit 0 with zero errors.

### Gate 2: Full build

```bash
npm run build
```

Must compile all routes (including the two new `/api/articles/*` routes) with zero errors.

### Gate 3: Integration tests

```bash
npx tsx scripts/test-guide-4.ts
```

All non-API tests must PASS. API tests accept 200 or 401 (no auth session in test scripts).

### Gate 4: Documentation updates

After all code is written and tests pass:

1. Run `npm run gen:api-routes` to update the generated API routes inventory
2. Update `docs/ARCHITECTURE.md` API Routes section to include the two new routes

### Gate 5: Human review

Open the rendered HTML output in a browser. Verify:
- Correct fonts (Cormorant Garamond for h1, Fraunces for h2, Nunito Sans for body)
- Correct colors (gold h1, dark-alt h2, primary body text)
- Hero image has `loading="eager"` and `fetchpriority="high"`
- Executive summary is bold
- Key facts box has cream background
- Pull quote has gold left border
- JSON-LD schema is valid (paste into Google's Rich Results Test)
- Mobile responsive at 768px breakpoint

---

## Summary of Established Patterns Followed

| Pattern | Source | Guide 4 Usage |
|---|---|---|
| Route handler: requireRole -> safeParse -> business logic -> error cascade | All 8 existing routes | render/route.ts, validate/route.ts |
| Response envelope: `{ success: true, data }` / `{ success: false, error }` | All routes | Both routes |
| Error codes: AUTH_REQUIRED (401) -> AUTH_FORBIDDEN (403) -> RENDER_ERROR (500) -> INTERNAL_ERROR (500) | src/types/api.ts + pattern-finder | render/route.ts |
| Barrel exports: named only, no defaults, `export type` for types | src/lib/onyx/index.ts | article-schema/index.ts, renderer/index.ts |
| Env access: `import { env } from "@/lib/env"` | src/lib/onyx/client.ts | renderer/cloudinary.ts |
| Import order: Framework -> Internal lib -> Types -> Third-party | All routes | All new files |
| Test script: dotenv first, dynamic imports, check() helper, 200-or-401 for API | scripts/test-guide-3.ts | scripts/test-guide-4.ts |
| Type convention: interface for objects, type for unions, no enum | src/types/article.ts | Zod schema mirrors these |
