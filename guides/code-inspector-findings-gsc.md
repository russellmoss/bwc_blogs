# Code Inspector Findings - SEO Intelligence Layer (GSC Guide)

Generated: 2026-03-05
Inspector: Claude Sonnet 4.6

---

## 1. content_map Prisma Model

**File:** prisma/schema.prisma, lines 51-89

### Primary Key

- Field: id
- Type: Int @id @default(autoincrement()) - auto-incrementing integer, NOT a UUID.

### All Fields (exact names, types, nullability)

| Prisma Field Name | DB Column (@map) | Type | Nullable | Notes |
|---|---|---|---|---|
| id | id | Int | no | PK, autoincrement |
| hubName | hub_name | String | no | |
| articleType | article_type | String | no | hub or spoke or news |
| title | title | String | no | |
| slug | slug | String? | yes | @unique |
| mainEntity | main_entity | String | no | |
| supportingEntities | supporting_entities | String[] | no | Postgres array |
| targetKeywords | target_keywords | String[] | no | Postgres array |
| searchVolumeEst | search_volume_est | Int? | yes | |
| keywordDifficulty | keyword_difficulty | String? | yes | |
| targetAudience | target_audience | String? | yes | |
| status | status | String | no | default planned; planned/drafting/finalized/published/needs_update |
| scheduledDate | scheduled_date | DateTime? | yes | @db.Date |
| publishedDate | published_date | DateTime? | yes | @db.Date |
| publishedUrl | published_url | String? | yes | |
| parentHubId | parent_hub_id | Int? | yes | FK to self (hubs) |
| contentNotes | content_notes | String? | yes | |
| suggestedExternalLinks | suggested_external_links | String[] | no | Postgres array |
| internalLinksTo | internal_links_to | String[] | no | Postgres array |
| wordCount | word_count | Int? | yes | |
| qaScore | qa_score | String? | yes | e.g. 48/52 |
| authorName | author_name | String? | yes | |
| source | source | String | no | default engine; engine or external |
| createdAt | created_at | DateTime | no | @default(now()) |
| updatedAt | updated_at | DateTime | no | @default(now()) @updatedAt |

### Self-Relation (Hub-to-Spoke hierarchy)

The ContentMap model has a self-referential relation:

    parentHub  ContentMap?  @relation(HubSpokes, fields: [parentHubId], references: [id])
    spokes     ContentMap[] @relation(HubSpokes)

### Other Relations on ContentMap

- articleDocuments ArticleDocument[] - finalized canonical docs
- articleHtmls     ArticleHtml[] - finalized HTML versions
- sourceLinks      InternalLink[] via relation SourceArticle
- targetLinks      InternalLink[] via relation TargetArticle
- articlePhotos    ArticlePhoto[]
- leads            Lead[]

### Table Name

@@map("content_map")

### TypeScript Mirror

The ContentMapEntry interface in src/types/content-map.ts is a faithful mirror of all ContentMap fields (24 fields). The new article_performance table should use contentMapId Int @map("content_map_id") as its FK column name, following the established convention: camelCase Prisma field, snake_case DB column via @map.

---


## 2. Dashboard Structure

### Navigation Architecture

The app uses Next.js App Router file-based routing for top-level navigation. There is NO tab bar component - each tab is its own Next.js page under src/app/dashboard/.

| Route | Page File | Purpose |
|---|---|---|
| /dashboard | src/app/dashboard/page.tsx | Composer (chat + preview split pane) |
| /dashboard/content-map | src/app/dashboard/content-map/page.tsx | Content map table/hub view |
| /dashboard/photos | src/app/dashboard/photos/page.tsx | Photo manager |
| /dashboard/settings | src/app/dashboard/settings/page.tsx | Settings |
| /dashboard/get-started | src/app/dashboard/get-started/page.tsx | Documentation / onboarding |

### Tab Bar Component: AppShell

