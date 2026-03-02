# Exploration Results — Guide 2: Content Map — CSV Import, CRUD API, Seed Data

**Generated:** 2026-03-01
**Previous guide completed:** Guide 1 (Foundation)
**Next guide:** Guide 2
**Agents used:** code-inspector, integration-verifier, pattern-finder

---

## 1. Current Build State

### Guides Complete
- **Guide 1: Foundation** — DB schema, Prisma, Auth, agent-guard, scaffold, CLAUDE.md

### Inventory Summary

| Category | Count | Details |
|---|---|---|
| Prisma models | 9 | User, ContentMap, ArticleDocument, ArticleHtml, InternalLink, Photo, ArticlePhoto, Lead, LeadEvent |
| API routes | 4 | /api/health (GET), /api/auth/[...nextauth] (GET, POST), /api/users (GET, POST), /api/users/[id] (GET, PATCH, DELETE) |
| Type modules | 9 | auth, content-map, article, renderer, qa, onyx, claude, photo, api — all re-exported from index.ts |
| Lib modules | 7 | db/index, db/retry, auth/config, auth/session, auth/password, env, config/site + 3 config stubs (onyx, claude, cloudinary) |
| Components | 0 | None yet (Guide 6+) |
| DB rows | 1 | 1 admin user seeded. All other tables at 0 rows. |

### Integration Health

| Service | Status | Notes |
|---|---|---|
| Neon Postgres | ✅ Verified | All 9 tables exist, connection confirmed |
| Next.js Build | ✅ Verified | Compiled in 6.2s, zero errors |
| Vercel Health | ✅ Verified | /api/health returns 200 in ~1s |
| Auth System | ✅ Verified | NextAuth configured, login page renders, admin seeded |
| Onyx CE | ⏭️ Skipped | Not needed for Guide 2 |
| Claude API | ⏭️ Skipped | Not needed for Guide 2 |
| Cloudinary | ⏭️ Skipped | Not needed for Guide 2 |

---

## 2. Next Guide Target

### Guide 2: Content Map — CSV Import, CRUD API, Seed Data

**From orchestration doc §7 (lines 690–712):**

> What it builds: The Content Map management layer — importing the CSV into the `content_map` table, CRUD API routes, core page registry seeding, and the internal link seed data.

**Produces:**
- `src/app/api/content-map/route.ts` — GET (list all), POST (create one)
- `src/app/api/content-map/[id]/route.ts` — GET, PATCH, DELETE
- `src/app/api/content-map/import/route.ts` — POST (CSV import)
- `src/lib/content-map/` — import logic, slug generation, CRUD helpers
- `prisma/seed.ts` — extended with CSV import + core page seeding
- `scripts/test-guide-2.ts`

**Integration gate:** 39 rows in `content_map`. Core pages in `internal_links`. CRUD endpoints work.

**Human gate:** API returns correct data for test queries.

**Relevant architecture doc sections:**
- §3B (lines 359–511): Content Map & Blog Registry schema, core page registry, CSV column mapping
- Appendix B (lines 1365–1381): Core page seed data (10 BWC URLs)
- Appendix C (lines 1385–1409): CSV column → DB column mapping with transforms

**File ownership (§5E):** Guide 2 owns `src/app/api/content-map/`, `src/lib/content-map/`, `prisma/seed.ts` (content map portion)

---

## 3. Dependencies Satisfied

### Prisma Schema — ✅ COMPLETE
- `ContentMap` model: all 24 fields present (26 including id and relations). Field-level verification passed.
- `InternalLink` model: all 6 fields present (8 including id and timestamps). Field-level verification passed.
- All 9 models exist in `prisma/schema.prisma`. Tables pushed to Neon. No migrations directory.

### TypeScript Types — ✅ COMPLETE (minor gaps)
- `ContentMapEntry` in `src/types/content-map.ts`: 23 fields present
- `ArticleType`: `"hub" | "spoke" | "news"` ✅
- `ArticleStatus`: `"planned" | "drafting" | "finalized" | "published" | "needs_update"` ✅
- `ApiResponse`, `ApiSuccess`, `ApiError`, `ErrorCode` in `src/types/api.ts` ✅
- Barrel export in `src/types/index.ts` re-exports all 9 modules ✅

### Auth Helpers — ✅ COMPLETE
- `requireAuth()` — throws `AUTH_REQUIRED` if no session
- `requireRole(...roles)` — throws `AUTH_FORBIDDEN` if role not in list
- Both in `src/lib/auth/session.ts`, working as expected

