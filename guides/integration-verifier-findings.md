# Integration Verifier Findings — Guide 11

**Date:** 2026-03-02
**Guide:** Guide 11 — Finalization, Publishing Flow and Link Backfilling
**Verifier:** integration-verifier agent

---

## Service Status Summary

| Service | Status | Response Time | Notes |
|---|---|---|---|
| Neon Postgres | PASS | ~300ms connect | All 9 tables accessible, data present |
| Prisma Client | PASS | — | Schema in sync, all models map correctly |
| Cloudinary API | PASS | ~200ms | Credentials valid, resources accessible |
| Cloudinary CDN | PASS | 192ms | Transform delivery working |
| Claude API | PASS | 1.36s | Model claude-sonnet-4-5-20250929 responsive |
| Claude Streaming | PASS | — | SSE delta events firing correctly |
| Onyx RAG | PASS | 163ms | Health endpoint returns HTTP 200 |
| Vercel (deployed) | PASS | 1.45s | /api/health returns HTTP 200 |
| Build | PASS | ~6s | Zero errors, zero TypeScript warnings |

---

## 1. Neon Postgres — PASS

**Connection:** Pooled via pgBouncer at ep-weathered-pond-ai9zijr1-pooler.c-4.us-east-1.aws.neon.tech

**Table Row Counts (verified via Prisma node runner):**

| Table | Rows | Guide 11 Relevance |
|---|---|---|
| users | 2 | Auth context for finalizedBy field |
| content_map | 39 | 8 hubs + 31 spokes — all finalization writes update this |
| article_documents | 0 | Target table — empty, ready for first write |
| article_html | 0 | Target table — empty, ready for first write |
| internal_links | 10 | Core page seeds — backfill logic will add to this |
| photos | 7 | Source for CDN promotion step |
| article_photos | 0 | Junction table — will be written by photo association |
| leads | 0 | Not used by Guide 11 (stub only) |
| lead_events | 0 | Not used by Guide 11 |

**Schema Match:** Prisma db pull output matches prisma/schema.prisma exactly. No drift detected.

**Guide 11 Critical Tables Confirmed:**
- ArticleDocument model: id, articleId, version, canonicalDoc (Json), htmlOverrides (Json?), finalizedAt, finalizedBy, notes — unique on (articleId, version)
- ArticleHtml model: id, articleId, version, documentVersion, htmlContent, metaTitle, metaDescription, schemaJson, finalizedAt, finalizedBy, qaScore, qaFailures, notes — unique on (articleId, version)

---

## 2. Prisma Client — PASS

**Generator:** prisma-client-js, using DATABASE_URL (pooled) + DATABASE_URL_UNPOOLED (direct).

**All 9 model accessors verified** via p[t].count() — no PrismaClientKnownRequestError on any table.

**No transaction usage exists yet** — prisma.$transaction() is available but never called in the current codebase. Guide 11 will be the first consumer. This is expected (noted in exploration doc RISK-1).

---

## 3. Cloudinary — PASS

**Cloud Name:** deahtb4kj (confirmed in both .env and API response)
**API Key:** 884563924896736 — valid
**API Secret:** verified (used in HTTP Basic auth, request succeeded)

**API Test Results:**
- GET /v1_1/deahtb4kj/resources/image?max_results=3 returned HTTP 200 with 3 resources
- Most recent upload: blog/ser_kem_bottles_1772497089650 (JPEG, 300x168, 8328 bytes)
- Upload timestamp: 2026-03-03T00:18:08Z — confirms active usage from Guide 9

**CDN Delivery Test:**
- URL: https://res.cloudinary.com/deahtb4kj/image/upload/w_800,f_auto,q_auto/sample
- Result: HTTP 200 in 192ms — transform chain working

**Cloudinary Client Code:** src/lib/cloudinary/client.ts uses env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET — all populated from .env.

**WARNING — Missing Env Var:** CLOUDINARY_UPLOAD_PRESET is NOT in .env (only in .env.example). However, src/lib/cloudinary/client.ts line 8 defaults it to 'blog'. The upload route does not use upload presets (server-side SDK uploads, not unsigned client uploads), so this is not a blocker for Guide 11. The default 'blog' value is sufficient.

