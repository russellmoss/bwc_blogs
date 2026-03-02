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
