# Pattern Finder Findings - Guide 4 Reference

Generated: 2026-03-02
Guides analyzed: 1, 2, 3 (all route.ts files, all lib modules, all types, all test scripts)

---

## 1. API Route Handler Pattern

### Files Read
health, auth/[...nextauth], users, users/[id], content-map, content-map/[id], content-map/import, onyx/health, onyx/search

### Flow
HTTP request -> requireRole(...) -> request.json() -> Schema.safeParse(body) -> business logic -> NextResponse.json()

### Key Rules (consistent across ALL 8 business routes)

1. Auth is ALWAYS first: await requireRole(...) is the first statement inside try.
2. Auth uses inline catch (no middleware): requireRole throws Error with message AUTH_REQUIRED or AUTH_FORBIDDEN -- caught by string comparison.
3. Always .safeParse(), never .parse(). Failures return 400 with details: parsed.error.flatten().
4. Response envelope: always { success: true, data } or { success: false, error: { code, message, details? } }.
5. Error codes: string literals from ErrorCode union in src/types/api.ts.
6. HTTP status: POST create = 201, GET/PATCH/DELETE = 200. Render/validate = 200 (no DB write).
7. Dynamic params: { params }: { params: Promise<{ id: string }> } -- Next.js 15, must be awaited.
8. Prisma: singleton from @/lib/db. Never new PrismaClient() in routes or lib files.
9. Zod schemas: co-located at top of route file, PascalCase ending in Schema.
10. Service errors: separate if (message === ...) blocks before INTERNAL_ERROR (see onyx/search/route.ts).

**Consistency Rating: HIGH** -- all 8 business routes follow this template exactly.

---

## 1b. Canonical Route Template

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";
// import lib functions and types as needed

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
    // Service-specific errors go here before INTERNAL_ERROR:
    // if (message === "RENDER_ERROR") { return NextResponse.json(..., { status: 500 }); }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
```

---

## 2. Lib Module Structure Pattern

### Directory Structure
```
src/lib/<domain>/
  index.ts         -- barrel file: re-exports everything public
  client.ts        -- main implementation
  <concern>.ts     -- additional concern files
```

### Barrel Export Pattern (from src/lib/onyx/index.ts)
```typescript
export { searchOnyx, searchOnyxSafe, searchOnyxMulti, getOnyxConfig } from './client';
export type { OnyxSearchFilters } from './client';
export { buildSearchQueries } from './query-builder';
export type { ArticleBrief } from './query-builder';
export { assembleOnyxContext } from './context-assembler';
export { checkOnyxHealth } from './health-checker';
```
Named exports only. No default exports. Types re-exported with `export type { ... }`.

### Type Import Pattern
```typescript
import type { OnyxContext, OnyxSearchResult } from "@/types/onyx";
// Use "import type" for type-only imports; "import { ... }" for values
```

### Environment Access (src/lib/env.ts)
```typescript
import { env } from "@/lib/env";
// env.ONYX_API_KEY, env.ANTHROPIC_API_KEY, env.CLOUDINARY_CLOUD_NAME, env.BWC_SITE_URL, etc.
```
All env access goes through `src/lib/env.ts`. Exception: claude/client.ts and cloudinary/client.ts are stubs (see Inconsistencies).

**Consistency Rating: HIGH** for onyx + content-map. LOW for claude/cloudinary (placeholder stubs).

---

## 3. Zod Validation Pattern

### Where Zod Lives
- Co-located with routes: schemas at top of the route.ts file.
- No shared schema directory. Schemas are NOT in src/types/.
- Guide 4 exception: src/lib/article-schema/ is the first lib-owned schema module.

### Schema Naming
```typescript
// CREATE: PascalCase verb+noun+Schema
const CreateUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

// UPDATE: all fields .optional()
const UpdateContentMapSchema = z.object({
  title: z.string().min(1).optional(),
  publishedDate: z.string().datetime().nullable().optional(),  // nullable DB fields
});
```

### Usage -- always safeParse, never parse
```typescript
const parsed = InputSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
    { status: 400 }
  );
}
const data = parsed.data;  // fully typed after this point
```

**Consistency Rating: HIGH** -- .safeParse() + error.flatten() in every validating route.

---

## 4. Error Handling Pattern

### Error Codes (from src/types/api.ts:19)
```typescript
export type ErrorCode =
  | "AUTH_REQUIRED"             // 401
  | "AUTH_FORBIDDEN"            // 403
  | "VALIDATION_ERROR"          // 400
  | "NOT_FOUND"                 // 404
  | "GENERATION_FAILED"         // 500
  | "ONYX_UNAVAILABLE"          // 503
  | "RENDER_ERROR"              // 500 -- use in render route
  | "QA_GATE_FAILED"            // 422
  | "CLOUDINARY_ERROR"          // 500
  | "LINK_VERIFICATION_FAILED"  // 500
  | "INTERNAL_ERROR";           // 500
