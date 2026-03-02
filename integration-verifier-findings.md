# Integration Verifier Findings — Guide 5 Pre-Build Check

**Date:** 2026-03-02  
**Prepared by:** Integration Verifier  
**Purpose:** Verify all external service connections and existing API routes before Guide 5 (Orchestration Layer + Claude API).

---

## Summary Table

| Service | Status | Response Time | Notes |
|---|---|---|---|
| Neon Postgres | OK | ~50ms | 39 rows in content_map, all tables present |
| Onyx RAG | OK | 880ms (health), ~90ms (search) | 33 indexed docs, search returns KB results |
| Claude API | OK | 1.6s (completion) | Key valid, streaming + web_search functional |
| Cloudinary | OK | 120ms (CDN) | API auth valid, CDN transforms work |
| Vercel (deployed) | OK | 851ms | Health endpoint returns 200 |
| npm run build | OK | — | Zero errors, all 13 routes compiled |

---

## Tier 1: Basic Health

### npm run build
**Status: PASS**

All 13 routes compiled without errors:
- /api/articles/render, /api/articles/validate
- /api/auth/[...nextauth]
- /api/content-map, /api/content-map/[id], /api/content-map/import
- /api/health, /api/onyx/health, /api/onyx/search
- /api/users, /api/users/[id]

### /api/health (local dev, port 3000)
HTTP 200 in 6ms

```json
{"status":"ok","app":"bwc-content-engine","env":{"hasDatabase":true,"hasAnthropic":true,"hasOnyx":true,"hasCloudinary":true}}
```

### /api/health (Vercel deployed: bwc-content-engine.vercel.app)
HTTP 200 in 851ms

---

## Tier 2: Guide 5 Dependencies

### Neon/Prisma
**Status: CONNECTED**

prisma db pull succeeded — live connection confirmed.

**Table Row Counts:**

| Table | Rows | Notes |
|---|---|---|
| users | 1 | Admin user seeded |
| content_map | 39 | 8 hubs + 31 spokes, 0 news |
| article_documents | 0 | Ready for Guide 5 writes |
| article_html | 0 | Ready for Guide 5 writes |
| internal_links | 10 | 10 core page links, all active |
| photos | 0 | Guide 9+ |
| article_photos | 0 | Guide 9+ |
| leads | 0 | Guide 9+ |
| lead_events | 0 | Guide 9+ |

**Hub-Spoke Breakdown (all 8 hubs):**

| Hub ID | Title (truncated) | Spokes |
|---|---|---|
| 1 | The Complete Guide to Bhutan Wine | 6 |
| 2 | Emerging Wine Regions | 4 |
| 3 | High-Altitude Viticulture | 3 |
| 4 | The Art of Sustainable Winemaking | 4 |
| 5 | The Ultimate Guide to Luxury Travel in Bhutan | 5 |
| 6 | The Story of Wine in Bhutan | 4 |
| 7 | Wine Tourism Beyond Europe | 2 |
| 8 | Bhutan: The World's Most Exclusive Travel Destination | 3 |

Total: 8 hubs + 31 spokes = 39 entries. Hub-spoke parentHubId references are wired correctly.

**Internal Links (10 core pages seeded, all isActive: true, type: to-core-page):**
/the-grapes-vineyards, /our-wine, /our-wine-2023-first-barrel, /first-release, /visit-us, /about-us, /in-the-news, /gallery, /2024-inquiry-request, /contact-us

### Onyx RAG
**Status: HEALTHY**

Direct health: `https://rmoss-onyx.xyz/api/health` — HTTP 200 in 111ms

Via app route `/api/onyx/health`:
```json
{"healthy":true,"indexedDocuments":33,"lastIndexTime":"2026-03-02T13:24:17.191275Z","responseTimeMs":880}
```

**Search test** — endpoint `/api/admin/search` (what `src/lib/onyx/client.ts` uses):
- Query: "Bajo vineyard elevation"
- HTTP 200 in ~90ms
- Returned 2 documents with source attribution
- Match highlights confirmed: "Bajo vineyard is completely flat, at around 4,000 feet in elevation"
- Sources: `the-grapes-vineyards_grapes_vineyards.md`, `bhutan-wine-vineyards.md`

Note: `/api/direct-qa` returns 404 — not used by app code. App correctly uses `/api/admin/search`.

### Claude API
**Status: FULLY OPERATIONAL**

