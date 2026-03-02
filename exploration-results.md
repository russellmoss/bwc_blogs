# Exploration Results — Guide 4: Canonical Article Schema + Article Renderer

**Date:** 2026-03-02
**Prepared by:** 3-agent exploration team (code-inspector, integration-verifier, pattern-finder)
**Source files:** code-inspector-findings.md, integration-verifier-findings.md, pattern-finder-findings.md

---

## 1. Current Build State

**Guides complete:** 1 (Foundation), 2 (Content Map), 3 (Onyx RAG Integration)

**Inventory:**
| Category | Count | Details |
|---|---|---|
| Prisma models | 9 | User, ContentMap, ArticleDocument, ArticleHtml, Photo, ArticlePhoto, InternalLink, Lead, LeadEvent |
| Database rows | 50 total | users=1, content_map=39, internal_links=10, all others=0 |
| API routes | 9 | health, auth, users (2), content-map (3), onyx (2) |
| Type files | 9 | article, api, auth, claude, content-map, onyx, photo, renderer, qa |
| Lib modules | 6 | db, auth, env, cloudinary (stub), claude (stub), onyx, content-map |
| Components | 0 | Expected — UI starts in Guide 6 |

**Integration health:**
| Service | Status | Notes |
|---|---|---|
| Neon Postgres | OK | Pooled connection working, all 9 tables exist |
| Onyx RAG | OK | Health 200 (125ms), search returns KB documents |
| Claude API | OK | Completions, web_search tool, streaming verified |
| Cloudinary | OK | API creds valid, CDN delivery with transforms working |
| Local build | OK | Zero TS errors, all 12 routes compile |
| Vercel deployment | STALE | /api/health works but Guide 2-3 routes return 404 — needs push |

---

## 2. Next Guide Target

**Guide 4: Canonical Article Schema + Article Renderer** — marked CRITICAL in orchestration doc.

**What the orchestration doc says it must produce:**
- `src/lib/article-schema/` — Zod schemas for CanonicalArticleDocument, validation functions, repair pass logic
- `src/lib/renderer/` — Renderer pipeline, component templates, CSS embedding, JSON-LD builder, Cloudinary URL builder
- `src/lib/renderer/compiled-template.ts` — Embedded Compiled Template components + stylesheet
- `src/app/api/articles/render/route.ts` — POST (canonical doc + overrides -> rendered HTML)
- `src/app/api/articles/validate/route.ts` — POST (unknown JSON -> validation result)
- Sample canonical document fixture for testing
- `scripts/test-guide-4.ts`

**Relevant architecture doc sections:**
- Section 3D step 5 — Validation pipeline (schema validation, repair pass, link checks, source flagging)
- Section 3D step 6 — Article Renderer pipeline (component selection, Cloudinary URLs, JSON-LD, override application)
- Section 3E — Canonical Article Document schema (full JSON example with all node types)
- Section 3F — Compiled Template structure (dual-purpose: Claude reference + renderer consumption)
- Section 3E rendered output example — Expected HTML output format with BEM classes

**File ownership (orchestration doc section 5E):** Guide 4 owns `src/app/api/articles/render/`, `src/app/api/articles/validate/`, `src/lib/renderer/`, `src/lib/article-schema/`

---

## 3. Dependencies Satisfied

### TypeScript Types — ALL PRESENT

