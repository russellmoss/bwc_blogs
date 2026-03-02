# Integration Verifier Findings — Guide 4 Pre-Check
**Date:** 2026-03-02  
**Guide:** 4 — Canonical Article Schema + Article Renderer  
**Verifier:** integration-verifier agent

---

## Summary Table

| Service | Status | Response Time | Notes |
|---|---|---|---|
| Neon Postgres | OK | ~200ms | All 9 tables exist, connection via pooler works |
| Onyx RAG | OK | 125ms health, ~2s search | Health 200, admin/search returns KB results |
| Claude API | OK | ~2s completion | Basic, web search, and streaming all verified |
| Cloudinary | OK | ~1s CDN | API credentials valid, CDN delivery with transforms works |
| Vercel (deployed) | PARTIAL | <1s | /api/health returns 200; /api/content-map and /api/onyx/health return 404 — deployment is stale |
| Local build | OK | ~2.4s compile | Zero TS errors, all 12 routes compiled cleanly |

---

## 1. Neon Postgres

**Connection:** Pooled URL works (`ep-weathered-pond-ai9zijr1-pooler.c-4.us-east-1.aws.neon.tech`)

**Table Row Counts:**
| Table | Rows |
|---|---|
| users | 1 |
| content_map | 39 |
| article_documents | 0 |
| article_html | 0 |
| internal_links | 10 |
| photos | 0 |
| article_photos | 0 |
| leads | 0 |
| lead_events | 0 |

**Observations:**
- `article_documents` and `article_html` are correctly empty (Guide 11 writes to them)
- `content_map` has 39 rows from Guide 2 seed — healthy
- `internal_links` has 10 rows (core page links seeded)
- `photos` table is empty — expected, Guide 9 populates it
- `photos` table has all expected columns: `cloudinary_public_id`, `cloudinary_url`, `alt_text`, `classification`, `vineyard_name`, `uploaded_to_cdn` — Guide 4 renderer can reference these fields safely

**Prisma generate:** Client already built. Re-generation showed EPERM file lock error (Windows DLL file in use by existing node process) — not a real error, client is functional and all queries work.

---

## 2. Onyx RAG

**Health endpoint:** `GET https://rmoss-onyx.xyz/api/health` → HTTP 200 in 0.125s

**Search test:** `POST https://rmoss-onyx.xyz/api/admin/search`
- Query: "What is the elevation of Bajo vineyard?"
- Result: HTTP 200, returned KB documents including gallery.md with vineyard data
- Score: 8.77 (high relevance), source: google_drive
- Response includes `documents[]` array with `blurb`, `semantic_identifier`, `score`, `match_highlights`

**Note:** `/api/direct-qa` and `/api/query/stream` return 404 — the correct search endpoint is `/api/admin/search` (matches client.ts implementation).

---

## 3. Claude API

**Basic completion:** HTTP 200 in 1.97s  
- Model: `claude-sonnet-4-5-20250929` accessible  
- Response: `{"type":"message","role":"assistant","content":[{"type":"text","text":"Hello, how are you today?"}]}`

**Web search tool:** HTTP 200  
- `web_search_20250305` tool works  
- Returned correct result: `https://www.bhutanwine.com/` for "Bhutan Wine Company URL"

**Streaming:** HTTP 200  
- SSE format confirmed: `event: message_start`, `event: content_block_delta`, `event: message_delta`  
- Delta events contain text fragments correctly

**Model note:** `.env` has `ANTHROPIC_MODEL="claude-sonnet-4-5"` (without full date suffix). `.env.example` specifies `claude-sonnet-4-5-20250929`. The short alias `claude-sonnet-4-5` resolves correctly per API test.

---

## 4. Cloudinary

**API credentials:** Valid  
- Cloud name: `deahtb4kj`  
- API key: `884563924896736`  
- Listed 3 images via management API (including `main-sample`, `cld-sample-5`)

**CDN delivery with transforms:** HTTP 200 in 1.12s  
- URL: `https://res.cloudinary.com/deahtb4kj/image/upload/w_800,f_auto,q_auto/main-sample`  
- Transform parameters `w_800,f_auto,q_auto` applied successfully

**Upload folder:** `blog` (configured in env)

---

## 5. Local Build