- Basic completion: HTTP 200 in 1.6s, model `claude-sonnet-4-5` resolves to `claude-sonnet-4-5-20250929`
- Streaming (SSE): Working — `message_start`, `content_block_delta` events confirmed
- web_search tool (type `web_search_20250305`): Working — returned real search results
- ANTHROPIC_MODEL env var: `"claude-sonnet-4-5"` — resolves correctly to latest dated version

### Existing API Routes (Guides 1-4)
All authenticated routes require JWT session (login via `/api/auth/callback/credentials` works).

| Route | Method | Status | Notes |
|---|---|---|---|
| GET /api/health | — | HTTP 200 | No auth required |
| GET /api/content-map | Auth | HTTP 200 | Returns all 39 entries |
| GET /api/onyx/health | Auth | HTTP 200 | Onyx healthy, 33 docs indexed |
| POST /api/articles/validate | Auth | HTTP 200 | Accepts doc, returns typed validation errors |
| POST /api/articles/render | Auth | HTTP 500 | Expected — minimal test doc missing required fields |

The render route 500 is correct behavior: `CanonicalArticleDocument` requires heroImage, sections, faq, schema, author, ctaType, captureComponents, dataNosnippetSections. Guide 5 will pass fully-populated documents.

---

## Tier 3: Database State Audit

### Prisma Schema — All Models Present in DB
- users, content_map, article_documents, article_html, internal_links
- photos, article_photos, leads, lead_events

All models defined in `prisma/schema.prisma` exist in the live Neon database.

### content_map Seeding State
- 39 total entries — matches expected seed count
- All entries have status `"planned"` — no articles drafted yet
- Slug field populated on all 39 entries
- Hub parentHubId references verified correct (8 hubs, 31 spokes)

### internal_links State
- 10 rows — all 10 core BWC site pages seeded
- All isActive: true, all linkType: "to-core-page"
- No article-to-article links yet (will populate as articles are generated)

---

## Cloudinary

**Status: OPERATIONAL**

- API auth (list resources): HTTP 200 — `deahtb4kj` cloud name valid
- CDN delivery with transforms (`w_800,f_auto,q_auto`): HTTP 200 in 120ms
- No blog folder images yet (ENABLE_PHOTO_MANAGER=false — expected)

---

## Wix Sitemap

`https://www.bhutanwine.com/sitemap.xml` — HTTP 200

Sitemap index contains: store-products, store-categories, pages. **No blog sub-sitemap** — expected, no articles published yet.

---

## Issues Found

1. **No .env.local file** — project uses `.env` directly with real credentials. Verify `.env` is in `.gitignore` and not committed.

2. **Prisma deprecation warning** — `package.json#prisma` config is deprecated, should migrate to `prisma.config.ts` before Prisma 7. Non-blocking for Guide 5.

3. **articles/render returns generic 500** for malformed input — the error message is `"Article rendering failed"`. Low priority since Guide 5 will pass valid documents.

---

## Recommendations for Guide 5

1. **All services are connected and operational. Guide 5 can proceed.**

2. **content_map is seeded and ready** for article brief construction. Guide 5 can query by `content_map.id` to retrieve hub/spoke context, target keywords, and main entities.

3. **internal_links provides 10 core page URLs** for link graph queries. Guide 5 should also traverse `content_map.internalLinksTo` arrays for hub-to-spoke link suggestions.

4. **Claude API streaming is confirmed.** Guide 5 generation endpoint can implement SSE streaming.

5. **Onyx returns KB results in under 1 second.** The 3-query context assembly pattern from Guide 3 is verified working end-to-end.

6. **article_documents and article_html are empty and ready** for Guide 5 to write generated articles to.

---

# Guide 6 Pre-Build Findings

**Date:** 2026-03-02
**Guide:** Guide 6 - Split-Pane UI + Chat Mode
**Verifier:** integration-verifier agent

---

## Summary Table

| Service | Status | Response Time | Notes |
|---|---|---|---|
| Neon Postgres | PASS | ~800ms | All 9 tables, 39 content_map rows, admin seeded |
| Onyx RAG | PASS | 95ms health / 179ms search | KB docs with source attribution |
| Claude API | PASS | ~1.5s | Key valid, SSE streaming works, web search works |
| Cloudinary | PASS | 244ms API / 160ms CDN | Credentials valid, CDN transforms work |
| Vercel (deployed) | PASS | 197ms | HTTP 200, all 4 env vars confirmed present |
| npm run build | PASS | 4.6s | 15 routes compiled, zero errors, zero warnings |
| TypeScript | PASS | - | npx tsc --noEmit zero errors |
| ESLint | PASS | - | 0 errors, 1 warning in untracked scratch file |

