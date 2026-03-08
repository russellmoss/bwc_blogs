# BWC Content Engine — Architecture

> Living architecture document. Keep in sync with code changes per CLAUDE.md rules.

## Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router, React 19, Turbopack) |
| **Database** | Neon Postgres via Prisma ORM |
| **Auth** | NextAuth v4 (CredentialsProvider, JWT sessions) |
| **AI** | Claude API (Anthropic SDK — article generation, QA fixes, alt-text) |
| **RAG** | Onyx CE (knowledge base retrieval) |
| **CDN** | Cloudinary (image hosting and transforms) |
| **Charts** | Recharts (responsive line charts, dual-axis) |
| **State** | Zustand (article-store, dashboard-store, intelligence-store) |
| **Validation** | Zod (runtime schemas on API boundaries) |
| **Hosting** | Vercel |

## Request Flow

1. User selects article in **AppShell** → sends message via **ChatPanel**
2. If article is finalized/published, **ChatPanel** auto-loads via `loadFinalizedArticle()` → fetches canonical doc from `/api/articles/{id}`, re-renders HTML, runs QA
3. For new generation, hits `POST /api/articles/generate` (SSE streaming)
4. **Orchestrator** assembles 8-layer prompt → calls Claude → parses streaming response → renders HTML → validates schema → runs QA
5. Stores result in `articleStore` (doc + HTML + validation + QA score)
6. Displays in **PreviewPanel** (iframe sandbox for HTML, toolbar for mode/viewport)
7. User edits via **Chat** (regenerate), **Canvas** (inline contenteditable), or **HTML** (raw source)
8. **QA Scorecard** shows failures/warnings → user applies fixes (Tier 1 deterministic, Tier 2 Claude-assisted)
9. **Finalize** — promotes photos (Drive → Cloudinary), runs QA gate, atomically commits doc + HTML + status to Neon
10. **Publish** — user sets published URL, internal links are activated, backfill report generated
11. User copies HTML to Wix manually (no auto-publish)

## Database Models

See `docs/_generated/prisma-models.md` for auto-generated field-level inventory.

| Model | Purpose |
|-------|---------|
| **User** | Auth accounts — email, passwordHash, role (admin/editor/viewer), isActive |
| **ActivityLog** | User activity tracking — userId, userEmail, userName, action, metadata (JSON), createdAt |
| **ContentMap** | Article metadata — hub/spoke/news type, title, slug, keywords, status, parentHubId |
| **ArticleDocument** | Versioned JSON — canonicalDoc (CanonicalArticleDocument), htmlOverrides, version |
| **ArticleHtml** | Rendered output — htmlContent, metaTitle, metaDescription, schemaJson, qaScore |
| **InternalLink** | Link tracking — source/target articles, core pages, anchor text, linkType |
| **Photo** | Image metadata — driveFileId, cloudinaryPublicId/Url, altText, dimensions, category |
| **ArticlePhoto** | Article-photo junction — articleId, photoId, position (hero, inline-1, etc.) |
| **Lead** | Form captures — email, sourceArticleId, captureType, UTM params |
| **LeadEvent** | Lead interactions — leadId, eventType, eventData (JSON) |
| **WritingStyle** | Writing style templates — name, slug, content, isDefault |
| **ArticlePerformance** | GSC metrics per page per day — clicks, impressions, ctr, position; nullable contentMapId for unmatched pages; unique on (page, date) |
| **ContentRecommendation** | Claude-generated content recommendations — type, priority, status, suggestedPrompt |
| **ArticleQueryPerformance** | GSC query-level metrics — page, query, clicks, impressions, ctr, position per day |
| **RagDocument** | Drive files indexed for RAG — driveFileId, filename, md5Checksum, chunkCount |
| **RagChunk** | Embedded text chunks — content, tokenCount, headingContext, vector(768) embedding |
| **RagSyncState** | Sync cursor — startPageToken for incremental Drive Changes API sync |

## API Routes

See `docs/_generated/api-routes.md` for auto-generated route inventory.