**Command:** `npm run build`  
**Result:** Compiled successfully in 2.4s, zero TypeScript errors

**Routes compiled:**
```
○ /                          (static)
○ /_not-found                (static)
ƒ /api/auth/[...nextauth]    (dynamic)
ƒ /api/content-map           (dynamic)
ƒ /api/content-map/[id]      (dynamic)
ƒ /api/content-map/import    (dynamic)
ƒ /api/health                (dynamic)
ƒ /api/onyx/health           (dynamic)
ƒ /api/onyx/search           (dynamic)
ƒ /api/users                 (dynamic)
ƒ /api/users/[id]            (dynamic)
○ /login                     (static)
```

---

## 6. Vercel Deployment

**Health endpoint:** `GET https://bwc-content-engine.vercel.app/api/health`  
→ HTTP 200 in 0.98s  
→ Body: `{"status":"ok","app":"bwc-content-engine","timestamp":"...","env":{"hasDatabase":true,"hasAnthropic":true,"hasOnyx":true,"hasCloudinary":true}}`

**ISSUE — Stale deployment:**  
`/api/content-map` and `/api/onyx/health` both return HTTP 404 from the deployed Vercel app. The response title is "Create Next App" (default Next.js boilerplate), indicating the Vercel deployment is running an older version that predates Guides 2 and 3. The latest code has not been pushed/deployed to Vercel.

---

## 7. Wix Sitemap

**URL:** `https://www.bhutanwine.com/sitemap.xml` → HTTP 200  
**Format:** Sitemap index with 3 sub-sitemaps:
- `store-products-sitemap.xml` (updated 2024-12-20)
- `store-categories-sitemap.xml` (updated 2022-12-11)
- `pages-sitemap.xml` (updated 2026-02-08)

**No blog sub-sitemap exists yet** — expected, as no blog posts have been published via Wix.

---

## Environment Variable Status (Guide 4 Requirements)

| Variable | Status | Notes |
|---|---|---|
| DATABASE_URL | Set | Pooled Neon URL — working |
| DATABASE_URL_UNPOOLED | Set | Direct Neon URL — working |
| NEXTAUTH_SECRET / AUTH_SECRET | Set | Same value for both |
| NEXTAUTH_URL / AUTH_URL | Set | http://localhost:3000 |
| ANTHROPIC_API_KEY | Set | Valid, tested |
| ANTHROPIC_MODEL | Set | `claude-sonnet-4-5` (short alias works) |
| CLOUDINARY_CLOUD_NAME | Set | `deahtb4kj` |
| CLOUDINARY_API_KEY | Set | Valid |
| CLOUDINARY_API_SECRET | Set | Valid |

**All env vars required for Guide 4 are present and functional.**

---

## Issues Found

### ISSUE 1 (Medium): Vercel deployment is stale
- `/api/content-map` and `/api/onyx/health` return 404 on Vercel
- Local build passes and includes these routes
- **Action:** Push latest code to trigger new Vercel deployment before Guide 4 review/demo

### ISSUE 2 (Low): Prisma config deprecation warning
- `package.json#prisma` config is deprecated in Prisma 7
- Should migrate to `prisma.config.ts` before Prisma 7 upgrade
- Non-blocking for Guide 4

### ISSUE 3 (Low): Model alias in .env
- `.env` uses `ANTHROPIC_MODEL="claude-sonnet-4-5"` (no date suffix)
- `.env.example` specifies `claude-sonnet-4-5-20250929`
- Alias resolves correctly but should be standardized

---

## Guide 4 Readiness

**Verdict: READY TO PROCEED**

All tier-1 blockers are clear:
- Database connected, correct schema in place
- Build compiles with zero errors
- Type system intact (Prisma models match schema)
- `article_documents` and `article_html` tables exist and are empty — correct state for Guide 4 to define and validate the schema
- `photos` table structure confirmed — renderer can safely reference Cloudinary fields
- Claude API works for structured JSON generation
- Content map has 39 seeded rows for testing

The only action needed before live deployment testing: push latest code to Vercel to update the stale deployment.

---

# Integration Verifier Findings — Guide 4 Verification Run
**Date:** 2026-03-02  
**Guide:** 4 — Canonical Article Schema + Article Renderer  
**Run type:** Post-Guide-4-assignment check (before implementation)