---

## Tier 1: Build Health

### Check 1: npm run build
**Status: PASS**

Next.js 16.1.6 with Turbopack. Compiled in 4.6s. Static pages generated in 215.6ms.
Zero errors and zero warnings.

Routes compiled (15 total + Proxy middleware):
  / (static)
  /login (static)
  /api/articles/generate (dynamic, SSE stream)
  /api/articles/render (dynamic)
  /api/articles/validate (dynamic)
  /api/auth/[...nextauth] (dynamic)
  /api/content-map (dynamic)
  /api/content-map/[id] (dynamic)
  /api/content-map/import (dynamic)
  /api/health (dynamic)
  /api/links/verify (dynamic)
  /api/onyx/health (dynamic)
  /api/onyx/search (dynamic)
  /api/users (dynamic)
  /api/users/[id] (dynamic)

Guide 5 added 2 new routes vs previous check: /api/articles/generate + /api/links/verify.

### Check 2: npx tsc --noEmit
**Status: PASS**

Zero output = zero TypeScript errors. All strict-mode checks pass.

### Check 3: npx eslint .
**Status: PASS (0 errors, 1 warning)**

One warning in write_findings.js (untracked scratch file, not application code).
No warnings or errors in src/, scripts/, or prisma/.

---

## Tier 2: Database State

### Check 4: npx prisma validate
**Status: PASS**

Schema at prisma/schema.prisma is valid.
Non-blocking: package.json#prisma config deprecated - breaks in Prisma 7.

### Check 5: Row Counts (live Neon connection via Guide 1 test suite)
**Status: PASS**

| Table | Rows | Notes |
|---|---|---|
| user | 1 | admin seeded (russell@bhutanwine.com, active) |
| contentMap | 39 | 8 hubs + 31 spokes, all status=planned |
| articleDocument | 0 | ready for Guide 5/6 writes |
| articleHtml | 0 | ready for Guide 5/6 writes |
| internalLink | 10 | 10 core BWC pages, all active |
| photo | 0 | Guide 9+ |
| articlePhoto | 0 | Guide 9+ |
| lead | 0 | Guide 9+ |
| leadEvent | 0 | Guide 9+ |

---

## Tier 3: API Routes for Guide 6 Frontend

All routes confirmed in build output. Auth guard (requireRole) present on all routes.

### Check 6: GET /api/health
**Status: PASS**

File: src/app/api/health/route.ts
Deployed Vercel: HTTP 200 in 197ms
Response: {"status":"ok","app":"bwc-content-engine","env":{"hasDatabase":true,"hasAnthropic":true,"hasOnyx":true,"hasCloudinary":true}}

### Check 7: POST /api/articles/generate
**Status: PASS (route exists, SSE transport confirmed)**

File: src/app/api/articles/generate/route.ts
Auth: requireRole("admin","editor") - 401/403 if unauthenticated
Transport: Server-Sent Events (text/event-stream)
Body (Zod): { articleId: int, userMessage: string, conversationHistory: array, currentDocument: object|null, photoManifest: object|null }
Stream event format: { type: string, data: object }
Guide 6 UI needs: EventSource or fetch with ReadableStream reader to consume SSE stream.

### Check 8: POST /api/articles/render
**Status: PASS**

File: src/app/api/articles/render/route.ts
Auth: requireRole("admin","editor")
Body: { document: object, htmlOverrides: array|null, templateVersion: string }
Response: { success: true, data: { html, metadata } }

### Check 9: POST /api/articles/validate
**Status: PASS**

File: src/app/api/articles/validate/route.ts
Auth: requireRole("admin","editor")
Body: { document: object, repair: boolean }
Response: { success: true, data: { valid, errors, warnings, repaired?, changes? } }

### Check 10: GET /api/content-map
**Status: PASS (39 real entries)**

File: src/app/api/content-map/route.ts
Auth: requireRole("admin","editor","viewer")
Returns array ordered by createdAt desc. Fields: id, hubName, articleType, title, slug, status, qaScore, wordCount.
Guide 6 sidebar list view has real data on first load - no stubbing needed.