| Type | File | Fields | Status |
|---|---|---|---|
| CanonicalArticleDocument | src/types/article.ts | 22 fields (version through dataNosnippetSections) | PRESENT — matches spec exactly |
| ArticleSection | src/types/article.ts | id, heading, headingLevel (2\|3), content: ContentNode[] | PRESENT |
| ContentNode (union) | src/types/article.ts | 7 variants: paragraph, image, pullQuote, keyFacts, table, list, callout | PRESENT |
| ImagePlacement | src/types/article.ts | photoId (nullable), src, alt, caption, classification, width, height | PRESENT |
| AuthorInfo | src/types/article.ts | name, credentials, bio, linkedinUrl | PRESENT |
| FAQItem | src/types/article.ts | question, answer | PRESENT |
| InternalLinkRef | src/types/article.ts | targetUrl, targetArticleId, targetCorePage, anchorText, linkType, sectionId | PRESENT |
| ExternalLinkRef | src/types/article.ts | url, anchorText, trustTier, sourceName, sectionId | PRESENT |
| SchemaFlags | src/types/article.ts | blogPosting, faqPage, product (all boolean) | PRESENT |
| RendererInput | src/types/renderer.ts | document, htmlOverrides (nullable), templateVersion | PRESENT |
| RendererOutput | src/types/renderer.ts | html, metaTitle, metaDescription, schemaJson, wordCount | PRESENT |
| HtmlOverride | src/types/renderer.ts | path, html, reason | PRESENT |
| CloudinaryTransform | src/types/photo.ts | width, format, quality, additionalParams | PRESENT |
| Photo | src/types/photo.ts | 16 fields matching Prisma model | PRESENT |
| ErrorCode | src/types/api.ts | Includes RENDER_ERROR (line 28) | PRESENT |

### Library Modules — ALL PRESENT

| Module | Import Path | Status |
|---|---|---|
| Prisma singleton | `@/lib/db` | PRESENT |
| requireRole | `@/lib/auth/session` | PRESENT |
| env (CLOUDINARY_CLOUD_NAME) | `@/lib/env` | PRESENT |

### Database Tables — ALL PRESENT

| Table | Rows | Guide 4 Usage |
|---|---|---|
| article_documents | 0 | Schema target — Guide 4 validates docs that will be stored here by Guide 11 |
| article_html | 0 | Renderer output shape maps to this table's columns |
| photos | 0 | Renderer reads cloudinary_public_id for URL construction (no rows yet — correct) |
| content_map | 39 | FK target for articleId field |

### External Services — ALL VERIFIED

| Service | Status | Guide 4 Needs |
|---|---|---|
| Cloudinary CDN | OK | URL construction only (no uploads) — cloud name `deahtb4kj` |
| Neon Postgres | OK | No direct DB calls from renderer (pure function) |

---

## 4. Dependencies Missing or Mismatched

### Files Guide 4 Must Create (ALL confirmed absent)

| File | Status |
|---|---|
| src/lib/article-schema/ (entire directory) | MISSING |
| src/lib/renderer/ (entire directory) | MISSING |
| src/app/api/articles/ (entire directory) | MISSING |
| scripts/test-guide-4.ts | MISSING |

### Gaps and Constraints

1. **No buildCloudinaryUrl() exists anywhere** — Guide 4 must create this in `src/lib/renderer/cloudinary.ts`. URL pattern: `https://res.cloudinary.com/{cloudName}/image/upload/{transforms}/{publicId}`. Use `env.CLOUDINARY_CLOUD_NAME` from `@/lib/env`.

2. **article_html has NO wordCount column** — `RendererOutput.wordCount` is ephemeral (computed at render time but not persisted in `article_html`). Guide 11 stores word count in `content_map.word_count` at finalization. Guide 4's renderer computes and returns it but doesn't need to persist it.

3. **ImagePlacement.photoId can be null** — When null, the renderer should use the `src` field directly (external URL). When non-null, construct a Cloudinary URL from the photo's `cloudinaryPublicId`. Since `photos` table has 0 rows, all test fixtures should use `photoId: null` with direct `src` URLs, or use `photoId` with mock `cloudinaryPublicId` values.

4. **htmlOverrides is `Json?` (nullable) in Prisma** — Renderer must treat `null` as empty array.

5. **Zod version is v4 (^4.3.6)** — API differs from v3. Key differences: `z.discriminatedUnion()` API, error formatting methods, `z.infer<>` usage. Guide must verify all Zod APIs against v4 docs.