### Articles (10 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/articles/generate` | POST | SSE streaming — assembles prompt layers, calls Claude, streams response |
| `/api/articles/qa` | POST | QA scoring — deterministic checks, returns failures/warnings |
| `/api/articles/qa/fix` | POST | Targeted QA fixes — Claude applies fixes to specific failed checks |
| `/api/articles/render` | POST | HTML rendering — converts CanonicalArticleDocument to Wix-ready HTML |
| `/api/articles/validate` | POST | Schema validation — Zod validation of CanonicalArticleDocument |
| `/api/articles/[id]` | GET | Get article metadata + latest finalized canonicalDoc and htmlOverrides |
| `/api/articles/[id]/finalize` | POST | Finalize — photo promotion, QA gate, atomic commit (doc + HTML + status) |
| `/api/articles/[id]/html` | GET | Get rendered HTML for a specific version (or latest) |
| `/api/articles/[id]/publish` | POST | Mark published — set URL, activate internal links, generate backfill report |
| `/api/articles/[id]/versions` | GET | Version history — list all finalized document versions |

### Auth (3 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth v4 — credential provider, JWT sessions |
| `/api/auth/setup` | GET, POST | Initial setup — creates first admin user if none exist |
| `/api/auth/change-password` | POST | Password change for authenticated users |

### Content Map (3 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/content-map` | GET, POST | List all articles / create new article (auto-slug, Zod validation) |
| `/api/content-map/[id]` | GET, PATCH, DELETE | Get / update / delete individual article |
| `/api/content-map/import` | POST | Bulk CSV import — PapaParse, hub-then-spoke ordering |

### Health (1 route)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/health` | GET | Status check — verifies DATABASE, ANTHROPIC, ONYX, CLOUDINARY availability |

### Links (2 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/links/verify` | POST | Link checker — validates internal/external URLs, returns status |
| `/api/links/graph` | GET | Link graph — JSON map of article relationships |

### Capture (1 route)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/capture` | POST | Lead capture from Wix (stub — accepts data, full processing Phase 3+) |

### Onyx RAG (2 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/onyx/health` | GET | Checks RAG index health and document count |
| `/api/onyx/search` | POST | Queries Onyx CE for knowledge base context |

### Custom RAG (3 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/rag/sync` | POST | Incremental Drive sync — CRON_SECRET auth, triggered by GitHub Actions |
| `/api/rag/health` | GET | Health check — document/chunk counts, sync status |
| `/api/rag/compare` | POST | A/B comparison — runs both Onyx and custom, returns side-by-side metrics |

### Photos (6 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/photos` | GET, POST | List all photos / add new photo record |
| `/api/photos/[id]` | GET, PATCH, DELETE | Get / update / delete photo metadata |
| `/api/photos/[id]/assignments/[articleId]` | DELETE | Remove photo-article assignment |
| `/api/photos/describe` | POST | Claude generates alt-text descriptions from image |
| `/api/photos/upload` | POST | Upload photo to Cloudinary CDN |
| `/api/photos/drive-upload` | POST | Direct file upload to Cloudinary — UI file picker → CDN + AI describe |

### Users (2 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/users` | GET, POST | List active users / create user (admin only) |
| `/api/users/[id]` | GET, PATCH, DELETE | Get / update / deactivate individual user |

### Activity Log (1 route)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/activity-log` | GET | Paginated activity log — filter by user, action, date range |

### Intelligence (5 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/intelligence/performance` | GET | GSC performance data aggregated per page, joined with content map; supports `?days=N` or `?start=&end=` |
| `/api/intelligence/timeseries` | GET | Per-day clicks + impressions aggregated across all pages for chart rendering |
| `/api/intelligence/analyze` | POST | Claude analyzes performance data → content recommendations |
| `/api/intelligence/recommendations` | GET, PATCH | List pending recommendations / approve or dismiss |
| `/api/intelligence/sync` | POST | Manual GSC sync trigger (session-authed, same logic as cron route) |

### Cron (1 route)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/cron/gsc-sync` | GET | Daily GSC data sync — CRON_SECRET bearer auth, Vercel Cron |