### DB Client — ✅ COMPLETE
- `prisma` singleton in `src/lib/db/index.ts`
- `retryDatabaseOperation` in `src/lib/db/retry.ts` (used for auth only, not CRUD)

### Database State — ✅ CLEAN
- `content_map`: 0 rows (ready for Guide 2 to seed)
- `internal_links`: 0 rows (ready for core page seeding)
- `users`: 1 row (admin user seeded by Guide 1)

---

## 4. Dependencies Missing or Mismatched

### ⚠️ NPM Package Missing: `papaparse`
- **Impact:** Blocks the CSV import route (`/api/content-map/import`)
- **Fix:** `npm install papaparse && npm install -D @types/papaparse`
- **Must be done** before implementing the import endpoint

### Minor Type Gaps (non-blocking)

| Gap | Severity | Action |
|---|---|---|
| `ContentMapEntry` missing `createdAt` and `updatedAt` | LOW | Add to `src/types/content-map.ts` |
| No `InternalLinkEntry` TypeScript interface | LOW | Create in `src/types/content-map.ts` if Guide 2 returns internal link data |

### No Other Deviations
- All file paths match orchestration doc predictions
- No broken imports anywhere in codebase
- No type mismatches between Prisma models and TypeScript interfaces beyond the noted timestamp omission

---

## 5. Established Patterns to Follow

### API Route Handler Template
*(Exact code from `src/app/api/users/route.ts`)*

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const CreateResourceSchema = z.object({
  // fields...
});

export async function GET() {
  try {
    await requireRole("admin", "editor");  // or requireAuth()
    const items = await prisma.contentMap.findMany({
      select: { /* explicit fields */ },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    // standard catch block (see below)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const parsed = CreateResourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    const result = await prisma.contentMap.create({
      data: { /* from parsed.data */ },
      select: { /* explicit fields */ },
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    // standard catch block
  }
}
```

### Standard Catch Block (copy-identical across all routes)
```ts
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
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message } },
    { status: 500 }
  );
}
```

### Dynamic Route [id] Parameter Pattern (Next.js 15)
```ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor");
    const { id } = await params;
    const item = await prisma.contentMap.findUnique({
      where: { id: parseInt(id, 10) },
      select: { /* fields */ },
    });
    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Content map entry not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    // standard catch block
  }
}
```

### Zod Schema Pattern
- Naming: `[Action][Resource]Schema` (e.g., `CreateContentMapSchema`, `UpdateContentMapSchema`)
- Defined inline at top of route file, NOT in separate files
- Always `.safeParse()`, never `.parse()`
- `parsed.error.flatten()` for details on validation failure

### Prisma Query Pattern
- Always use `select` — never return full records
- Integer IDs: `parseInt(id, 10)`
- Import from `@/lib/db`, never from `@prisma/client` directly
- No retry wrapper for CRUD routes (retry only used for auth login)

### Seed Script Pattern
```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Existing admin user upsert...
  // Guide 2 adds: content map upserts + core page inserts
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```
- Uses local `new PrismaClient()` (not the singleton)
- Idempotency via `upsert`
- Environment variable fallbacks

### Response Format
| Scenario | HTTP Status | Body Shape |
|---|---|---|
| Success (GET/PATCH/DELETE) | 200 | `{ success: true, data: T }` |
| Success (POST create) | 201 | `{ success: true, data: T }` |
| Validation error | 400 | `{ success: false, error: { code: "VALIDATION_ERROR", message, details } }` |
| Not authenticated | 401 | `{ success: false, error: { code: "AUTH_REQUIRED", message } }` |
| Not authorized | 403 | `{ success: false, error: { code: "AUTH_FORBIDDEN", message } }` |
| Not found | 404 | `{ success: false, error: { code: "NOT_FOUND", message } }` |
| Duplicate/conflict | 409 | `{ success: false, error: { code: "VALIDATION_ERROR", message } }` |
| Server error | 500 | `{ success: false, error: { code: "INTERNAL_ERROR", message } }` |

---

## 6. Integration Readiness

| External Service | Guide 2 Needs It? | Status |
|---|---|---|
| Neon Postgres | ✅ YES | ✅ Verified — 9 tables, 1 admin user, 0 content_map rows |
| NextAuth | ✅ YES (route protection) | ✅ Verified — auth configured and working |
| Onyx CE | ❌ No | Skipped |
| Claude API | ❌ No | Skipped |
| Cloudinary | ❌ No | Skipped |

No known quirks for Guide 2's services. Neon connection is stable, Prisma client is working.

---

## 7. Risks and Blockers

### Blocker: `papaparse` not installed
- **Severity:** BLOCKS CSV import feature
- **Fix:** `npm install papaparse && npm install -D @types/papaparse`
- **When:** Must be done as the first step of Guide 2

### Risk: Slug uniqueness collisions
- Prisma schema has `slug String? @unique` on ContentMap
- CSV data has 39 rows — some could generate similar slugs
- **Mitigation:** Slug generation must handle collisions (append `-2`, `-3` suffix)

### Risk: Parent hub ID assignment ordering
- Spoke articles reference their hub's `parent_hub_id`
- Hub articles must be inserted FIRST to get their IDs before spokes can reference them
- **Mitigation:** Import logic must process hubs first, then spokes with FK assignment

### Risk: CSV parsing edge cases
- CSV has semicolon-delimited arrays within cells (keywords, links)
- Some cells contain commas within values (e.g., content notes)
- **Mitigation:** PapaParse handles quoted CSV cells; semicolon splitting needs explicit handling

### Non-blocking Deprecation Warnings
- `package.json#prisma` seed config deprecated in Prisma 7 — migrate to `prisma.config.ts` before upgrading
- `middleware.ts` convention deprecated in Next.js 16 — rename to `proxy` if upgrading
- Neither impacts Guide 2 execution