**File:** src/components/layout/AppShell.tsx

Navigation tabs are rendered as Link elements inside the shared AppShell header. Active state is driven by usePathname(). New tabs MUST be added here.

Current nav items (AppShell lines 139-235):
- Composer -> /dashboard (PenTool icon)
- Content Map -> /dashboard/content-map (LayoutGrid icon)
- Photos -> /dashboard/photos (Image icon)
- Get Started -> /dashboard/get-started (BookOpen icon, pill button styling - visually distinct)
- Source Drive -> external URL (conditional on NEXT_PUBLIC_GOOGLE_DRIVE_PHOTOS_FOLDER_URL env var)

**Pattern to follow for the Intelligence tab:**
1. Add isIntelligence = pathname === "/dashboard/intelligence" near lines 139-142 in AppShell.tsx
2. Add a Link href="/dashboard/intelligence" with Lucide icon (TrendingUp or BarChart2)
3. Create src/app/dashboard/intelligence/page.tsx

Active link style: { color: "#bc9b5d", fontWeight: 600 }
Inactive link style: { color: "#414141", fontWeight: 400 }

### Dashboard Layout

src/app/dashboard/layout.tsx - Server component. Calls getCurrentUser(), redirects to /login if unauthenticated. Wraps children in DashboardProviders. No changes needed.
src/app/dashboard/providers.tsx - Client providers (SessionProvider, etc.). No changes needed.

### Component Inventory: src/components/dashboard/

| File | Purpose |
|---|---|
| ContentMapDashboard.tsx | Main content map page; reads from useDashboardStore |
| TableView.tsx | Tabular article list |
| HubView.tsx | Hub-grouped article view |
| ArticleDetailPanel.tsx | Slide-in detail panel |
| FilterBar.tsx | Filter controls (hubName, articleType, status, search) |
| StatusBadge.tsx | Color-coded status pill |
| CreateArticleModal.tsx | Create new content map entry modal |
| CSVImportModal.tsx | CSV bulk import modal |
| index.ts | Re-exports ContentMapDashboard |

Intelligence dashboard panels should go in a new src/components/intelligence/ subdirectory, not src/components/dashboard/.

---

## 3. Existing Cron Job Patterns

### /api/cron/ directory: DOES NOT EXIST