6. **BWC Brand Style Guide and Master SOP are now in the repo** — Available at `docs/Bhutan Wine Company — Brand Style Guide for HTML Blog Posts (3).md` and `docs/BWC Master Content Engine SOP.md`. Full CSS variables, font stacks, BEM classes, component patterns, and FAIL-level QA checks have been extracted into Appendices C and D of this document. The Compiled Template (`src/lib/renderer/compiled-template.ts`) must embed these CSS/component patterns exactly.

7. **No broken imports** — Zero existing files reference Guide 4 modules. Clean integration surface.

8. **`ValidationResult` type not defined** — The orchestration doc references it but it does NOT exist in `src/types/`. Guide 4 must define and export it from `src/types/api.ts`:
```typescript
export interface ValidationResult {
  valid: boolean;
  errors: { path: string; message: string }[];
  warnings: string[];
}
```

9. **`ImagePlacement.loading` not in type** — The `loading` attribute (`"eager"` for hero, `"lazy"` for others) is NOT in the `ImagePlacement` interface. The renderer must derive it from context (hero position vs inline). This is correct by design.

10. **Zod v4 discriminatedUnion confirmed working** — Runtime tested: `z.discriminatedUnion("type", [...])` works for ContentNode union. `error.flatten()` returns `{ fieldErrors, formErrors }` same as v3. BREAKING: error messages changed to `"Invalid input: expected X, received Y"` — do not hardcode message strings in tests.

---

## 5. Established Patterns to Follow