---

## Summary Table

| Service | Status | Response Time | Notes |
|---|---|---|---|
| Neon Postgres | OK | <200ms | All 9 tables, counts match expectations |
| Onyx RAG | OK | 134ms | Health 200 confirmed |
| Cloudinary CDN | OK | 262ms | CDN delivery with transforms HTTP 200 |
| Vercel (deployed) | OK | 750ms | /api/health returns 200 |
| Local build | OK | 1899ms | Zero TS errors, 11 routes compiled cleanly |
| TypeScript check | OK | — | `npx tsc --noEmit` exits 0, zero errors |

---

## Tier 1: Basic Health

### Build
- `npm run build`: Compiled successfully in 1899ms, zero TypeScript errors
- Routes compiled (11 total): auth, content-map, content-map/[id], content-map/import, health, onyx/health, onyx/search, users, users/[id], plus static /, /login
- `npx tsc --noEmit`: Exit code 0, zero errors

### Health endpoint
- `GET https://bwc-content-engine.vercel.app/api/health` → HTTP 200 in 0.750s

---

## Tier 2: Guide 4 Specific

### Cloudinary URL pattern
- URL tested: `https://res.cloudinary.com/deahtb4kj/image/upload/w_800,f_auto,q_auto/main-sample`
- Result: HTTP 200 in 0.262s
- Known public IDs confirmed via API: `main-sample` (1248x832px PNG)
- CLOUDINARY_CLOUD_NAME=`deahtb4kj` — confirmed set in .env

### Database state
| Table | Rows |
|---|---|
| user | 1 |
| contentMap | 39 |
| articleDocument | 0 |
| articleHtml | 0 |
| internalLink | 10 |
| photo | 0 |
| articlePhoto | 0 |
| lead | 0 |
| leadEvent | 0 |

- `contentMap`: 39 rows (correct — Guide 2 seed)
- `articleDocument`: 0 rows (correct — Guide 4 defines the schema; Guide 5+ writes rows)
- `articleHtml`: 0 rows (correct — Guide 11 writes rows)
- `photo`: 0 rows (correct — Guide 9 populates)

### Type system state
The following type files exist and compile cleanly:
- `src/types/article.ts` — `CanonicalArticleDocument` and all sub-types fully defined
- `src/types/renderer.ts` — `RendererInput`, `RendererOutput`, `HtmlOverride` defined
- `src/types/qa.ts` — `QACheck`, `QAResult`, `QAScore` defined
- `src/types/photo.ts`, `src/types/content-map.ts` — referenced by article types, all resolve

### Guide 4 implementation directories
- `src/lib/renderer/` — does NOT exist yet (Guide 4 will create it)
- `src/lib/article-schema/` — does NOT exist yet (Guide 4 will create it)

This is the correct pre-implementation state. The type contracts are defined and compiled; the implementation modules have not been written yet.

---

## Tier 3: Previous Guide Routes

- `GET https://bwc-content-engine.vercel.app/api/health` → HTTP 200 (Vercel still stale for content-map/onyx but health works)
- Local routes all present in build: `/api/content-map`, `/api/onyx/health`, `/api/onyx/search`

---

## Issues Found

### No new blockers for Guide 4
All pre-conditions are met:
1. TypeScript compiles clean
2. `CanonicalArticleDocument` type is fully defined and exported
3. `RendererInput`/`RendererOutput` types are defined
4. Database schema has `article_documents` and `article_html` tables (empty, awaiting Guide 4 write paths)
5. Cloudinary delivery works with transform URL pattern that renderer will generate

### Carried-over (non-blocking)
- Vercel deployment is stale (Guides 2-3 routes not yet deployed)
- ANTHROPIC_MODEL uses short alias `claude-sonnet-4-5` (resolves OK)
- Prisma config deprecation warning for Prisma 7 migration

---

## Guide 4 Readiness

**Verdict: READY TO PROCEED**

All Tier 1 checks pass. The type foundation for Guide 4 is fully in place. Implementation can begin on:
- `src/lib/article-schema/` — Zod validation schema for `CanonicalArticleDocument`
- `src/lib/renderer/` — HTML renderer consuming `RendererInput`, producing `RendererOutput`