### Check 11: /api/auth/[...nextauth]
**Status: PASS**

File: src/app/api/auth/[...nextauth]/route.ts
NextAuth v4, JWT sessions. GET + POST handlers. Login page at /login.

---

## Tier 4: External Services

### Check 12: Claude API
**Status: PASS**

API key: sk-ant-api prefix confirmed in .env.
Model: claude-sonnet-4-5-20250929 (ANTHROPIC_MODEL).
Basic completion: HTTP 200, response received correctly.
Streaming SSE: PASS - message_start, content_block_delta, message_delta events confirmed.
Web search tool (web_search_20250305): PASS - returned https://www.bhutanwine.com/ for BWC query.
Max output tokens: 16384.

### Check 13: Onyx RAG
**Status: PASS**

GET https://rmoss-onyx.xyz/api/health: HTTP 200 in 95ms
Response: {"success":true,"message":"ok","data":null}

POST /api/admin/search: HTTP 200 in 179ms
Query: "elevation of Bajo vineyard"
Result: the-grapes-vineyards_grapes_vineyards.md (Google Drive, score 6.62)
Blurb: "This picturesque vineyard sits on sandy soil in a steep valley on the banks of the river..."

Note: /api/direct-qa returns 404 (expected - app uses /api/admin/search per src/lib/onyx/client.ts:125).

### Check 14: Neon Database URL
**Status: PASS**

DATABASE_URL and DATABASE_URL_UNPOOLED present in .env.
Live connectivity confirmed via Prisma row count queries.

### Check 15: Cloudinary
**Status: PASS**

Cloud name: deahtb4kj (confirmed matches .env.example).
API credentials (list resources): HTTP 200 in 244ms.
Resources: main-sample.png, cld-sample-5.jpg, cld-sample-4.jpg (seeded 2026-02-28).
CDN delivery with transforms (w_800,f_auto,q_auto): HTTP 200 in 160ms.

---

## Tier 5: Frontend Dependencies

### Next.js + React
**Status: PASS**

Next.js 16.1.6 with Turbopack, React 19.2.3.
App Router fully supported. Server Components + Client Components both available.
All 15 routes compile correctly (static + dynamic).

### Dev server
**Status: NOT TESTED (acceptable)**

Not started to avoid port conflicts. Build output confirms all routes compile correctly.

---

## Issues Found

| # | Severity | Issue | Impact |
|---|---|---|---|
| 1 | LOW | Prisma package.json#prisma config deprecated | Non-blocking; breaks in Prisma 7 |
| 2 | LOW | write_findings.js scratch file ESLint warning | Not application code; no impact |
| 3 | INFO | articleDocument and articleHtml tables empty | Expected - no articles generated yet |
| 4 | INFO | No GET /api/articles/[id] route | May be needed by Guide 6 to load saved drafts |

**No blocking issues. All Tier 1 checks pass. Guide 6 can proceed.**

---

## Recommendations for Guide 6

1. All backend services are ready. Proceed to build the Split-Pane UI.
2. SSE confirmed in /api/articles/generate - UI needs EventSource or fetch ReadableStream.
3. Auth required on all article routes - implement session check. /login page exists.
4. Content map has 39 real entries for sidebar list view on first load.
5. Consider adding GET /api/articles/[id] to load saved drafts (not currently present).
6. /api/content-map/[id] exists - use to fetch individual article brief by content map ID.

---

## Environment Variables (.env)

| Variable | Status |
|---|---|
| DATABASE_URL | SET |
| DATABASE_URL_UNPOOLED | SET |
| NEXTAUTH_SECRET | SET |
| NEXTAUTH_URL | SET |
| ANTHROPIC_API_KEY | SET (sk-ant-api prefix) |
| ANTHROPIC_MODEL | SET (claude-sonnet-4-5-20250929) |
| ANTHROPIC_MAX_OUTPUT_TOKENS | SET (16384) |
| ONYX_BASE_URL | SET (https://rmoss-onyx.xyz) |
| ONYX_API_URL | SET (https://rmoss-onyx.xyz/api) |
| ONYX_API_KEY | SET |
| CLOUDINARY_CLOUD_NAME | SET (deahtb4kj) |
| CLOUDINARY_API_KEY | SET |
| CLOUDINARY_API_SECRET | SET |

Note: All credentials in .env (root), not .env.local. Prisma and Next.js both read this automatically.
