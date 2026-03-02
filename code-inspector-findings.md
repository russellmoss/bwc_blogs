# Code Inspector Findings - Guide 2 Readiness
Generated: 2026-03-01
Inspector: Code Inspector Agent
Scope: Guide 2 - Content Map: CSV Import, CRUD API, Seed Data

---

## 1. Schema State (Prisma Models Inventory)

File: prisma/schema.prisma

### Models Present (9 total)

| Model | Table | Fields | Notes |
|---|---|---|---|
| User | users | 8 | Role as String |
| ContentMap | content_map | 26 | All spec fields + relations |
| ArticleDocument | article_documents | 9 | |
| ArticleHtml | article_html | 12 | |
| InternalLink | internal_links | 8 | |
| Photo | photos | 17 | |
| ArticlePhoto | article_photos | 3 | Join table |
| Lead | leads | 16 | |
| LeadEvent | lead_events | 6 | |

All 9 models from orchestration spec are present.
### ContentMap Field Check - All 24 fields confirmed present

| Expected Field | Present | Prisma camelCase | Type |
|---|---|---|---|
| hub_name | YES | hubName | String |
| article_type | YES | articleType | String |
| title | YES | title | String |
| slug | YES | slug | String? unique |
| main_entity | YES | mainEntity | String |
| supporting_entities | YES | supportingEntities | String[] |
| target_keywords | YES | targetKeywords | String[] |
| search_volume_est | YES | searchVolumeEst | Int? |
| keyword_difficulty | YES | keywordDifficulty | String? |
| target_audience | YES | targetAudience | String? |
| status | YES | status | String default planned |
| scheduled_date | YES | scheduledDate | DateTime? date |
| published_date | YES | publishedDate | DateTime? date |
| published_url | YES | publishedUrl | String? |
| parent_hub_id | YES | parentHubId | Int? |
| content_notes | YES | contentNotes | String? |
| suggested_external_links | YES | suggestedExternalLinks | String[] |
| internal_links_to | YES | internalLinksTo | String[] |
| word_count | YES | wordCount | Int? |
| qa_score | YES | qaScore | String? |
| author_name | YES | authorName | String? |
| source | YES | source | String default engine |
| created_at | YES | createdAt | DateTime auto |
| updated_at | YES | updatedAt | DateTime auto |

RESULT: ContentMap model is complete. All 24 expected fields are present.

### InternalLink Field Check - All 6 fields confirmed present

| Expected Field | Present | Prisma camelCase | Type |
|---|---|---|---|
| source_article | YES | sourceArticleId | Int? |
| target_article | YES | targetArticleId | Int? |
| target_core_page | YES | targetCorePage | String? |
| anchor_text | YES | anchorText | String? |
| link_type | YES | linkType | String? |
| is_active | YES | isActive | Boolean default false |

RESULT: InternalLink model is complete. All 6 expected fields are present.

---
## 2. Type State (TypeScript Interfaces)

### src/types/content-map.ts

Exports:
- ArticleType: union hub | spoke | news
- ArticleStatus: union planned | drafting | finalized | published | needs_update
- ContentMapEntry: 23 fields
  id, hubName, articleType, title, slug, mainEntity, supportingEntities,
  targetKeywords, searchVolumeEst, keywordDifficulty, targetAudience, status,
  scheduledDate, publishedDate, publishedUrl, parentHubId, contentNotes,
  suggestedExternalLinks, internalLinksTo, wordCount, qaScore, authorName, source

TYPE GAP: ContentMapEntry MISSING createdAt and updatedAt.
The Prisma ContentMap model has both. The TypeScript interface omits them.

### src/types/api.ts

Exports: ApiSuccess, ApiError, ApiResponse, ErrorCode (11 codes)
- ApiSuccess: { success: true; data: T }
- ApiError: { success: false; error: { code: string; message: string; details?: unknown } }
- ErrorCode values: AUTH_REQUIRED, AUTH_FORBIDDEN, VALIDATION_ERROR, NOT_FOUND,
  GENERATION_FAILED, ONYX_UNAVAILABLE, RENDER_ERROR, QA_GATE_FAILED,
  CLOUDINARY_ERROR, LINK_VERIFICATION_FAILED, INTERNAL_ERROR

RESULT: api.ts is complete. Response format matches all existing route handlers.

### src/types/auth.ts

- UserRole: union admin | editor | viewer
- User: 7 fields (id, email, name, role, isActive, createdAt, updatedAt)

### src/types/article.ts (23 exports)

CanonicalArticleDocument (17 fields), AuthorInfo (4), ArticleSection (4),
ContentNodeType union, ContentNodeBase (2), ParagraphNode, ImageNode, PullQuoteNode,
KeyFactsNode, TableNode, ListNode, CalloutNode, ContentNode union, ImagePlacement (7),
TrustTier, InternalLinkRef (6), ExternalLinkRef (5), FAQItem (2), SchemaFlags (3), CaptureType union.

### src/types/renderer.ts