### API Route Handler Template (HIGH consistency — all 8 business routes identical)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const InputSchema = z.object({
  field: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");  // ALWAYS FIRST

    const body = await request.json();
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    // business logic using parsed.data
    return NextResponse.json({ success: true, data: result });
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
    // Guide 4: add RENDER_ERROR before INTERNAL_ERROR
    if (message === "RENDER_ERROR") {
      return NextResponse.json(
        { success: false, error: { code: "RENDER_ERROR", message: "Article rendering failed" } },
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

### Error Handling Pattern
- `throw new Error("RENDER_ERROR")` from lib modules — plain Error, code as message string
- No custom error classes anywhere in codebase
- Catch block: AUTH_REQUIRED (401) -> AUTH_FORBIDDEN (403) -> service-specific -> INTERNAL_ERROR (500)

### Zod Validation Pattern
- Schemas co-located at top of route.ts files (for route input validation)
- PascalCase naming: `RenderRequestSchema`, `ValidateRequestSchema`
- Always `.safeParse()`, never `.parse()`
- Failure: `parsed.error.flatten()` in response details
- Guide 4 exception: `src/lib/article-schema/` is the first lib-owned Zod module (for document validation separate from route input)

### Lib Module Structure (from src/lib/onyx/ — most mature example)
```
src/lib/<domain>/
  index.ts         — barrel re-exports (named only, no defaults)
  <concern>.ts     — separate files per concern
```
Barrel pattern:
```typescript
export { functionA, functionB } from './file-a';
export type { TypeA } from './file-a';
export { functionC } from './file-b';
```

### Import Conventions
```typescript
// 1. Framework
import { NextRequest, NextResponse } from "next/server";
// 2. Internal lib
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { env } from "@/lib/env";
// 3. Types (type-only imports)
import type { RendererInput, RendererOutput } from "@/types/renderer";
// 4. Third-party
import { z } from "zod";
```
Path alias: `@/` maps to `src/`. No other aliases.

### Type Convention
- `interface` for object shapes, `type` for unions/aliases
- No `enum` keyword — string literal unions only
- Discriminated unions: each member `extends` a base interface with narrow literal `type` field

### BEM & CSS Standards for Rendered HTML (from Brand Style Guide)

**CSS Variables** — Must be embedded in `compiled-template.ts` `<style>` block:
```css
:root {
  --bwc-gold: #bc9b5d;  --bwc-black: #000000;  --bwc-white: #ffffff;
  --bwc-text-primary: #000000;  --bwc-text-secondary: #414141;
  --bwc-text-dark-alt: #242323;  --bwc-text-footer: #292929;  --bwc-text-brown: #624c40;
  --bwc-bg-cream: #fcf8ed;  --bwc-bg-peach: #f6ebe4;  --bwc-bg-light: #f7f7f7;
  --bwc-bg-soft-gray: #e8e6e6;  --bwc-bg-blue: #c8eef5;  --bwc-bg-green: #316142;
  --bwc-border-light: #cccccc;
  --space-xs: 8px;  --space-sm: 16px;  --space-md: 24px;
  --space-lg: 48px;  --space-xl: 80px;  --space-2xl: 120px;
}
```

**Font Stack** (Google Fonts: Cormorant Garamond, Fraunces, Nunito Sans, Trirong):
| Element | Font | Size | Weight | Color |
|---|---|---|---|---|
| h1 (article title) | Cormorant Garamond | 48px | 600 | `--bwc-gold` |
| h2 (sections) | Fraunces | 36px | 400 | `--bwc-text-dark-alt` |
| h3 (subsections) | Cormorant Garamond | 28px | 600 | `--bwc-text-primary` |
| p, li (body) | Nunito Sans | 16px | 300 | `--bwc-text-primary` |
| blockquote | Cormorant Garamond | 24px | 300 | `--bwc-text-brown` |
| figcaption | Trirong | 13px | 400 | `--bwc-text-secondary` |
| .lead/.intro | Fraunces | 21px | 400 | `--bwc-text-secondary` |
| links | inherit | inherit | inherit | `--bwc-gold`, underline |

**Mobile breakpoint** (768px): h1->38px, h2->30px, h3->24px, body stays 16px

**Layout**: max-width 980px, prose target 680-760px, centered with auto margins

**BEM Class Prefix**: `bwc-` for all blog output classes (e.g., `bwc-article`, `bwc-hero-image`, `bwc-pullquote`, `bwc-key-facts`, `bwc-executive-summary`, `bwc-figure`)

**Component HTML Patterns** (from Brand Style Guide §17-18):
- Hero: `<header class="blog-hero">` with `.eyebrow`, `h1`, `.lead`, `.meta` + `<time>`
- Figure: `<figure>` + `<img>` + `<figcaption>` (no borders/shadows)
- Pull quote: `<blockquote>` with gold left border (`3px solid var(--bwc-gold)`)
- Key facts: `<aside class="bwc-key-facts">` + `<dl>` (definition list)
- Body links: `color: var(--bwc-gold)`, underline, 1px thickness, 0.14em offset

### Test Script Pattern (follow Guide 3)
```typescript
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });  // FIRST

let passed = 0;
let failed = 0;

function check(name: string, result: boolean, detail?: string) {
  if (result) { console.log(`  PASS ${name}`); passed++; }
  else { console.log(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`); failed++; }
}