## Page Routes

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Root redirect → `/dashboard` (authenticated) or `/login` |
| `/login` | `src/app/(auth)/login/page.tsx` | Login page — initial SetupForm then LoginForm |
| `/dashboard` | `src/app/dashboard/page.tsx` | Main editor — ChatPanel (left) + PreviewPanel (right) in AppShell |
| `/dashboard/content-map` | `src/app/dashboard/content-map/page.tsx` | Content strategy — table/hub view, create/import/delete articles |
| `/dashboard/photos` | `src/app/dashboard/photos/page.tsx` | Photo manager — upload, Drive import, alt-text generation |
| `/dashboard/intelligence` | `src/app/dashboard/intelligence/page.tsx` | SEO Intelligence — performance, gap analysis, recommendations |
| `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | Admin panel — password management, user CRUD |

## Components

### `src/components/layout/`
| Component | Purpose |
|-----------|---------|
| `AppShell` | Top-level layout — header nav (Composer, Content Map, Photos, Intelligence), UserMenu, ArticleSelector |
| `ArticleSelector` | Dropdown to switch between articles |
| `SplitPane` | Resizable two-column layout for editor |

### `src/components/chat/`
| Component | Purpose |
|-----------|---------|
| `ChatPanel` | Main chat UI — orchestrates message flow, input, generation; auto-loads finalized articles on selection |
| `MessageInput` | Text input with streaming state |
| `MessageList` | Scrollable message display |
| `StreamingMessage` | Animated text delta during generation |

### `src/components/preview/`
| Component | Purpose |
|-----------|---------|
| `PreviewPanel` | Viewport switcher (desktop/mobile), mode switcher (preview/html/canvas) |
| `PreviewIframe` | Renders Wix-ready HTML in sandbox iframe |
| `PreviewToolbar` | Rendering mode, viewport, QA button controls |
| `HtmlSourceView` | Raw HTML code view |
| `VersionNavigator` | Article version history timeline |

### `src/components/canvas-edit/`
| Component | Purpose |
|-----------|---------|
| `CanvasEditOverlay` | Contenteditable wrapper with `data-cad-path` tracking |
| `LockedElementOverlay` | Visual overlay for non-editable sections |

### `src/components/html-editor/`
| Component | Purpose |
|-----------|---------|
| `HtmlEditor` | Wrapper switching preview ↔ HTML source views |
| `HtmlEditorInner` | Raw HTML textarea editor |

### `src/components/scorecard/`
| Component | Purpose |
|-----------|---------|
| `ScorecardPanel` | QA results display with fix recommendations |
| `ScorecardItem` | Individual check result — deterministic or Claude fix buttons |

### `src/components/finalization/`
| Component | Purpose |
|-----------|---------|
| `FinalizeButton` | Triggers finalization — photo promotion, QA gate, atomic commit |
| `PublishButton` | Sets published URL — activates links, generates backfill report |
| `ExportPanel` | Copy-to-clipboard for Wix — shows finalized HTML, meta, schema |

### `src/components/dashboard/`
| Component | Purpose |
|-----------|---------|
| `ContentMapDashboard` | Hub view + table view toggle, create/import/delete, stats |
| `TableView` | Sortable data grid with per-row edit/delete |
| `HubView` | Hierarchical hub-spoke diagram |
| `FilterBar` | Hub name, article type, status, search filters |
| `ArticleDetailPanel` | Side panel overlay showing article metadata + delete |
| `CreateArticleModal` | New article dialog (type, title, hub, keywords, etc.) |
| `CSVImportModal` | Bulk CSV import with template download, preview, paste |
| `StatusBadge` / `TypeBadge` | Status/type indicator badges |

### `src/components/intelligence/`
| Component | Purpose |
|-----------|---------|
| `IntelligenceDashboard` | 3-tab container (Performance, Gap Analysis, Recommendations) with back-to-Composer link |
| `PerformanceOverview` | Date range selector, metric cards, recharts line chart, granularity toggle, page type filter, sortable table, CSV export |
| `PerformanceChart` | Recharts dual-axis LineChart — impressions (indigo) + clicks (gold), daily/weekly/monthly bucketing, tooltips |
| `GapAnalysis` | Unindexed articles + keyword gap analysis |
| `RecommendationQueue` | Claude recommendation cards with approve/dismiss, Run Analysis + Sync Now buttons |

### `src/components/photo-manager/`
| Component | Purpose |
|-----------|---------|
| `PhotoManager` | Photo library with tabs (uploaded, Drive, description) |
| `PhotoCard` | Individual photo display with metadata |
| `PhotoSelector` | Modal for choosing photos during article generation |

## Lib Modules

### `src/lib/orchestration/`
Main generation loop — prompt assembly → Claude → parsing → post-processing.

- `orchestrator.ts` — entry point, manages full generation cycle
- `conversation.ts` — builds multi-turn conversation messages
- `streaming-parser.ts` — parses Claude streaming response into JSON + text delta
- `post-processing.ts` — validation, QA, rendering after generation

### `src/lib/prompt-assembly/`
8-layer system prompt construction:

| Layer | File | Purpose |
|-------|------|---------|
| 1 | `layer-sop.ts` | SOP editorial standards (from `docs/BWC Master Content Engine SOP.md`) |
| 2a | `layer-style-guide.ts` | Brand style guide — CSS vars, fonts, BEM components |
| 3 | `layer-template-ref.ts` | CanonicalArticleDocument schema reference |
| 4 | `layer-photo-manifest.ts` | Available photos for article |
| 5 | `layer-kb-context.ts` | Onyx RAG results |
| 6 | `layer-brief.ts` | Article brief — title, type, keywords |
| 7 | `layer-link-graph.ts` | Internal linking strategy |
| — | `assembler.ts` | Combines all layers into final prompt |

### `src/lib/qa/`
QA scorecard engine — deterministic checks with targeted fixes.

- `engine.ts` — runs all checks, returns QAScore with failures/warnings
- `fix-registry.ts` — Tier 1 (deterministic) and Tier 2 (Claude) fix definitions
- `patch-prompt.ts` — builds Claude prompt for Tier 2 fixes
- `readability.ts` — Flesch-Kincaid grade level calculator
- `cheerio-adapter.ts` — cheerio DOM adapter for Node.js
- `merge-partial.ts` — merges partial JSON edits from Claude

### `src/lib/renderer/`
Converts CanonicalArticleDocument → Wix-ready HTML.

- `renderer.ts` — main renderer
- `components.ts` — BEM templates (H1, H2, section, image, quote, etc.)
- `css.ts` — brand CSS variables stylesheet
- `jsonld.ts` — BlogPosting and FAQPage structured data
- `cloudinary.ts` — Cloudinary CDN URLs with transforms
- `compiled-template.ts` — pre-compiled HTML template with Google Fonts

### `src/lib/article-schema/`
- `schema.ts` — Zod schema for CanonicalArticleDocument
- `validate.ts` — runs validation, returns ValidationResult
- `repair.ts` — auto-repair broken documents

### `src/lib/claude/`
- `client.ts` — Anthropic SDK setup with model selection
- `streaming.ts` — SSE streaming helpers
- `tools.ts` — Claude tool definitions

### `src/lib/onyx/`
- `client.ts` — Onyx CE API client
- `health-checker.ts` — RAG index status
- `query-builder.ts` — constructs RAG search queries
- `context-assembler.ts` — builds RAG context block for prompt

### `src/lib/cloudinary/`
- `client.ts` — Cloudinary API client configuration
- `upload.ts` — upload file to Cloudinary folder
- `drive-downloader.ts` — download image from Google Drive URL

### `src/lib/finalization/`
Article finalization and publication pipeline.

- `index.ts` — `promotePendingPhotos()` (Drive → Cloudinary upload), `commitFinalization()` (atomic doc + HTML + status commit with QA gate), `generateBackfillReport()` (cross-article link suggestions), `activateLinks()` (enable internal links when both ends are published)

### `src/lib/content-map/`
- `import.ts` — CSV parsing (PapaParse) and bulk import with hub-then-spoke ordering
- `slug.ts` — slug generation and uniqueness enforcement

### `src/lib/auth/`
- `config.ts` — NextAuth configuration (auto-detect Vercel URL)
- `session.ts` — `getCurrentUser()`, `requireAuth()`, `requireRole()` helpers
- `password.ts` — bcrypt hash/verify

### `src/lib/gsc/`
Google Search Console integration — data fetching, matching, and sync.

- `auth.ts` — service account auth from `GSC_SERVICE_ACCOUNT_JSON` env var
- `client.ts` — creates searchconsole v1 API client
- `fetcher.ts` — queries GSC with `["date", "page"]` dimensions, 25K row pagination
- `matcher.ts` — matches GSC URLs to ContentMap entries by publishedUrl or slug suffix
- `sync.ts` — shared sync logic: fetches 16-month history, upserts per-day per-page rows
- `index.ts` — barrel export

### `src/lib/store/`
- `article-store.ts` — Zustand: editor state (document, HTML, QA, undo/redo, versions, conversation, photos)
- `dashboard-store.ts` — Zustand: content map (articles, filters, sort, selection, detail panel)
- `intelligence-store.ts` — Zustand: SEO intelligence (performance data, timeseries, recommendations, date range, chart granularity, page type filter, sync state)

### `src/lib/undo-redo/`
- `undo-manager.ts` — LIFO stack operations (push, pop, depth limit)

### `src/lib/db/`
- `index.ts` — PrismaClient singleton
- `retry.ts` — retry logic for transient DB errors

### `src/lib/env.ts`
Centralized env access — exports typed `env` object. See `docs/_generated/env-vars.md` for full list.

## Types

All shared types live in `src/types/` and are re-exported from `src/types/index.ts`.

| File | Key Exports |
|------|-------------|
| `article.ts` | `CanonicalArticleDocument`, `ArticleSection`, `ContentNode*`, `ImagePlacement`, `InternalLinkRef`, `ExternalLinkRef`, `FAQItem`, `SchemaFlags` |
| `api.ts` | `ApiSuccess<T>`, `ApiError`, `ApiResponse<T>`, `ErrorCode`, `ValidationResult` |
| `auth.ts` | `User`, `UserRole` ("admin" \| "editor" \| "viewer") |
| `claude.ts` | `ConversationMessage`, `PromptLayer`, `GenerationRequest`, `GenerationResponse`, `StreamEvent*` |
| `content-map.ts` | `ArticleType`, `ArticleStatus`, `ContentMapEntry`, `InternalLinkEntry` |
| `onyx.ts` | `OnyxSearchResult`, `OnyxContext`, `OnyxHealthStatus` |
| `photo.ts` | `Photo`, `PhotoManifest`, `CloudinaryTransform` |
| `qa.ts` | `QACheck`, `QAResult`, `QAScore`, `CheckSeverity` |
| `qa-fix.ts` | `DocMutation`, `DeterministicFixResult`, `DeterministicFixFn`, `FixRegistryEntry`, `FixTier` |
| `renderer.ts` | `HtmlOverride`, `RendererInput`, `RendererOutput` |
| `activity.ts` | `ActivityAction` (includes `"GSC_SYNC_COMPLETED"`) |
| `intelligence.ts` | `ArticlePerformanceRow`, `PerformanceWithContentMap`, `RecommendationType`, `ContentRecommendation`, `GscSyncResult`, `PerformanceSummary` |
| `ui.ts` | `PreviewMode`, `EditingMode`, `ViewportMode`, `ArticleEditorState`, `ArticleEditorActions`, `ArticleVersion`, `UndoEntry` |

## Environment Variables

See `docs/_generated/env-vars.md` for auto-generated variable inventory.

## Generated Inventories

Auto-generated files in `docs/_generated/` — do NOT edit manually:

| File | Script | Content |
|------|--------|---------|
| `prisma-models.md` | `npm run gen:models` | Database model field tables |
| `api-routes.md` | `npm run gen:api-routes` | API route inventory with methods |
| `env-vars.md` | `npm run gen:env` | Environment variable catalog |

Run all: `npm run gen:all`