HtmlOverride (3 fields), RendererInput (3 fields), RendererOutput (5 fields)

### src/types/qa.ts

CheckSeverity, QACheck (6 fields), QAResult (6 fields), QAScore (7 fields)

### src/types/onyx.ts

OnyxSearchResult (5), OnyxContext (4), OnyxHealthStatus (4)

### src/types/claude.ts

ConversationMessage (3), PromptLayer (3), GenerationRequest (4), GenerationResponse (4), WebSearchResult (3)

### src/types/photo.ts

Photo (17 fields), PhotoManifest (3 fields), CloudinaryTransform (4 fields)

### src/types/index.ts

Re-exports all 9 type modules via export *

### Type Mismatches Summary

| Issue | Severity |
|---|---|
| ContentMapEntry missing createdAt | LOW - Prisma has it; TS interface omits it |
| ContentMapEntry missing updatedAt | LOW - Prisma has it; TS interface omits it |
| No InternalLinkEntry TypeScript interface | LOW - Prisma model exists, no TS counterpart |

---
## 3. API Route State

Routes found via glob src/app/api/**/route.ts:

| Route | Methods | Auth | File |
|---|---|---|---|
| /api/health | GET | None (public) | src/app/api/health/route.ts |
| /api/auth/[...nextauth] | GET, POST | NextAuth handler | src/app/api/auth/[...nextauth]/route.ts |
| /api/users | GET, POST | requireRole(admin) | src/app/api/users/route.ts |
| /api/users/[id] | GET, PATCH, DELETE | requireRole(admin) | src/app/api/users/[id]/route.ts |

### Missing Routes for Guide 2

| Route | Expected File | Status |
|---|---|---|
| GET, POST /api/content-map | src/app/api/content-map/route.ts | MISSING |
| GET, PATCH, DELETE /api/content-map/[id] | src/app/api/content-map/[id]/route.ts | MISSING |
| POST /api/content-map/import | src/app/api/content-map/import/route.ts | MISSING |

---

## 4. Library Module State

### src/lib/ Directory Inventory

| Module Path | Public Exports |
|---|---|
| src/lib/db/index.ts | prisma (PrismaClient singleton, dev-cached on globalThis) |
| src/lib/db/retry.ts | retryDatabaseOperation (maxRetries=3, baseDelay=500ms, exponential backoff) |
| src/lib/auth/config.ts | authOptions (CredentialsProvider, JWT strategy, 30d sessions) |
| src/lib/auth/session.ts | UserRole, SessionUser, getSession, getCurrentUser, requireAuth, requireRole |
| src/lib/auth/password.ts | hashPassword, verifyPassword, validatePassword |
| src/lib/env.ts | env object with all service config (DB, Auth, Anthropic, Onyx, Cloudinary, BWC) |
| src/lib/onyx/client.ts | onyxConfig (apiUrl, apiKey) |
| src/lib/claude/client.ts | claudeConfig (apiKey, model) |
| src/lib/cloudinary/client.ts | cloudinaryConfig (url, cloudName, uploadPreset) |

### Missing Modules for Guide 2

| Module | Status |
|---|---|
| src/lib/content-map/ (entire directory) | MISSING |
| src/lib/content-map/crud.ts | MISSING |
| src/lib/content-map/import.ts | MISSING |
| src/lib/content-map/slug.ts | MISSING |

---
## 5. Seed Script State

File: prisma/seed.ts

Current behavior:
- Seeds one admin user via prisma.user.upsert
- Reads ADMIN_EMAIL (default: russell@bhutanwine.com), ADMIN_NAME, ADMIN_PASSWORD from env
- No ContentMap records seeded
- No CSV import logic present
- No core page entries
- package.json seed command: tsx prisma/seed.ts

Missing for Guide 2:
- CSV parsing and batch import of content map rows
- Core page content_map seeding (hub articles, static BWC page targets)
- InternalLink seeding

---

## 6. Dependency Check

papaparse: NOT PRESENT in package.json

Current production deps:
  @prisma/client ^6.19.2, bcryptjs ^3.0.3, dotenv ^17.3.1, next 16.1.6,
  next-auth ^4.24.13, prisma ^6.19.2, react 19.2.3, react-dom 19.2.3, zod ^4.3.6

Action required before writing import route:
  npm install papaparse
  npm install -D @types/papaparse

| Package | Present | Notes |
|---|---|---|
| zod | YES ^4.3.6 | Available for CSV row Zod schema validation |
| tsx | YES ^4.21.0 dev | Used by seed script runner |
| papaparse | NO | Must install before import route |
| @types/papaparse | NO | Must install as devDependency |

---

## 7. Broken Import Analysis

| File | Import Path | Resolves? |
|---|---|---|
| src/types/article.ts:1 | ./content-map | YES |
| src/types/renderer.ts:1 | ./article | YES |
| src/types/claude.ts:1 | ./article | YES |
| src/app/api/users/route.ts | @/lib/db, @/lib/auth/session, @/lib/auth/password | YES |
| src/app/api/users/[id]/route.ts | @/lib/db, @/lib/auth/session, @/lib/auth/password | YES |
| src/app/api/auth/[...nextauth]/route.ts | @/lib/auth/config | YES |
| src/lib/auth/config.ts | @/lib/db, @/lib/db/retry, ./password | YES |