```

### Lib Module Error Convention
```typescript
throw new Error("RENDER_ERROR");   // plain Error, code as message string
// No custom error classes exist. Never: throw new RenderError("...")
```

### Standard Catch Block
All 8 routes use this exact structure. Service-specific errors are inserted between AUTH_FORBIDDEN and INTERNAL_ERROR:
```typescript
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
  // service-specific (add for render/validate routes):
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
```

**Consistency Rating: HIGH** -- identical catch block in all 8 routes.

---

## 5. Type Definition Pattern

### Convention
- `interface` for object shapes: User, ContentMapEntry, CanonicalArticleDocument, ArticleSection, RendererInput
- `type` for unions and aliases: ArticleType, ErrorCode, ContentNode, ContentNodeType, CaptureType
- **No `enum` keyword** anywhere -- string literal unions only
- Discriminated unions: `interface extends base` for each member, `type` for the union

### Discriminated Union Pattern (src/types/article.ts)
```typescript
// Base interface
export interface ContentNodeBase { type: ContentNodeType; id: string; }

// Each member extends base with narrow literal type
export interface ParagraphNode extends ContentNodeBase { type: "paragraph"; text: string; }
export interface ImageNode extends ContentNodeBase { type: "image"; placement: ImagePlacement; }

// Union collects all members
export type ContentNode = ParagraphNode | ImageNode | PullQuoteNode | KeyFactsNode | TableNode | ListNode | CalloutNode;
```

### Types Already Defined in src/types/ -- Guide 4 Uses These, Does NOT Redefine
- CanonicalArticleDocument + sub-types (ArticleSection, all ContentNode variants) -- src/types/article.ts
- RendererInput, RendererOutput, HtmlOverride -- src/types/renderer.ts
- ErrorCode, ApiSuccess, ApiError, ApiResponse -- src/types/api.ts
- PhotoManifest, Photo, CloudinaryTransform -- src/types/photo.ts

### Zod/TypeScript Sync -- NEW in Guide 4
```typescript
// In src/lib/article-schema/schema.ts:
export const CanonicalArticleDocumentSchema = z.object({ ... });
export type ValidatedDoc = z.infer<typeof CanonicalArticleDocumentSchema>;
```

**Consistency Rating: HIGH** for type/interface convention. Zod-type sync is NEW in Guide 4.

---

## 6. Test Script Pattern

### Run Command
```bash
npx tsx scripts/test-guide-N.ts
```

### Evolution Across Guides
- **Guide 1 & 2**: `check` function defined inside `test()`. Module-level `let passed/failed` in Guide 2.
- **Guide 3**: `check` at module level, `dotenv.config` called FIRST before any lib imports, dynamic `await import(...)` for lib modules.
- **Guide 4 MUST follow Guide 3 pattern**.

### Guide 3 Pattern (canonical reference)
```typescript
/**
 * Integration test for Guide 4: Canonical Article Schema + Article Renderer
 * Run with: npx tsx scripts/test-guide-4.ts
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });  // FIRST

let passed = 0;
let failed = 0;

function check(name: string, result: boolean, detail?: string) {  // module-level
  if (result) { console.log(`  PASS ${name}`); passed++; }
  else { console.log(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`); failed++; }
}

async function test() {
  // Dynamic imports after env is loaded
  const { validateCanonicalDocument, repairCanonicalDocument } = await import("../src/lib/article-schema");
  const { renderArticle } = await import("../src/lib/renderer");

  console.log("\n=== Guide 4 Integration Tests ===\n");

  // Test sections...

  // API endpoints
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const renderRes = await fetch(`${appUrl}/api/articles/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: minimalDoc, htmlOverrides: null, templateVersion: "1.0" }),
    });
    check("POST /api/articles/render responds", renderRes.status === 200 || renderRes.status === 401);

    const validateRes = await fetch(`${appUrl}/api/articles/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: minimalDoc }),
    });
    check("POST /api/articles/validate responds", validateRes.status === 200 || validateRes.status === 401);
  } catch {
    console.log("  SKIP API tests -- dev server not running");
    console.log(`       (Start with npm run dev, then re-run this test)`);
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

test();
```

### Key Observations
- API tests accept 200 or 401 (no auth sessions in test scripts).
- DB tests use `new PrismaClient()` directly, not via retry wrapper.
- Handle dev server not running gracefully (try/catch + SKIP message).
- dotenv.config must be called before ANY lib import.

**Consistency Rating: MEDIUM** -- follow Guide 3 for Guide 4.

---

## 7. Import Conventions

### Path Aliases (tsconfig.json)
```json
"paths": { "@/*": ["./src/*"] }
```
Single alias: `@/` maps to `src/`. No other aliases.

### Import Ordering (observed in all routes)
```typescript
// 1. Framework
import { NextRequest, NextResponse } from "next/server";
// 2. Internal lib
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { renderArticle } from "@/lib/renderer";
// 3. Types
import type { SomeType } from "@/types/domain";
// 4. Third-party
import { z } from "zod";
```

### Export Conventions
- All lib modules: named exports only, no default exports
- Types: `export type { ... }` in barrel re-exports (explicit named re-exports preferred)
- `src/types/index.ts`: `export * from "./domain"` (wildcard)

### Prisma Rule
```typescript
import { prisma } from "@/lib/db";   // Always the singleton
// NEVER in routes/lib: new PrismaClient() -- only valid in test scripts
```

**Consistency Rating: HIGH.**

---

## 8. External Service Call Pattern

### Onyx Client (src/lib/onyx/client.ts -- reference for all future service clients)
```typescript
// Config: exported function (not class property), reads from env.*
export function getOnyxConfig() {
  return { baseUrl: env.ONYX_BASE_URL, apiKey: env.ONYX_API_KEY, timeoutMs: ... };
}

// Internal retry (NOT exported from index.ts):
// - AbortController per request for per-request timeout
// - MAX_RETRIES=3, BASE_DELAY_MS=500, exponential backoff (500ms, 1000ms, 2000ms)
// - Retryable: ECONNRESET/ECONNREFUSED/ETIMEDOUT, status 502/503/504
// - Non-retryable: status 400/401/403/404
async function fetchWithRetry(url: string, options: RequestInit, timeoutMs: number): Promise<Response> { ... }

// Three public variants -- follow this pattern for any external service client:
export async function searchOnyx(q, filters?): Promise<OnyxContext>       // throws Error("ONYX_UNAVAILABLE")
export async function searchOnyxSafe(q): Promise<OnyxContext | null>       // returns null on failure
export async function searchOnyxMulti(qs): Promise<OnyxContext[]>          // Promise.allSettled
```

### Neon/Prisma Cold Start (src/lib/db/retry.ts)
`retryDatabaseOperation<T>(op, maxRetries=3, baseDelay=500)` -- used only in auth/config.ts during login.
Guide 4 renderer is a pure function with no DB calls.

**Consistency Rating: HIGH** for Onyx pattern.

---

## 9. Inconsistencies Found

### INCONSISTENCY 1: claude/client.ts and cloudinary/client.ts bypass env.ts
- `src/lib/claude/client.ts`: uses `process.env.ANTHROPIC_API_KEY` directly
- `src/lib/cloudinary/client.ts`: uses `process.env.CLOUDINARY_URL` directly
- All other lib modules: `import { env } from "@/lib/env"`
- **Verdict**: Placeholder stubs not yet implemented. Guide 4 MUST use `env.*` in renderer/cloudinary.ts.

### INCONSISTENCY 2: contentMapSelect duplicated across two route files
- Identical `contentMapSelect` object in both `content-map/route.ts` and `content-map/[id]/route.ts`
- **Verdict**: Do not repeat. Guide 4 routes have no shared constants needed.

### INCONSISTENCY 3: Test script check function scope
- Guide 1 & 2: `check` inside `test()` function
- Guide 3: `check` at module level (more mature)
- **Verdict**: Follow Guide 3 (module-level check + counters).

### INCONSISTENCY 4: content-map/import/route.ts skips Zod
- Uses manual `typeof body.csv !== "string"` instead of Zod `.safeParse()`
- All other POST routes use Zod
- **Verdict**: Outlier. Guide 4 must use Zod for all input validation.

---

## 10. Anti-Patterns Found

### ANTI-PATTERN 1: Duplicated catch blocks (accepted by convention)
Every route copies the same catch block inline. A shared `handleRouteError(error)` helper would be DRY-er, but since all 8 routes duplicate it, **Guide 4 MUST follow the same duplication pattern** for consistency.

### ANTI-PATTERN 2: 409 conflict uses VALIDATION_ERROR code
`content-map/route.ts` returns status 409 with `code: "VALIDATION_ERROR"` for slug conflicts.
No dedicated CONFLICT error code exists in `ErrorCode`. Use `VALIDATION_ERROR` + 409 for uniqueness conflicts in Guide 4.

---

## 11. Recommendations for Guide 4

### src/lib/article-schema/
Structure: `index.ts` + `schema.ts` + `validate.ts` + `repair.ts`

- **schema.ts**: Define `CanonicalArticleDocumentSchema` as Zod object. Export schema + `z.infer<>` type.
- **validate.ts**: `validateCanonicalDocument(doc: unknown): { valid: boolean, errors: ZodError | null, data?: CanonicalArticleDocument }`
- **repair.ts**: `repairCanonicalDocument(doc: unknown): { repaired: CanonicalArticleDocument, changes: string[] }`
- **index.ts**: Re-export only public functions + types. NOT raw Zod schemas.
- Use `import type { CanonicalArticleDocument } from "@/types/article"` as the base TypeScript type.

### src/lib/renderer/
Structure: `index.ts` + `renderer.ts` + `components.ts` + `css.ts` + `jsonld.ts` + `cloudinary.ts`

- **renderer.ts**: `export function renderArticle(input: RendererInput): RendererOutput`
- Pure function: no side effects, no DB calls, no HTTP calls.
- `throw new Error("RENDER_ERROR")` on failure (caught by route handler).
- `import type { RendererInput, RendererOutput } from "@/types/renderer"` (already defined).
- `import { env } from "@/lib/env"` for `env.CLOUDINARY_CLOUD_NAME`.

### src/app/api/articles/render/route.ts
- `requireRole("admin", "editor")`
- `RenderRequestSchema`: `{ document: z.unknown(), htmlOverrides: z.array(...).nullable().default(null), templateVersion: z.string().default("1.0") }`
- Add `RENDER_ERROR` catch block before `INTERNAL_ERROR`
- Return HTTP 200 (no DB write -- pure transform)
- Return `{ success: true, data: { html, metaTitle, metaDescription, schemaJson, wordCount } }`

### src/app/api/articles/validate/route.ts
- `requireRole("admin", "editor")`
- `ValidateRequestSchema`: `{ document: z.unknown() }`
- Return `{ success: true, data: { valid: boolean, errors: [...] | null, repaired?: CanonicalArticleDocument } }`

### scripts/test-guide-4.ts
- Follow Guide 3 style exactly (dotenv first, module-level check, dynamic imports)
- Test sections: (1) Schema -- valid doc passes, invalid fails, repair works; (2) Renderer -- html/wordCount/schemaJson present; (3) API -- 200 or 401 accepted
- Create minimal CanonicalArticleDocument fixture (all required fields populated)
- `process.exit(failed > 0 ? 1 : 0)`

---

## Summary Table

| Pattern | Consistency | Guide 4 Action |
|---|---|---|
| Route handler template | HIGH | Copy exactly |
| Auth: requireRole inline throws | HIGH | Copy exactly |
| Zod: .safeParse() + flatten() | HIGH | Copy exactly |
| Error catch block (AUTH + service + INTERNAL) | HIGH | Copy exactly |
| Response envelope { success, data/error } | HIGH | Copy exactly |
| Lib: barrel index.ts | HIGH | Follow for article-schema + renderer |
| Lib: named exports only, no defaults | HIGH | Follow |
| Types: interface for objects, type for unions | HIGH | Follow |
| No enum keyword -- string literal unions | HIGH | Follow |
| Env access via src/lib/env.ts | MEDIUM (stubs exist) | Always use env.* |
| Test script: Guide 3 style | MEDIUM | Follow Guide 3 |
| Prisma: singleton from @/lib/db | HIGH | Follow |
| import type for type-only imports | HIGH | Follow |
| No custom Error classes | HIGH | throw new Error("CODE") only |
| Service errors before INTERNAL_ERROR | HIGH | Add RENDER_ERROR in render route |


---

## 12. BEM/CSS Pattern for Rendered HTML Output

### Source Documents
- `docs/Bhutan Wine Company — Brand Style Guide for HTML Blog Posts (3).md` (authoritative)
- `CLAUDE.md` §Blog Article Output section (summary reference)

### CSS Variable Naming Convention
All CSS custom properties use the `--bwc-` prefix. Variables are defined once in `:root {}` and embedded inline via a `<style>` block in the rendered HTML output.

```css
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
}
```

### Spacing Scale (also in `:root {}`)
```css
:root {
  --space-xs: 8px;
  --space-sm: 16px;
  --space-md: 24px;
  --space-lg: 48px;
  --space-xl: 80px;
  --space-2xl: 120px;
}
```

### BEM Class Naming Convention
Prefix: `bwc-` on all component classes. Style guide uses flat BEM (block only), not block__element--modifier for the documented components.

```
bwc-article        -- <article> wrapper (from HTML skeleton §18)
bwc-brand          -- brand name / logo text
bwc-nav            -- navigation items
bwc-hero-title     -- hero h1
bwc-hero-subtitle  -- hero intro/deck paragraph
bwc-section-title  -- h2 with gold accent (55px, Cormorant Garamond 600)
bwc-section-title-standard -- h2 standard variant (50px, Cormorant Garamond 500)
bwc-subsection     -- h3 (28px, Cormorant Garamond 600)
bwc-card-heading   -- h3/h4 in card context (40px, Fraunces 400)
bwc-featured-text  -- pull quote / featured text (28px, Cormorant Garamond 300)
bwc-card-body      -- card body text (25px, Fraunces 400)
bwc-body           -- primary body text (16px, Nunito Sans 300)
bwc-body-bold      -- bold body text (16px, Nunito Sans 700)
bwc-footer         -- footer text (12px, Trirong 400)
bwc-footer-link    -- footer links (20px, Cormorant Garamond 600)
```

### Blog Post Element Mapping (semantic selectors, not BEM)
The Brand Style Guide's primary typography system for article content uses semantic selectors, NOT BEM classes on body copy:

```css
article h1 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 48px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--bwc-gold);
}

article h2 {
  font-family: 'Fraunces', serif;
  font-size: 36px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--bwc-text-dark-alt);
}

article h3 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--bwc-text-primary);
}

article p,
article li {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 16px;
  font-weight: 300;
  line-height: 1.7;
  color: var(--bwc-text-primary);
}

article blockquote {
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

article figcaption {
  font-family: 'Trirong', serif;
  font-size: 13px;
  font-weight: 400;
  color: var(--bwc-text-secondary);
}

article .lead,
article .intro {
  font-family: 'Fraunces', serif;
  font-size: 21px;
  font-weight: 400;
  color: var(--bwc-text-secondary);
}
```

### Google Fonts Import (required in every rendered HTML `<head>`)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Nunito+Sans:wght@300;400;700&family=Trirong&display=swap" rel="stylesheet">
```

### HTML Skeleton Structure (from Brand Style Guide §18)
The renderer must output this top-level structure:

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
        <span aria-hidden="true"> - </span>
        <span>By [author.name], [author.credentials]</span>
      </p>
    </header>
    <section class="blog-content">
      <!-- sections iterated here -->
    </section>
    <footer class="article-footer">
      <p class="last-updated">Last updated: <time datetime="[ISO date]">[formatted date]</time></p>
    </footer>
  </article>
</body>
</html>
```

### Image HTML Rules (from Brand Style Guide §10-11 and CLAUDE.md)
- Hero image: `loading="eager" fetchpriority="high"` + explicit `width` and `height`
- All other images: `loading="lazy"` + explicit `width` and `height`
- Informative images: `alt="[10-25 word description]"`
- Decorative images: `alt=""`
- All images wrapped in `<figure>` with optional `<figcaption>`
- Cloudinary URL construction: `https://res.cloudinary.com/{cloudName}/image/upload/{transform}/{publicId}`

### Mobile Responsive Overrides (required in embedded CSS)
```css
@media (max-width: 768px) {
  article h1 { font-size: 38px; }
  article h2 { font-size: 30px; }
  article h3 { font-size: 24px; }
  article p, article li { font-size: 16px; line-height: 1.7; }
  article .lead, article .intro { font-size: 19px; }
}
```

**Consistency Rating: HIGH** -- CSS variables, font stack, and semantic selectors are fully defined in the Brand Style Guide. No existing renderer code to drift from yet.

---

## 13. Import Order Pattern (Verified Against Actual Route Files)

Actual import order observed in `src/app/api/onyx/search/route.ts` and `src/app/api/content-map/route.ts`:

```typescript
// 1. Framework (next/server)
import { NextRequest, NextResponse } from "next/server";

// 2. Internal lib (@ alias, values)
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { searchOnyx } from "@/lib/onyx";

// 3. Internal types (type-only, when present)
import type { SomeType } from "@/types/domain";

// 4. Third-party (zod, etc.)
import { z } from "zod";
```

Note: In actual route files, `z` from `"zod"` consistently appears LAST after all `@/` internal imports. The existing findings doc had this order correct but is clarified here: third-party (zod) is after all internal `@/` imports.

**Consistency Rating: HIGH** -- same order in all 3 business routes examined.

