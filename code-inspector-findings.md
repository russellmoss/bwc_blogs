# BWC Content Engine - Code Inspector Findings
## Prepared for: Guide 4 (Canonical Article Schema + Article Renderer)
## Date: 2026-03-02

---

## 1. Schema State (Prisma Models Inventory)

All 9 models fully defined in prisma/schema.prisma, matching orchestration doc section 5A.

| Model | Table | Guide 4 Relevance |
|---|---|---|
| User | users | Not directly used |
| ContentMap | content_map | FK target for ArticleDocument.articleId |
| ArticleDocument | article_documents | canonicalDoc: Json stores CanonicalArticleDocument |
| ArticleHtml | article_html | htmlContent, metaTitle, metaDescription, schemaJson map to RendererOutput |
| Photo | photos | cloudinaryPublicId, cloudinaryUrl, widthPx, heightPx for URL building |
| ArticlePhoto | article_photos | joins articles to photos |
| InternalLink | internal_links | Not used in Guide 4 |
| Lead | leads | Not used in Guide 4 |
| LeadEvent | lead_events | Not used in Guide 4 |

CRITICAL: article_html has NO wordCount column. RendererOutput.wordCount cannot be persisted at render time.
wordCount can only be stored in content_map.word_count at finalization (Guide 11).

---

## 2. Type State (TypeScript Interfaces)

### src/types/article.ts - COMPLETE (21 fields, matches orchestration doc spec exactly)

| Interface | Field Count | Key Fields |
|---|---|---|
| CanonicalArticleDocument | 21 | version, articleId, slug, articleType, hubId, title, metaTitle, metaDescription, canonicalUrl, publishDate, modifiedDate, author, executiveSummary, heroImage, sections, faq, internalLinks, externalLinks, ctaType, captureComponents, schema, dataNosnippetSections |
| AuthorInfo | 4 | name, credentials, bio, linkedinUrl |
| ArticleSection | 4 | id, heading, headingLevel (2 or 3), content: ContentNode[] |
| ParagraphNode | 3 | type: paragraph, id, text: string |
| ImageNode | 3 | type: image, id, placement: ImagePlacement |
| PullQuoteNode | 4 | type: pullQuote, id, text, attribution: string or null |
| KeyFactsNode | 4 | type: keyFacts, id, title, facts: {label,value}[] |
| TableNode | 5 | type: table, id, caption, headers: string[], rows: string[][] |
| ListNode | 4 | type: list, id, ordered: boolean, items: string[] |
| CalloutNode | 4 | type: callout, id, variant: info/tip/warning, text |
| ContentNode (union) | 7 variants | all 7 node types |
| ImagePlacement | 7 | photoId: number or null, src, alt, caption, classification, width, height |
| InternalLinkRef | 6 | targetUrl, targetArticleId, targetCorePage, anchorText, linkType, sectionId |
| ExternalLinkRef | 5 | url, anchorText, trustTier, sourceName, sectionId |
| FAQItem | 2 | question, answer |
| SchemaFlags | 3 | blogPosting: boolean, faqPage: boolean, product: boolean |
| CaptureType | 5 values | newsletter, allocation, tour, content_upgrade, waitlist |
| TrustTier | 4 values | primary, authority, niche_expert, general |
| ContentNodeType | 7 values | paragraph, image, pullQuote, keyFacts, table, list, callout |

### src/types/renderer.ts - COMPLETE

| Interface | Fields |
|---|---|
| HtmlOverride | path, html, reason (3 fields) |
| RendererInput | document: CanonicalArticleDocument, htmlOverrides: HtmlOverride[] or null, templateVersion: string |
| RendererOutput | html, metaTitle, metaDescription, schemaJson, wordCount (5 fields) |

### src/types/api.ts
ErrorCode (line 28) includes RENDER_ERROR - pre-defined for Guide 4 use.
NOTE: GenerateArticleRequest and GenerateArticleResponse are absent - these are Guide 5 types.

### src/types/photo.ts
CloudinaryTransform: width, format, quality, additionalParams - used by Guide 4 URL builder.
Photo (16 fields) matches Prisma Photo model exactly.

### src/types/index.ts - Re-exports all 9 type files

---

## 3. API Route State

### Existing Routes (post-Guide-3)