RESULT: No broken imports. All import chains resolve correctly.

---
## 8. Established Patterns for Guide 2 to Follow

### Route Handler Pattern (from src/app/api/users/route.ts)

Structure:
  1. Import NextRequest, NextResponse from next/server
  2. Import prisma from @/lib/db
  3. Import requireRole from @/lib/auth/session
  4. Import z from zod
  5. Define Zod schema at module top level
  6. Wrap all logic in try/catch
  7. Error string matching: AUTH_REQUIRED -> 401, AUTH_FORBIDDEN -> 403, else 500
  8. Success: { success: true, data: result }
  9. Error: { success: false, error: { code, message } }

### Dynamic Route Params Pattern (Next.js 15 App Router)

  params is Promise<{ id: string }> and MUST be awaited.
  Confirmed at: src/app/api/users/[id]/route.ts lines 17-21

  export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params;
  }

### Zod Validation Pattern

  Use Schema.safeParse(body) - never .parse()
  On failure: 400 with code VALIDATION_ERROR, details: parsed.error.flatten()

### Recommended Auth for content-map routes

  GET: requireRole(admin, editor, viewer) or requireAuth()
  POST, PATCH: requireRole(admin, editor)
  DELETE: requireRole(admin)

---
## 9. Migrations State

No migration files exist. prisma/migrations/ directory does not exist.
Schema is fully defined in prisma/schema.prisma but no migration history.
Tables were likely pushed with prisma db push.

Guide 2 action: Run npx prisma migrate dev --name init if starting fresh,
or npx prisma db push to sync schema to Neon without migration files.

---

## 10. Gap Analysis vs. Orchestration Doc (Guide 2 Scope)

| Item | Required | Exists | Status |
|---|---|---|---|
| Prisma ContentMap model | YES | YES | Complete |
| Prisma InternalLink model | YES | YES | Complete |
| ContentMapEntry TypeScript type | YES | YES | Minor gap: missing timestamps |
| ArticleType / ArticleStatus types | YES | YES | Complete |
| ApiResponse format | YES | YES | Complete |
| requireAuth / requireRole helpers | YES | YES | Complete |
| DB client (prisma singleton) | YES | YES | Complete |
| /api/content-map route | YES | NO | MISSING |
| /api/content-map/[id] route | YES | NO | MISSING |
| /api/content-map/import route | YES | NO | MISSING |
| src/lib/content-map/ module | YES | NO | MISSING |
| papaparse npm package | YES | NO | NOT INSTALLED |
| Extended prisma/seed.ts | YES | PARTIAL | Only admin user seeded |
| scripts/test-guide-2.ts | YES | NO | MISSING |

---

## 11. Recommendations for Guide 2

1. Install papaparse before writing the import route:
   npm install papaparse
   npm install -D @types/papaparse

2. Create src/lib/content-map/ with three files:
   - crud.ts: listContentMap(), getContentMapEntry(), createContentMapEntry(),
     updateContentMapEntry(), deleteContentMapEntry()
   - import.ts: parseCSV(), validateCSVRow(), importCSVToDatabase()
   - slug.ts: generateSlug(title), ensureUniqueSlug(slug, prisma)

3. Follow users/[id]/route.ts patterns exactly for all route handlers.
   Dynamic route params (Promise<{id}>) must be awaited.

4. Extend prisma/seed.ts rather than replacing it.
   Add ContentMap core page entries after the existing admin upsert block.

5. Add createdAt and updatedAt to ContentMapEntry in src/types/content-map.ts.

6. Add InternalLinkEntry interface in src/types/content-map.ts
   to provide a TypeScript type for the Prisma InternalLink model.

7. Slug uniqueness: @unique in Prisma schema requires collision handling
   in slug generation (append -2, -3 suffix as needed).

---

## Summary

| Category | Status |
|---|---|
| Prisma schema (all 9 models) | COMPLETE |
| TypeScript types (all 9 modules) | COMPLETE - minor gap: ContentMapEntry missing timestamps |
| Auth library (requireAuth, requireRole) | COMPLETE |
| DB client + retry wrapper | COMPLETE |
| Existing routes (health, auth, users) | COMPLETE |
| Content-map API routes | MISSING - 3 route files needed |
| Content-map lib module | MISSING - entire directory |
| Seed script (admin user) | COMPLETE |
| Seed script (content map data) | MISSING |
| papaparse dependency | NOT INSTALLED |
| Broken imports | NONE |
| Test script (test-guide-2.ts) | MISSING |

Guide 2 can proceed. All Guide 1 foundation dependencies are satisfied.
Two npm packages need installation (papaparse + @types/papaparse),
three route files need creation, one lib module directory needs creation,
and the seed script needs extension.