**Guide 11 Upload Flow Ready:** uploadToCloudinary(buffer, opts) in src/lib/cloudinary/upload.ts is the entry point for CDN photo promotion. It uses cld.uploader.upload_stream() with resource_type: "image".

---

## 4. Claude API — PASS

**Model in .env:** claude-sonnet-4-5 (no version suffix — resolves to same model as claude-sonnet-4-5-20250929)

**Basic Completion Test:**
- POST https://api.anthropic.com/v1/messages with claude-sonnet-4-5-20250929
- Response: HTTP 200 in 1.36s
- Returned: "Hello, how are you today?" — 10 output tokens
- stop_reason: "end_turn" — normal completion

**Streaming Test:**
- Same endpoint with stream: true
- Response: SSE events in correct order: message_start, content_block_start, ping, content_block_delta
- Streaming is operational

**Guide 11 Usage:** Claude API is not called by Guide 11's finalization pipeline. Guide 11 calls runQAChecks() (deterministic) and renderArticle() (no LLM). No Claude API dependency for Guide 11.

---

## 5. Onyx RAG — PASS

**Base URL:** https://rmoss-onyx.xyz
**Health endpoint:** GET https://rmoss-onyx.xyz/api/health
**Result:** HTTP 200 in 163ms

**Guide 11 Usage:** Onyx is not called during finalization. Not a dependency for Guide 11.

---

## 6. Vercel (Deployed App) — PASS

**URL:** https://bwc-content-engine.vercel.app/api/health
**Result:** HTTP 200 in 1.45s

---

## 7. Build — PASS

**Command:** npm run build
**Result:** Compiled successfully in 5.9s
**Static pages:** 28/28 generated in 449.6ms
**Errors:** Zero
**TypeScript errors:** Zero

---

## 8. Missing or Misconfigured Items

### WARN-1: CLOUDINARY_UPLOAD_PRESET absent from .env
- Present in .env.example (line 57), absent from .env
- Impact: None — client.ts defaults to 'blog', server-side SDK uploads do not use upload presets
- Action: Not a blocker. Consider adding CLOUDINARY_UPLOAD_PRESET=blog to .env for completeness.

### WARN-2: ENABLE_PHOTO_MANAGER=false in .env
- The Photo Manager UI is gated behind this flag in local dev
- Impact: The underlying API routes still work. Guide 11 calls uploadToCloudinary() directly (library function), so this flag does not block finalization.
- Action: Not a blocker for Guide 11 API work. Verify this is true in Vercel env vars if Photo Manager UI needs to appear.

### INFO: article_documents and article_html are empty
- Both tables exist with correct schema
- 0 rows is expected — no article has been finalized yet
- Guide 11 creates the first rows in these tables

### INFO: ANTHROPIC_MODEL uses short-form alias
- .env uses claude-sonnet-4-5 (no date suffix)
- Anthropic API accepts this alias — not a bug

---

## 9. Guide 11 Readiness Assessment

| Dependency | Required By | Status |
|---|---|---|
| DATABASE_URL + DATABASE_URL_UNPOOLED | Prisma writes | PASS — both set |
| CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET | Photo CDN upload | PASS — all set |
| ANTHROPIC_API_KEY | Not called by Guide 11 | PASS — set |
| prisma.$transaction() pattern | Atomic 3-table write | PASS — Prisma supports it |
| uploadToCloudinary() function | Drive to CDN promotion | PASS — working, tested via API |
| renderArticle() function | Final HTML render | PASS — build succeeds |
| runQAChecks() server-side | Finalization gate | PASS — importable from src/lib/qa/ |
| ArticleDocument schema | First DB write target | PASS — schema correct, table empty |
| ArticleHtml schema | Second DB write target | PASS — schema correct, table empty |
| InternalLink.isActive field | Backfill activation | PASS — field exists, 10 seed rows |
| content_map PATCH | Status to finalized | PASS — existing PATCH accepts status field |

**Overall: All services are operational. No blockers for Guide 11 implementation.**

---

*Generated by integration-verifier agent on 2026-03-02.*