| File | Methods | Guide |
|---|---|---|
| src/app/api/health/route.ts | GET | 0 |
| src/app/api/auth/[...nextauth]/route.ts | NextAuth handler | 1 |
| src/app/api/users/route.ts | GET, POST | 1 |
| src/app/api/users/[id]/route.ts | GET, PATCH, DELETE | 1 |
| src/app/api/content-map/route.ts | GET, POST | 2 |
| src/app/api/content-map/[id]/route.ts | GET, PATCH, DELETE | 2 |
| src/app/api/content-map/import/route.ts | POST | 2 |
| src/app/api/onyx/health/route.ts | GET | 3 |
| src/app/api/onyx/search/route.ts | POST | 3 |

### Routes Guide 4 Must CREATE (confirmed absent - no src/app/api/articles/ directory)

| File | Method | Purpose |
|---|---|---|
| src/app/api/articles/render/route.ts | POST | canonical doc + htmlOverrides -> RendererOutput |
| src/app/api/articles/validate/route.ts | POST | unknown JSON -> Zod validation result |

---

## 4. Library Module State

### Existing Modules

| Module | Files | Public Exports |
|---|---|---|
| src/lib/db/ | index.ts, retry.ts | prisma (singleton), retryDatabaseOperation |
| src/lib/auth/ | password.ts, session.ts, config.ts | hashPassword, validatePassword, requireRole, requireAuth, getCurrentUser |
| src/lib/env.ts | single file | env const with all env vars (CLOUDINARY_CLOUD_NAME available) |
| src/lib/cloudinary/ | client.ts only | cloudinaryConfig - NO URL builder function |
| src/lib/claude/ | client.ts only | claudeConfig - no API client (Guide 5 scope) |
| src/lib/content-map/ | slug.ts, import.ts, index.ts | parseCSV, mapCSVRow, importToDatabase, generateSlug, ensureUniqueSlug |
| src/lib/onyx/ | 5 files | searchOnyx, searchOnyxSafe, searchOnyxMulti, buildSearchQueries, assembleOnyxContext, checkOnyxHealth |

### Modules Guide 4 Must CREATE (confirmed absent)

| Path | Status |
|---|---|
| src/lib/renderer/ (directory + all files) | MISSING |
| src/lib/renderer/compiled-template.ts | MISSING |
| src/lib/article-schema/ (directory + all files) | MISSING |

---

## 5. Component State

No files in src/components/ at all. Expected - Guide 4 owns no UI components. Components start in Guide 6.

---

## 6. External Service Config State

Cloudinary:
  src/lib/cloudinary/client.ts exports cloudinaryConfig (url, cloudName, uploadPreset)
  GAP: No buildCloudinaryUrl() function exists anywhere in the codebase
  URL formula: https://res.cloudinary.com/{cloudName}/image/upload/{transforms}/{publicId}
  env.CLOUDINARY_CLOUD_NAME available in src/lib/env.ts
  Env vars in .env.example but NOT in env.ts: CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_UPLOAD_FOLDER, CLOUDINARY_SECURE_DELIVERY
  (Not needed for URL building - only CLOUDINARY_CLOUD_NAME is required)

Database: prisma at src/lib/db/index.ts, retry at src/lib/db/retry.ts
Auth: requireRole() at src/lib/auth/session.ts
Onyx: full client at src/lib/onyx/ (Guide 3 complete)
Claude: config only at src/lib/claude/client.ts (no SDK - Guide 5 scope)

Installed packages relevant to Guide 4:
  zod ^4.3.6 (ZOD V4 - API differs from v3, verify discriminatedUnion against v4 docs)
  @prisma/client ^6.19.2
  No @anthropic-ai/sdk installed (Guide 4 makes no Claude API calls)

---

## 7. Gap Analysis vs. Orchestration Doc

### Files Guide 4 Must Create - All Missing

| File | Status |
|---|---|
| src/app/api/articles/render/route.ts | MISSING |
| src/app/api/articles/validate/route.ts | MISSING |
| src/lib/renderer/ (directory + all files) | MISSING |
| src/lib/renderer/compiled-template.ts | MISSING |
| src/lib/article-schema/ (directory + all files) | MISSING |
| scripts/test-guide-4.ts | MISSING |
| Sample canonical document fixture | MISSING |