---

## 8. Deviations from Plan

**No significant deviations found.** The codebase matches the orchestration doc's predictions:

- All file paths are where expected
- All Prisma models have the expected fields
- All TypeScript types match the shared contracts
- All API routes follow the predicted patterns
- No migration files exist (using `prisma db push` as noted)

Minor deviations:
- `ContentMapEntry` TypeScript interface omits `createdAt`/`updatedAt` (Prisma model has them) — trivial fix
- `UserRole` is duplicated in `src/types/auth.ts` and `src/lib/auth/session.ts` — pre-existing, not caused by Guide 1 drift
- No `InternalLinkEntry` TypeScript interface — may need to create one if Guide 2 returns link data from API

---

## 9. CSV Data Summary

**Source file:** `BWC content (hubs and spokes) - bhutan-winery-seo-content-map.csv` (in Downloads folder)
**Rows:** 39 (7 hubs + 32 spokes)
**Columns:** 10

### Hub Distribution

| Hub | Spokes | Total |
|---|---|---|
| The Complete Guide to Bhutan Wine | 6 | 7 |
| Emerging Wine Regions | 4 | 5 |
| High-Altitude Viticulture | 3 | 4 |
| The Art of Sustainable Winemaking | 4 | 5 |
| The Ultimate Guide to Luxury Travel in Bhutan | 5 | 6 |
| The Story of Wine in Bhutan | 4 | 5 |
| Wine Tourism Beyond Europe | 2 | 3 |
| Bhutan: The World's Most Exclusive Travel Destination | 3 | 4 |
| **Total** | **31** | **39** |

### CSV Column → DB Column Mapping (from Appendix C)

| CSV Column | DB Column | Transform |
|---|---|---|
| Hub Article | hubName | Direct |
| Article Type | articleType | Lowercase: "Hub" → "hub", "Spoke" → "spoke" |
| Spoke Article Title | title | Use this if present; else use Hub Article as title |
| Target Keywords | targetKeywords | Split on `;`, trim → String[] |
| Search Volume Est. | searchVolumeEst | Map "Low"→100, "Medium"→500, "High"→2000 |
| Difficulty | keywordDifficulty | Lowercase |
| Target Audience | targetAudience | Direct |
| Internal Links To | internalLinksTo | Split on `;`, trim → String[] |
| Suggested External Source Links | suggestedExternalLinks | Split on `;`, trim → String[] |
| Content Notes | contentNotes | Direct |

### Derived columns
- `slug`: Generated from title (lowercase, hyphenated, stop words removed, 3–6 words)
- `mainEntity`: First target keyword
- `supportingEntities`: Remaining target keywords
- `parentHubId`: FK to matching hub row (null for hubs)
- `status`: "planned"
- `source`: "engine"

### Core Pages to Seed (10 entries in `internal_links`)

```
https://www.bhutanwine.com/the-grapes-vineyards
https://www.bhutanwine.com/our-wine
https://www.bhutanwine.com/our-wine-2023-first-barrel
https://www.bhutanwine.com/first-release
https://www.bhutanwine.com/visit-us
https://www.bhutanwine.com/about-us
https://www.bhutanwine.com/in-the-news
https://www.bhutanwine.com/gallery
https://www.bhutanwine.com/2024-inquiry-request
https://www.bhutanwine.com/contact-us
```