Glob of src/app/api/cron/** returned no files. There are zero existing cron routes in the codebase. The guide is building this pattern from scratch.

### CRON_SECRET env var: DEFINED but never consumed in src/

The variable exists in .env.example (line 71: CRON_SECRET=generate-a-random-secret) but no file in src/ reads it. The guard code must be written from scratch.

### Cron Auth Pattern to Implement

In the cron route, check the Authorization header against the CRON_SECRET env var:

    // src/app/api/cron/gsc-sync/route.ts
    import { NextRequest, NextResponse } from next/server;
    
    export async function GET(request: NextRequest) {
      const authHeader = request.headers.get(authorization);
      if (authHeader !== Bearer + process.env.CRON_SECRET) {
        return NextResponse.json({ error: Unauthorized }, { status: 401 });
      }
      // ... cron logic
    }

Vercel automatically injects the Authorization: Bearer CRON_SECRET header when it invokes a cron route.

### Vercel Cron Configuration

**File:** vercel.json - Current contents:

    {
      framework: nextjs,
      buildCommand: npm run build,
      installCommand: npm install,
      regions: [iad1]
    }

There is NO crons key. The guide must add one:

    {
      framework: nextjs,
      buildCommand: npm run build,
      installCommand: npm install,
      regions: [iad1],
      crons: [
        {
          path: /api/cron/gsc-sync,
          schedule: 0 6 * * *
        }
      ]
    }

Note: 0 6 * * * = daily at 6:00 AM UTC = 12:00 PM Bhutan Standard Time (UTC+6).

### Auth Pattern in Existing API Routes

All browser-facing protected routes use requireAuth() from src/lib/auth/session.ts, which calls getServerSession(authOptions). Cron routes cannot use session auth (no browser session), so they use the CRON_SECRET bearer token exclusively.

---

## 4. Zustand Stores

### Store Inventory (exhaustive - only 2 stores exist in the entire codebase)

| File | Exported Hook | Type Signature |
|---|---|---|
| src/lib/store/article-store.ts | useArticleStore | create<ArticleEditorState & ArticleEditorActions> |
| src/lib/store/dashboard-store.ts | useDashboardStore | create<DashboardStoreState & DashboardStoreActions> |

Both stores follow the same pattern: a flat state + actions object passed to create() from zustand, no immer or devtools middleware.

### useArticleStore - src/lib/store/article-store.ts

Manages the full article editor session. Key fields relevant to the Intelligence guide:
- selectedArticleId: number | null - the article open in Composer
- selectedArticle: ContentMapEntry | null - full content map row
- pendingChatMessage: string - pre-populated message for the chat input (ALREADY EXISTS in state)
- setPendingChatMessage: (message: string) => void - action to pre-load a prompt (ALREADY EXISTS as action)

Both pendingChatMessage and setPendingChatMessage are already wired into the ChatPanel component. Setting the pending message before navigating to the Composer will pre-populate the chat input automatically. No changes to article-store.ts are needed.

### useDashboardStore - src/lib/store/dashboard-store.ts

Manages the Content Map dashboard: article list, filters, sort, view mode, detail panel, multi-select.
Also exports pure utility functions: getFilteredArticles(), getSortedArticles(), getUniqueHubNames(), getDetailArticle().

### Where to Put Recommendation Queue State

**Recommended: Create src/lib/store/intelligence-store.ts as a new Zustand store.** This follows the one-store-per-domain pattern established by the two existing stores.

Proposed state shape:
- performanceData: PerformanceWithContentMap[]
- recommendations: ContentRecommendation[]
- isLoadingPerformance: boolean
- isLoadingRecommendations: boolean
- lastSyncedAt: string | null

Proposed actions:
- fetchPerformance: () => Promise<void>
- fetchRecommendations: () => Promise<void>
- approveRecommendation: (id: number) => Promise<void>
- dismissRecommendation: (id: number) => Promise<void>

### Human Approval Gate Integration

When a recommendation is approved, execute in order:
1. useArticleStore.getState().setSelectedArticle(article) - sets the target article in Composer context
2. useArticleStore.getState().setPendingChatMessage(recommendation.suggestedPrompt) - pre-loads the prompt
3. router.push("/dashboard") - navigates to the Composer

Both setSelectedArticle and setPendingChatMessage already exist in useArticleStore. No changes to article-store.ts are needed.

---

## 5. TypeScript Types in src/types/

### File Inventory with All Exported Types

**src/types/content-map.ts** (4 exports)
- ArticleType - type alias: hub or spoke or news
- ArticleStatus - type alias: planned or drafting or finalized or published or needs_update
- ContentMapEntry - interface, 24 fields, faithful mirror of ContentMap Prisma model
- InternalLinkEntry - interface, 7 fields

**src/types/article.ts** (21 exports)
CanonicalArticleDocument is the root (18 fields). Also: AuthorInfo, ArticleSection, ContentNodeType, ContentNodeBase, ParagraphNode, ImageNode, PullQuoteNode, KeyFactsNode, TableNode, ListNode, CalloutNode, ContentNode (discriminated union of 7 node types), ImagePlacement, TrustTier, InternalLinkRef, ExternalLinkRef, FAQItem, SchemaFlags, CaptureType.

**src/types/api.ts** (5 exports)
- ApiSuccess<T>, ApiError, ApiResponse<T> - standard response wrapper types used by every route
- ErrorCode - union of 12 string literals (guide must extend this with GSC error codes)
  Current values: AUTH_REQUIRED, AUTH_FORBIDDEN, VALIDATION_ERROR, NOT_FOUND, GENERATION_FAILED, ONYX_UNAVAILABLE, RENDER_ERROR, QA_GATE_FAILED, CLOUDINARY_ERROR, LINK_VERIFICATION_FAILED, FINALIZATION_FAILED, INTERNAL_ERROR
- ValidationResult - interface with valid, errors[], warnings[]

**src/types/qa.ts** (4 exports): CheckSeverity, QACheck, QAResult, QAScore

**src/types/claude.ts** (9 exports): ConversationMessage, PromptLayer, GenerationRequest, GenerationResponse, WebSearchResult, GenerateArticleRequest, GenerateArticleResponse, StreamEventType, StreamEvent

**src/types/renderer.ts** (3 exports): HtmlOverride, RendererInput, RendererOutput

**src/types/onyx.ts** (3 exports): OnyxSearchResult, OnyxContext, OnyxHealthStatus

**src/types/photo.ts** (3 exports): Photo, PhotoManifest, CloudinaryTransform

**src/types/auth.ts** (2 exports): UserRole, User

**src/types/ui.ts** (7 exports): PreviewMode, ViewportMode, EditingMode, ArticleVersion, UndoEntry, ArticleEditorState (23 fields), ArticleEditorActions (30 action methods)

**src/types/qa-fix.ts** (5 exports): FixTier, DocMutation, DeterministicFixResult, DeterministicFixFn, FixRegistryEntry

**src/types/activity.ts** (3 exports)
- ActivityAction - union of 8 string literals (guide must extend)
  Current values: LOGIN, PASSWORD_CHANGED, ARTICLE_FINALIZED, ARTICLE_PUBLISHED, USER_CREATED, USER_DEACTIVATED, USER_REACTIVATED, USER_PASSWORD_RESET
- ActivityLogEntry, ActivityLogPage

**src/types/next-auth.d.ts** - module augmentation only, no named exports
**src/types/index.ts** - re-exports all of the above via export *

### Types the Guide Must CREATE

Create new file: src/types/intelligence.ts

Key interfaces to define:

ArticlePerformanceRow:
  - id: number
  - contentMapId: number
  - date: string (ISO date YYYY-MM-DD)
  - clicks: number
  - impressions: number
  - ctr: number (0-1 float)
  - position: number (average ranking position)
  - query: string | null (top query for that URL+date)
  - page: string (GSC page URL)
  - syncedAt: string (ISO datetime)

ContentRecommendation:
  - id: number
  - contentMapId: number
  - recommendationType: update or new_spoke or gap or seasonal
  - title: string
  - rationale: string
  - suggestedPrompt: string (pre-loaded Composer prompt)
  - priority: high or medium or low
  - status: pending or approved or dismissed
  - generatedAt: string (ISO datetime)

PerformanceWithContentMap: extends ArticlePerformanceRow, adds contentMap: ContentMapEntry

GscSyncResult:
  - syncedRows: number
  - dateRange: { start: string; end: string }
  - errors: string[]

### Types the Guide Must EXTEND in Existing Files

1. src/types/api.ts - Add to ErrorCode union: GSC_UNAVAILABLE, GSC_SYNC_FAILED, INTELLIGENCE_ERROR
2. src/types/activity.ts - Add to ActivityAction union: GSC_SYNC_COMPLETED
3. src/types/index.ts - Add line: export * from "./intelligence";

---

## 6. Existing GSC / Performance Code

### Result: NOTHING EXISTS

Exhaustive grep for gsc, google.search.console, searchanalytics, article_performance, SearchConsole across the entire codebase found only:

| File | Nature of Match |
|---|---|
| BWC-Content-Engine-System-Architecture.md line 144 | Env vars table: GSC_SITE_URL listed as planned |
| BWC-Content-Engine-System-Architecture.md line 2726 | Phase 4 description: Build a simple analytics integration (Google Search Console API) |
| src/lib/qa/fix-registry.ts | Coincidental substring, unrelated to GSC |
| package-lock.json | No googleapis or @googleapis/searchconsole package installed |

The src/lib/gsc/ module directory does not exist. The article_performance table is absent from prisma/schema.prisma. No GSC-related npm packages are installed. The guide is building from zero.

### Relevant Existing Pattern: Google Service Account (Drive)

The codebase already authenticates with Google APIs using a service account key stored as a JSON string env var:
- Env var: GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY
- Used by: src/app/api/photos/drive-upload/route.ts

The GSC module should follow the same pattern. If the same service account has been granted access to the GSC property, GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY can be reused. Otherwise, define GOOGLE_GSC_SERVICE_ACCOUNT_KEY as a separate env var.

### googleapis Package

Check package.json before adding as a dependency - Google Drive usage may have already installed googleapis.
If installed: use google.searchconsole("v1").
If not installed: run npm install googleapis

---

## 7. Content Map Seed Data and Migrations

### Prisma Migrations: DOES NOT EXIST

Glob of prisma/migrations/** returned no files. The project uses prisma db push (push-based schema sync for Neon Postgres serverless), NOT migration files.

CRITICAL for the guide: do NOT instruct npx prisma migrate dev.
The correct commands after adding new models to schema.prisma:

    npx prisma db push
    npx prisma generate

### Seed File: prisma/seed.ts

Operations performed (all idempotent via upsert/count checks):
1. Admin user upsert from env vars (ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD)
2. ContentMap rows from data/content-map.csv - hubs first, then spokes with parentHubId linking
3. 10 core BWC pages into internal_links with linkType: to-core-page
4. 4 writing styles (luxury editorial, narrative storyteller, wine critic, accessible enthusiast)

The seed does NOT populate article_performance and should not. That table is populated exclusively by the /api/cron/gsc-sync route. No changes to prisma/seed.ts are needed.

### Architecture Doc GSC Env Vars (not yet in .env.example)

From BWC-Content-Engine-System-Architecture.md line 144, these are listed as planned:
- GSC_SITE_URL - The property URL in GSC (e.g., https://www.bhutanwine.com)
- GOOGLE_CLIENT_ID - OAuth2 client ID (if using OAuth2 flow)
- GOOGLE_CLIENT_SECRET - OAuth2 client secret
- GOOGLE_REFRESH_TOKEN - Refresh token for long-lived access

Recommendation: Use service account instead of OAuth2 flow, matching the existing Google Drive pattern. Minimum additions to .env.example: GSC_SITE_URL and GOOGLE_GSC_SERVICE_ACCOUNT_KEY.

---

## 8. Complete Gap List

### New Files to Create

| Path | Purpose |
|---|---|
| src/types/intelligence.ts | ArticlePerformanceRow, ContentRecommendation, PerformanceWithContentMap, GscSyncResult |
| src/lib/gsc/auth.ts | Service account authentication for Google APIs |
| src/lib/gsc/client.ts | GSC Search Analytics API client wrapper |
| src/lib/gsc/fetcher.ts | Data fetcher: pulls clicks/impressions/ctr/position from GSC |
| src/lib/gsc/matcher.ts | Matches GSC page URLs to content_map slugs/publishedUrl |
| src/lib/gsc/index.ts | Barrel export for src/lib/gsc/ |
| src/lib/store/intelligence-store.ts | Zustand store for performance data, recommendations, approval state |
| src/app/api/cron/gsc-sync/route.ts | Vercel Cron Job - fetches GSC data daily, writes to article_performance |
| src/app/api/intelligence/analyze/route.ts | Runs Claude over performance + content_map, returns ContentRecommendation[] |
| src/app/api/intelligence/performance/route.ts | Returns article_performance joined with content_map |
| src/app/dashboard/intelligence/page.tsx | Intelligence dashboard page |
| src/components/intelligence/IntelligenceDashboard.tsx | Wrapper component with three panels |
| src/components/intelligence/PerformanceOverview.tsx | Performance Overview panel |
| src/components/intelligence/GapAnalysis.tsx | Gap Analysis panel |
| src/components/intelligence/RecommendationQueue.tsx | Recommendation Queue with approve/dismiss actions |
| src/components/intelligence/index.ts | Barrel export |

Note: ArticlePerformance and ContentRecommendation Prisma models must also be added to prisma/schema.prisma.

### Existing Files to Modify

| Path | Change |
|---|---|
| prisma/schema.prisma | Add ArticlePerformance and ContentRecommendation models |
| src/components/layout/AppShell.tsx | Add Intelligence nav link (isIntelligence flag + Link element with TrendingUp icon) |
| vercel.json | Add crons array with /api/cron/gsc-sync on daily schedule |
| .env.example | Add GSC_SITE_URL and GOOGLE_GSC_SERVICE_ACCOUNT_KEY |
| src/types/api.ts | Extend ErrorCode: add GSC_UNAVAILABLE, GSC_SYNC_FAILED, INTELLIGENCE_ERROR |
| src/types/activity.ts | Extend ActivityAction: add GSC_SYNC_COMPLETED |
| src/types/index.ts | Add: export * from "./intelligence"; |

---

## 9. Recommendations for the Guide Author

1. **No migrations - use db push.** After adding models to prisma/schema.prisma: npx prisma db push && npx prisma generate.

2. **All PKs use Int @id @default(autoincrement()).** Do not use UUID or cuid. Every existing model uses auto-incrementing integers.

3. **FK naming convention.** Use contentMapId Int @map("content_map_id") - camelCase Prisma field, snake_case DB column via @map. This matches every existing FK in the schema (articleId -> article_id, sourceArticleId -> source_article, etc.).

4. **Date columns.** Use DateTime @db.Date @map("date") for the date column in article_performance, consistent with scheduledDate and publishedDate in ContentMap.

5. **CRON_SECRET bearer token.** The env var exists but is never consumed in src/. In the cron route, compare request.headers.get("authorization") against the string "Bearer " + process.env.CRON_SECRET. Vercel injects this header automatically when invoking the cron route.

6. **AppShell nav link pattern.** Use usePathname() with isIntelligence = pathname === "/dashboard/intelligence". Active style: { color: "#bc9b5d", fontWeight: 600 }. Inactive style: { color: "#414141", fontWeight: 400 }. Use TrendingUp icon from lucide-react. The component is at src/components/layout/AppShell.tsx.

7. **Approval gate uses existing store actions.** Both setSelectedArticle and setPendingChatMessage already exist in useArticleStore (defined in src/types/ui.ts, implemented in src/lib/store/article-store.ts). The approval action in useIntelligenceStore calls these via useArticleStore.getState(), then navigates to /dashboard. No changes to article-store.ts are needed.

8. **GSC API uses service account auth.** Credentials stored as a JSON blob in a single env var string (matching GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY pattern). Parse with JSON.parse(process.env.GOOGLE_GSC_SERVICE_ACCOUNT_KEY) at runtime. Use the googleapis npm package with google.auth.GoogleAuth and scopes: ["https://www.googleapis.com/auth/webmasters.readonly"].

9. **Content map matching strategy.** GSC returns page URLs. Match to content_map rows by comparing the GSC URL against publishedUrl (exact match) and slug (path suffix match - check if the GSC URL path ends with "/" + slug value). The matcher.ts module handles both cases and returns the content_map.id. Unmatched URLs should be logged but not cause errors.

10. **Intelligence API routes use requireAuth().** Only the cron route uses CRON_SECRET. The two /api/intelligence/ routes are browser-facing and must call await requireAuth() from src/lib/auth/session.ts, identical to all other protected routes in the codebase.