### Dependencies Guide 4 Imports - All Present

| Import | Source | Status |
|---|---|---|
| CanonicalArticleDocument + all sub-types | src/types/article.ts | PRESENT |
| RendererInput, RendererOutput, HtmlOverride | src/types/renderer.ts | PRESENT |
| Photo, CloudinaryTransform | src/types/photo.ts | PRESENT |
| prisma | src/lib/db/index.ts | PRESENT |
| requireRole | src/lib/auth/session.ts | PRESENT |
| env.CLOUDINARY_CLOUD_NAME | src/lib/env.ts | PRESENT |
| ErrorCode RENDER_ERROR | src/types/api.ts line 28 | PRESENT |

### Broken Imports Scan
Grep for article-schema, lib/renderer, articles/render, articles/validate across all src/: ZERO MATCHES.
No existing code forward-references Guide 4 modules. Clean slate.

---

## 8. Type Mismatch Analysis

All Prisma @map() annotations align with TypeScript interface fields. No mismatches found.

Photo model to Photo interface (relevant for Cloudinary URL building):
| Prisma Field | DB Column | TS Type | Match |
|---|---|---|---|
| cloudinaryPublicId | cloudinary_public_id | string or null | YES |
| cloudinaryUrl | cloudinary_url | string or null | YES |
| widthPx | width_px | number or null | YES |
| heightPx | height_px | number or null | YES |

ArticleDocument model: No direct TS interface.
canonicalDoc Json field passes through Zod parse to become CanonicalArticleDocument at runtime.

---

## 9. Established Patterns Guide 4 Must Follow

Route handler pattern (from src/app/api/content-map/route.ts and onyx routes):
  Import requireRole from @/lib/auth/session
  await requireRole(admin, editor) first in try block
  Schema.safeParse(body), return 400 with parsed.error.flatten() on failure
  return NextResponse.json({ success: true, data: result }) on success
  catch block: AUTH_REQUIRED -> 401, AUTH_FORBIDDEN -> 403, else 500 with RENDER_ERROR code

TypeScript path aliases: @/ maps to src/. Use @/types, @/lib/db, @/lib/auth/session, @/lib/env.
Response shape: { success: true, data: X } or { success: false, error: { code, message, details? } }

---

## 10. Recommendations for Guide 4 Build Order

1. src/lib/article-schema/index.ts
   Zod v4 schema for CanonicalArticleDocument. Export validateCanonicalDocument(input: unknown).
   Include repair helpers for partial Claude outputs (faq defaults to [], sections to []).

2. src/lib/renderer/cloudinary.ts
   buildCloudinaryUrl(publicId: string or null, transforms?: CloudinaryTransform): string
   Null publicId returns empty string. Use env.CLOUDINARY_CLOUD_NAME from src/lib/env.ts.
   URL pattern: https://res.cloudinary.com/{cloudName}/image/upload/{transforms}/{publicId}

3. src/lib/renderer/json-ld.ts
   buildSchemaJson(doc: CanonicalArticleDocument): string
   Generate BlogPosting, FAQPage, Product JSON-LD based on doc.schema flags.

4. src/lib/renderer/compiled-template.ts
   Embedded BEM stylesheet (.bwc- prefix from BWC brand style guide) + HTML templates for all 7 ContentNode types.

5. src/lib/renderer/index.ts
   renderArticle(input: RendererInput): RendererOutput
   Dispatch on ContentNode.type, apply htmlOverrides, embed JSON-LD, count words.

6. src/app/api/articles/render/route.ts
   POST: accept { document, htmlOverrides, templateVersion }, call renderArticle(), return RendererOutput.

7. src/app/api/articles/validate/route.ts
   POST: accept { document } as unknown, call validateCanonicalDocument(), return validation result.

8. Sample canonical document fixture (JSON file in scripts/ or __fixtures__/).

9. scripts/test-guide-4.ts - Integration tests for both routes with the sample fixture.

### Key Implementation Constraints
  wordCount: article_html has no wordCount column. RendererOutput.wordCount is ephemeral at render time.
    Store in content_map.word_count at finalization (Guide 11).
  ImagePlacement.photoId === null: use src field directly, skip Cloudinary URL building.
  htmlOverrides is nullable (Json?): treat null as empty array in renderer.
  requireRole(admin, editor) for both render and validate routes.
  Zod v4 (^4.3.6): verify all schema APIs against v4 docs.
  BEM prefix for blog HTML output: .bwc-