async function test() {
  // Dynamic imports AFTER env is loaded
  const { validateCanonicalDocument } = await import("../src/lib/article-schema");
  const { renderArticle } = await import("../src/lib/renderer");

  // Tests here...

  // API tests accept 200 or 401 (no auth sessions)
  // Graceful handling when dev server not running

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

test();
```

---

## 6. Integration Readiness

| Service | Guide 4 Usage | Status | Notes |
|---|---|---|---|
| Cloudinary CDN | URL construction (no uploads) | OK | Cloud name: `deahtb4kj`. URL pattern: `https://res.cloudinary.com/deahtb4kj/image/upload/{transforms}/{publicId}` |
| Neon Postgres | None (renderer is pure function) | OK | Available if needed for testing, but Guide 4 makes no DB calls |
| Onyx RAG | None | OK | Not used by Guide 4 |
| Claude API | None | OK | Not used by Guide 4 (Guide 5 scope) |

**Known quirks:**
- Cloudinary CDN transforms confirmed working: `w_800,f_auto,q_auto` applied successfully in test
- Photos table is empty — renderer must handle missing photo data gracefully (use `src` field from ImagePlacement when `photoId` is null)
- Prisma EPERM warning on Windows during `prisma generate` (DLL file lock) — non-blocking, client works fine

---

## 7. Risks and Blockers

### BLOCKER: None

### MEDIUM RISK
1. **Vercel deployment is stale** — Latest code (Guides 2-3) not pushed. `/api/content-map` and `/api/onyx/health` return 404 on deployed site. Action: push to Vercel before Guide 4 review/demo.

### LOW RISK
2. **Zod v4 API differences** — Codebase uses Zod ^4.3.6. Guide 4 creates the first complex nested Zod schema (CanonicalArticleDocument with discriminated unions). Must verify `z.discriminatedUnion()` and nested object APIs against Zod v4 docs, not v3.

3. **Prisma deprecation warning** — `package.json#prisma` config deprecated in Prisma 7. Non-blocking for Guide 4.

4. **Model alias inconsistency** — `.env` uses short alias `claude-sonnet-4-5` vs `.env.example` full `claude-sonnet-4-5-20250929`. Not relevant to Guide 4 (no Claude API calls).

### RESOLVED (previously Risk 3)
- ~~Compiled Template not in repo~~ — Brand Style Guide and SOP now available at `docs/Bhutan Wine Company — Brand Style Guide for HTML Blog Posts (3).md` and `docs/BWC Master Content Engine SOP.md`. Full CSS variables, font stacks, BEM classes, component patterns, and FAIL-level QA checks extracted. See Appendices C and D.

---

## 8. Deviations from Plan

### Deviation 1: CaptureType uses string literal union (not enum)
The orchestration doc section 5B shows `ctaType: CaptureType` and `captureComponents: CaptureType[]`. The actual `src/types/article.ts` implements `CaptureType` as `"newsletter" | "allocation" | "tour" | "content_upgrade" | "waitlist"` — a string literal union, not an enum. This is consistent with the codebase convention (no `enum` keyword). The Zod schema must use `z.enum(["newsletter", "allocation", "tour", "content_upgrade", "waitlist"])`.

### Deviation 2: InternalLinkRef has more fields than spec
Orchestration doc section 5B shows `{ targetUrl, anchorText, context }`. Actual `src/types/article.ts` has `{ targetUrl, targetArticleId, targetCorePage, anchorText, linkType, sectionId }` — 6 fields vs 3. The Zod schema must match the ACTUAL type, not the abbreviated spec.

### Deviation 3: ExternalLinkRef has different field names than spec
Orchestration doc shows `{ url, anchorText, trustTier, newSource }`. Actual type has `{ url, anchorText, trustTier, sourceName, sectionId }` — `newSource` boolean is absent, `sourceName` and `sectionId` are added. The Zod schema must match the ACTUAL type.

### Deviation 4: ContentNode variants have `id` field not shown in spec
The orchestration doc's abbreviated schema shows content nodes without `id` fields, but the actual `src/types/article.ts` has every ContentNode extending `ContentNodeBase { type, id }`. The Zod schema must include `id: z.string()` on every content node.

### Deviation 5: No `newSource` field on ExternalLinkRef
The architecture doc section 3E example JSON shows `"newSource": false` on external links, but the actual TypeScript type in `src/types/article.ts` does NOT have a `newSource` field. The Zod schema should match the actual TypeScript type. If `newSource` is needed, it must be added to the TypeScript interface first (which is Guide 4's prerogative since it owns schema validation).

### Deviation 6: Cloudinary stubs use process.env directly
`src/lib/cloudinary/client.ts` and `src/lib/claude/client.ts` use `process.env.*` directly instead of `import { env } from "@/lib/env"`. These are placeholder stubs. Guide 4 must use the `env.*` pattern consistently.

---

## Appendix A: Guide 4 Recommended File Structure

```
src/lib/article-schema/
  index.ts                    — barrel: exports validate, repair functions + types
  schema.ts                   — Zod v4 schema for CanonicalArticleDocument + all sub-schemas
  validate.ts                 — validateCanonicalDocument(doc: unknown) -> ValidationResult
  repair.ts                   — repairCanonicalDocument(doc: unknown) -> { repaired, changes[] }

src/lib/renderer/
  index.ts                    — barrel: exports renderArticle + sub-utilities
  renderer.ts                 — renderArticle(input: RendererInput) -> RendererOutput (pure function)
  components.ts               — HTML template functions per ContentNode type
  css.ts                      — Embedded BEM stylesheet (bwc- prefix, CSS variables)
  jsonld.ts                   — buildSchemaJson(doc) -> JSON-LD string
  cloudinary.ts               — buildCloudinaryUrl(publicId, transforms?) -> URL string
  compiled-template.ts        — Full embedded Compiled Template (CSS + component patterns)

src/app/api/articles/
  render/route.ts             — POST: RendererInput -> RendererOutput
  validate/route.ts           — POST: unknown JSON -> validation result

scripts/
  test-guide-4.ts             — Integration tests
  fixtures/
    sample-canonical-doc.json — Minimal valid CanonicalArticleDocument for testing
```

## Appendix B: Repair Pass Logic Specification

The repair pass (`src/lib/article-schema/repair.ts`) handles common Claude model output issues:

### Repairs to Implement
1. **Missing optional arrays** — If `faq`, `internalLinks`, `externalLinks`, `captureComponents`, or `dataNosnippetSections` are missing, default to `[]`
2. **Missing optional fields** — If `heroImage` is missing, default to `null`; if `hubId` is missing, default to `null`
3. **Duplicate section IDs** — If multiple sections share the same `id`, append `-2`, `-3`, etc.
4. **Missing content node IDs** — If content nodes lack `id` fields, auto-generate from section ID + index (e.g., `"section-1-node-0"`)
5. **Malformed link objects** — If InternalLinkRef or ExternalLinkRef are missing required fields, fill defaults or remove the entry
6. **Schema flags missing** — Default `schema.blogPosting` to `true`, `schema.faqPage` to `faq.length > 0`, `schema.product` to `false`
7. **Version missing** — Default to `"1.0"`
8. **headingLevel out of range** — Clamp to 2 or 3

### Repair Function Signature
```typescript
export function repairCanonicalDocument(doc: unknown): {
  repaired: CanonicalArticleDocument;
  changes: string[];  // Human-readable list of what was repaired
  valid: boolean;     // Whether doc was valid BEFORE repairs
}
```

### Important: Repair Before Validate
The validate route should offer both:
1. **Strict validation** — `validateCanonicalDocument(doc)` returns pass/fail with no repair
2. **Repair + validate** — `repairCanonicalDocument(doc)` applies fixes then validates the result

The render route should auto-repair before rendering (repair is cheap, rendering a broken doc is expensive).

---

## Appendix C: FAIL-Level QA Checks from SOP (for Zod Schema Validation)

These are deterministic checks extracted from the SOP (§2, §3, §8, §9, §12) that MUST be enforced in `src/lib/article-schema/validate.ts`. Each maps to a specific field in the CanonicalArticleDocument.

### Structure FAIL Checks
| Check | Field(s) | Rule | Source |
|---|---|---|---|
| Single H1 | `title` | Must be present and non-empty (renderer produces exactly one `<h1>` from `title`) | SOP §3 |
| Heading hierarchy | `sections[].headingLevel` | Only 2 or 3 allowed. H3 must not appear without a preceding H2. No H4-H6. | SOP §3 |
| Executive summary present | `executiveSummary` | Must be non-empty string | SOP §2 |
| Executive summary length | `executiveSummary` | 25-40 words | SOP §2 |
| Meta title length | `metaTitle` | 50-60 characters | SOP §2 |
| Meta description length | `metaDescription` | 150-160 characters | SOP §2 |
| H2 count by type | `sections[]` where `headingLevel === 2` | Hub: 5-8, Spoke: 3-5, News: 2-3 | SOP §3 |

### Volume FAIL Checks (computed from rendered content)
| Check | Computed From | Rule | Source |
|---|---|---|---|
| Word count minimum | All text content | Hub >= 2500, Spoke >= 1200, News >= 600 | SOP §3 |
| Internal link minimum | `internalLinks[]` | Hub >= 8, Spoke >= 5, News >= 3 | SOP §6 |
| External link minimum | `externalLinks[]` | Hub >= 5, Spoke >= 3, News >= 2 | SOP §7 |
| Core page links | `internalLinks[].targetCorePage` | At least 3 links to BWC core pages | SOP §6 |

### Image & Accessibility FAIL Checks
| Check | Field(s) | Rule | Source |
|---|---|---|---|
| Hero image loading | `heroImage` | Renderer must set `loading="eager"` + `fetchpriority="high"` | SOP §12 |
| All other images | `sections[].content[type=image]` | Renderer must set `loading="lazy"` | SOP §12 |
| Informative alt text | `ImagePlacement` where `classification !== "decorative"` | `alt` must be 10-25 words, non-empty | SOP §8 |
| Decorative alt empty | `ImagePlacement` where `classification === "decorative"` | `alt` must be `""` | SOP §8 |
| Image dimensions | All `ImagePlacement` | `width` and `height` must be present | SOP §12 |

### Schema & Metadata FAIL Checks
| Check | Field(s) | Rule | Source |
|---|---|---|---|
| BlogPosting schema | `schema.blogPosting` | Must be `true` on every article | SOP §9 |
| FAQPage schema sync | `schema.faqPage`, `faq[]` | `faqPage` must be `true` if and only if `faq.length > 0` | SOP §9 |
| Author present | `author` | `name` and `credentials` must be non-empty | SOP §5 |
| Dates present | `publishDate`, `modifiedDate` | Must be valid ISO 8601 dates | SOP §5 |
| Canonical URL | `canonicalUrl` | Must start with `https://www.bhutanwine.com/` | SOP §2 |

### Link Quality FAIL Checks (WARN level — surfaced but don't block)
| Check | Field(s) | Rule | Source |
|---|---|---|---|
| No generic anchors | `internalLinks[].anchorText` | Must not be "click here", "read more", "learn more" | SOP §6 |
| Anchor text length | `internalLinks[].anchorText` | 3-8 words | SOP §6 |
| Hub links to all spokes | Context-dependent | Hub must link to all published spokes in cluster | SOP §6 |
| Spoke links to hub | `internalLinks[]` | Must include at least one link to parent hub | SOP §6 |
| External link distribution | `externalLinks[].sectionId` | Links should span multiple sections, not cluster in one | SOP §7 |

---

## Appendix D: Compiled Template Specification (from Brand Style Guide)

The `src/lib/renderer/compiled-template.ts` must embed the following. This is the authoritative specification from the Brand Style Guide (§3-6, §13, §17-18).

### Google Fonts Import (embed in rendered HTML `<head>`)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Nunito+Sans:wght@300;400;700&family=Trirong&display=swap" rel="stylesheet">
```

### Complete CSS (embed in `<style>` block)
Source: Brand Style Guide §3 (CSS Variables), §6 (Blog Post Typography Mapping), §7 (Layout & Spacing), §13 (Mobile), §14 (Links)

**Required CSS sections:**
1. `:root` variables (colors + spacing scale from §3 and §7)
2. `article h1` through `article h4` (§6 — exact font, size, weight, color, margin)
3. `article p, article li` (§6 — Nunito Sans 16px/1.7 weight 300)
4. `article ul, article ol` (§6 — margin/padding)
5. `article blockquote` (§6 — Cormorant Garamond, gold border-left, italic)
6. `article a` and `article a:hover` (§6, §14 — gold, underline, opacity transition)
7. `article figure`, `article img`, `article figcaption` (§6)
8. `article .lead, article .intro` (§6 — Fraunces 21px)
9. `article .meta, article .eyebrow, article .last-updated` (§6 — Nunito Sans 14px)
10. `.bwc-key-facts` (§17 — aside with dl/dt/dd, cream background)
11. `.bwc-pullquote` (blockquote styling — §6)
12. `.bwc-executive-summary` (bold lead paragraph)
13. `@media (max-width: 768px)` responsive overrides (§13 — h1:38px, h2:30px, h3:24px)
14. Layout: max-width 980px, centered

### Component HTML Templates
Each ContentNode type maps to a component:

| ContentNode.type | HTML Component | Key Classes/Elements |
|---|---|---|
| (document root) | `<article class="bwc-article">` | Wrapper |
| (hero) | `<header class="blog-hero">` | `.eyebrow`, `h1`, `.bwc-executive-summary`, `.meta` + `<time>` |
| paragraph | `<p>` | Standard body paragraph |
| image | `<figure class="bwc-figure">` + `<img>` + `<figcaption>` | Informative vs decorative via `alt`/`role` |
| pullQuote | `<blockquote class="bwc-pullquote">` + `<p>` + `<cite>` | Gold border-left |
| keyFacts | `<aside class="bwc-key-facts">` + `<h3>` + `<dl>` + `<dt>/<dd>` | Cream background |
| table | `<table>` + `<thead>/<tbody>` | Standard table with caption |
| list | `<ul>` or `<ol>` + `<li>` | Based on `ordered` field |
| callout | `<aside class="bwc-callout bwc-callout--{variant}">` | info/tip/warning variants |
| (faq) | `<section class="bwc-faq">` + `<h2>` + `<h3>/<p>` pairs | FAQ section |
| (author bio) | `<footer class="bwc-author-bio">` | Name, credentials, LinkedIn link |
| (schema) | `<script type="application/ld+json">` | BlogPosting, FAQPage, Product |

### Full HTML Skeleton (renderer must output this top-level structure)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[metaTitle]</title>
  <meta name="description" content="[metaDescription]">
  <link rel="canonical" href="[canonicalUrl]">
  <!-- Google Fonts preconnect + stylesheet link -->
  <style>
    /* Embedded CSS: :root variables + spacing scale + article element mapping + responsive overrides */
  </style>
  <script type="application/ld+json">
    { "@context": "https://schema.org", ... }
  </script>
</head>
<body>
  <article class="bwc-article">
    <header class="blog-hero">
      <p class="eyebrow">Bhutan Wine Company Journal</p>
      <h1>[title]</h1>
      <p class="lead">[executiveSummary]</p>
      <p class="meta">
        <time datetime="[ISO date]">[formatted date]</time>
        <span aria-hidden="true"> · </span>
        <span>By [author.name], [author.credentials]</span>
      </p>
    </header>
    <!-- hero image figure here (loading="eager" fetchpriority="high") -->
    <section class="blog-content">
      <!-- sections iterated here: h2/h3 + ContentNode components -->
    </section>
    <!-- FAQ section here (if faq.length > 0) -->
    <footer class="bwc-author-bio">
      <!-- author name, credentials, LinkedIn link -->
    </footer>
    <footer class="article-footer">
      <p class="last-updated">Last updated: <time datetime="[ISO date]">[formatted date]</time></p>
    </footer>
  </article>
</body>
</html>
```

### Non-Negotiable Renderer Rules (from Brand Style Guide §2)
1. Use real HTML for real content — headings, paragraphs, lists, captions as DOM elements
2. One `<h1>` per page (the article title)
3. Heading tags for structure only, not styling
4. No heading level skips
5. Standard `<a href>` for all links
6. Standard `<img>` for all article images (no CSS background-image for content)
7. All images have `width` and `height` attributes
8. Hero image: `loading="eager"` + `fetchpriority="high"`; all others: `loading="lazy"`
9. Links styled as gold underline, identifiable without hover