---

## 11. Zod v4 API Verification (Confirmed by Direct Runtime Testing)

Version: 4.3.6 (package.json: "zod": "^4.3.6")
Entry point for Next.js: import { z } from "zod" resolves to index.cjs (CJS-compatible)

Confirmed working in v4.3.6:
- z.object(), z.string(), z.number(), z.boolean(), z.literal(), z.enum() — all work
- z.discriminatedUnion("type", [...]) — CONFIRMED WORKING for ContentNode union
- z.nullable(), z.optional() — work as in v3
- z.record(), z.union(), z.array() — work as in v3
- .safeParse(), .parse(), .parseAsync() — work as in v3
- .refine(), .superRefine(), .transform() — work as in v3
- error.flatten() — returns { fieldErrors, formErrors } — SAME API as v3
- error.issues — array with { code, path, message } — SAME shape as v3
- instanceof z.ZodError — WORKS

KEY BREAKING CHANGE from v3 to v4:
  Error message format changed:
  v3: "Expected string, received number"
  v4: "Invalid input: expected string, received number"
  Do NOT hardcode expected error message strings in tests or repair logic.
  issue.code for type errors is still "invalid_type" (unchanged from v3).

z.infer<T> is TypeScript compile-time only.
  At runtime, z has no "infer" export. Use only as TS type annotation:
  type CanonicalDoc = z.infer<typeof CanonicalArticleDocumentSchema>

---

## 12. Additional Type Observations

### CanonicalArticleDocument field count
src/types/article.ts defines 22 top-level fields (not 21):
version, articleId, slug, articleType, hubId, title, metaTitle, metaDescription,
canonicalUrl, publishDate, modifiedDate, author, executiveSummary, heroImage,
sections, faq, internalLinks, externalLinks, ctaType, captureComponents, schema, dataNosnippetSections

### Photo interface missing createdAt
Prisma Photo model has createdAt DateTime. TypeScript Photo interface has 16 fields, omitting createdAt.
Not blocking for Guide 4. Renderer reads cloudinaryUrl, widthPx, heightPx — all present.

### ValidationResult type not defined
Orchestration doc references ValidationResult in GenerateArticleResponse (Guide 5 type).
This type does NOT exist in src/types/api.ts or any types file.
Guide 4 must define the return type for src/app/api/articles/validate/route.ts.
Suggested definition to add to src/types/api.ts:
  export interface ValidationResult {
    valid: boolean
    errors: { path: string; message: string }[]
    warnings: string[]
  }

### ImagePlacement loading attribute strategy
loading attribute ("eager" for hero, "lazy" for others) is NOT in ImagePlacement type.
The renderer must derive it from context: heroImage position vs. inline ImageNode.
This is correct by design per architecture doc lines 1606-1607.

---

## 13. Scripts Directory State

Existing test scripts (Guide 4 must follow same tsx pattern):
  scripts/test-guide-1.ts
  scripts/test-guide-2.ts
  scripts/test-guide-3.ts

Missing: scripts/test-guide-4.ts (Guide 4 must create)
Run pattern: npx tsx scripts/test-guide-4.ts

---

## 14. Summary Table

| Check | Finding |
|---|---|
| src/lib/article-schema/ exists | NO — create from scratch |
| src/lib/renderer/ exists | NO — create from scratch |
| src/app/api/articles/ exists | NO — create from scratch |
| scripts/test-guide-4.ts exists | NO — create |
| All required types in src/types/ | YES — complete |
| All Guide 4 imports available | YES — no missing dependencies |
| Zod version | v4.3.6 — discriminatedUnion confirmed working |
| CLOUDINARY_CLOUD_NAME in env.ts | YES — line 19 |
| Broken imports to Guide 4 targets | NONE |
| Photo.createdAt TS/Prisma mismatch | Minor gap — not blocking |
| ValidationResult type defined | NO — Guide 4 must add to src/types/api.ts |
| article_html.wordCount column | DOES NOT EXIST — wordCount is ephemeral, not DB-persisted at render time |
