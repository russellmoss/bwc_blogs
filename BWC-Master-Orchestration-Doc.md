# BWC Content Engine — Master Orchestration Document

**Document type:** Build orchestration plan
**Version:** 1.0
**Last updated:** 2026-03-01
**Purpose:** Define the build order, shared contracts, integration gates, and agent execution workflow for constructing the BWC Content Engine from the existing scaffold to a production-ready application.

---

## 1. What This Document Is

This is the **single source of truth** for how the BWC Content Engine gets built. It is consumed by:

- **You (Russell)** — to understand the build sequence, know when to intervene, and make architectural decisions at gate checkpoints.
- **Claude (in this conversation)** — to produce individual Implementation Guides that are consistent with each other.
- **Claude Code agents** — to understand dependencies between guides and verify integration gates.

This document does **not** contain implementation details for any single subsystem. Those live in the individual Implementation Guides (Guide 1 through Guide 12). This document tells you **what gets built, in what order, what connects to what, and how to verify each stage.**

### How This Document Relates to Other Project Docs

| Document | Role | How This Doc Uses It |
|---|---|---|
| `BWC-Content-Engine-System-Architecture.md` | Technical blueprint — the complete system design | Source of truth for all schemas, component specs, and UX contracts. Every guide traces back to sections of this doc. |
| `BWC_Master_Content_Engine_SOP.md` | Editorial standards and SEO rules | Defines the QA scorecard rules. Loaded into Claude's system prompt at runtime. |
| `BWC-Brand-Style-Guide-for-HTML-Blog-Posts.md` | Design intent — colors, typography, components | Informs the Article Renderer and is loaded as Layer 2a of the system prompt. |
| `BWC-Site-Architecture-Internal-Linking-Guide.md` | Internal link strategy and hub/spoke topology | Defines the link graph rules. Loaded into Claude's system prompt at runtime. |
| `BWC_content_hubs_and_spokes.csv` | Content Map — every planned article | Seeded into the `content_map` database table in Guide 2. |

---

## 2. Current State of the Codebase

### Deployed & Working

| Component | Status | Location |
|---|---|---|
| Vercel project | ✅ Live | `bwc-content-engine.vercel.app` |
| GitHub repo | ✅ Connected | `russellmoss/bwc_blogs`, auto-deploys on push to `main` |
| Neon Postgres | ✅ Provisioned | Vercel Storage integration, US East (iad1) |
| Onyx CE (RAG) | ✅ Running | `159.65.45.1` / `rmoss-onyx.xyz`, Docker on DigitalOcean |
| Onyx Google Drive Connector | ✅ Indexing | BWC KB folder, OAuth authenticated, 6-hour re-index |
| Cloudinary | ✅ Configured | Cloud: `deahtb4kj`, preset: `blog` (signed) |
| Claude API | ✅ Key set | Model: `claude-sonnet-4-5-20250929` |
| Environment variables | ✅ Complete | 60+ vars in Vercel (see architecture doc §Infrastructure) |
| Landing page | ✅ Renders | BWC branded at root `/` |
| Health check | ✅ Returns 200 | `/api/health` |

### Current File Structure (Scaffold Only)

```
src/
├── app/
│   ├── layout.tsx              ← Working
│   ├── page.tsx                ← Working (landing page)
│   ├── globals.css             ← Working
│   ├── favicon.ico
│   ├── api/
│   │   └── health/
│   │       └── route.ts        ← Working
│   └── (dashboard)/
│       └── page.tsx            ← Placeholder
├── lib/
│   ├── db/index.ts             ← Placeholder (no Prisma)
│   ├── onyx/client.ts          ← Config object only
│   ├── claude/client.ts        ← Config object only
│   ├── cloudinary/client.ts    ← Config object only
│   └── env.ts                  ← Working (env validation)
├── types/index.ts              ← Stub
└── config/site.ts              ← Working
```

### What Is NOT Built Yet

Everything described in the architecture document beyond the scaffold above:

- Prisma schema / database tables
- Auth system (NextAuth.js)
- Article generation orchestration
- Claude prompt assembly (7-layer system prompt)
- Onyx RAG integration in the app
- Split-pane UI (chat + live preview)
- Canonical Article Document schema
- Article Renderer
- Canvas Edit mode
- HTML mode
- Unified undo/redo
- Article Scorecard / QA system
- Image pipeline (Cloudinary upload + CDN URL construction)
- Internal link graph
- Content Map dashboard / Blog Registry
- Schema markup generation (JSON-LD)
- Version history
- Finalized HTML export
- Lead capture system
- Wix site crawler
- Photo Manager
- `agent-guard` documentation sync

---

## 3. Documentation Integrity — `agent-guard` Integration

### Why This Is a Foundational Concern

This build involves 12 implementation guides, each producing API routes, database tables, TypeScript types, environment variables, and UI components. Without automated documentation sync, the architecture doc will be stale by the end of Guide 2. Agent-generated code is especially prone to documentation drift because agents execute instructions rapidly without updating docs unless explicitly told to.

### `agent-guard` Setup (Executed in Guide 1)

`agent-guard` is installed as a dev dependency and configured during the foundation guide. It provides four layers of defense against documentation rot:

**Layer 1: Standing Instructions** — A `CLAUDE.md` file at the repo root gives Claude Code agents real-time context about documentation expectations. When agents modify code, they are instructed to update documentation inline.

**Layer 2: Generated Inventories** — Deterministic scripts extract truth from code on every commit:

| Generator | Source | Output |
|---|---|---|
| `gen:api-routes` | `src/app/api/**/*.ts` | `docs/_generated/api-routes.md` |
| `gen:models` | `prisma/schema.prisma` | `docs/_generated/prisma-models.md` |
| `gen:env` | `.env.example` | `docs/_generated/env-vars.md` |

**Layer 3: Pre-commit Hook** — Runs on every `git commit`. Detects doc-relevant code changes, auto-runs generators, and uses the API engine to update narrative docs (`docs/ARCHITECTURE.md`, `README.md`). Never blocks commits.

**Layer 4: CI/CD Audits** — GitHub Actions catch drift on every push. Weekly scheduled health checks. PR comments with specific remediation steps.

### `agent-guard` Configuration

```json
{
  "projectName": "BWC Content Engine",
  "architectureFile": "docs/ARCHITECTURE.md",
  "agentConfigFile": "CLAUDE.md",
  "additionalAgentConfigs": [],
  "autoFix": {
    "generators": true,
    "narrative": {
      "enabled": true,
      "engine": "api",
      "model": "claude-sonnet-4-20250514",
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "maxTokens": 32000,
      "review": false,
      "narrativeTriggers": ["api-routes", "prisma", "env"],
      "additionalNarrativeTargets": ["README.md"]
    }
  },
  "scanPaths": {
    "apiRoutes": "src/app/api/",
    "prismaSchema": "prisma/schema.prisma",
    "envFile": ".env.example"
  }
}
```

### How `agent-guard` Fits the Build Workflow

Every time a Claude Code agent completes a guide step and commits:

1. Pre-commit hook fires automatically
2. Inventory generators extract current API routes, Prisma models, env vars into `docs/_generated/`
3. API engine updates `docs/ARCHITECTURE.md` narrative sections based on what changed
4. All generated/updated docs are auto-staged with the commit
5. The commit lands with synchronized documentation

This means **you never need to manually update docs during the build.** The agents build code, `agent-guard` keeps docs current, and the architecture doc evolves alongside the codebase.

### Standing Instructions File (`CLAUDE.md`)

Created in Guide 1. Gives Claude Code agents awareness of documentation structure and project conventions. Contains:

- Project overview and purpose
- Documentation file locations and their roles
- Instructions to update docs alongside code changes
- Prisma schema conventions
- API route naming conventions
- Import path conventions
- Testing expectations

---

## 4. The Build Order — Guide Dependency Graph

### Visual Dependency Map

```
Guide 0: Master Orchestration (this document) + Shared Contracts
    │
    ▼
Guide 1: Foundation ──────────────────────────────────────────────────────────
    │  DB schema, Prisma, Auth, agent-guard, scaffold, CLAUDE.md             │
    │                                                                         │
    ├──► Guide 2: Content Map                                                │
    │    │  CSV import, CRUD API, seed data, core page registry              │
    │    │                                                                    │
    │    ├──► Guide 12: Wix Crawler (can run in parallel with 9, 10)         │
    │    │    Site reconciliation, publication detection                      │
    │    │                                                                    │
    ├──► Guide 3: Onyx RAG Integration                                       │
    │    │  Client, search API, context assembly, health monitoring           │
    │    │                                                                    │
    ├──► Guide 4: Canonical Article Schema + Article Renderer ◄── CRITICAL   │
    │    │  Schema definition, Zod validation, renderer pipeline,            │
    │    │  Compiled Template consumption, HTML production                    │
    │    │                                                                    │
    │    ▼                                                                    │
    Guide 5: Orchestration Layer + Claude API ◄─────────── CRITICAL          │
    │    7-layer prompt assembly, streaming, web search,                      │
    │    structured output parsing, validation pipeline                       │
    │    Depends on: 1, 2, 3, 4                                              │
    │                                                                         │
    ▼                                                                         │
Guide 6: Split-Pane UI + Chat Mode ◄──────────────────── CRITICAL           │
    │    Chat interface, preview iframe, streaming render,                    │
    │    mobile/desktop toggle, HTML source view                             │
    │    Depends on: 1, 4, 5                                                 │
    │                                                                         │
    ├──► Guide 7: Canvas Edit + HTML Mode + Undo/Redo                        │
    │    │  contenteditable, data-cad-path mapping, HTML override layer,     │
    │    │  unified undo stack, CodeMirror/Monaco integration                │
    │    │  Depends on: 4, 6                                                 │
    │    │                                                                    │
    ├──► Guide 8: QA Scorecard                                               │
    │    │  All FAIL/WARN checks, overlay UI, click-to-highlight,           │
    │    │  finalization gate, "Fix in Chat/Canvas" actions                  │
    │    │  Depends on: 4, 6                                                 │
    │    │                                                                    │
    ├──► Guide 9: Photo Pipeline                                             │
    │    │  Cloudinary upload, Photo Manager view, photo selection,          │
    │    │  CDN URL construction, Drive integration                          │
    │    │  Depends on: 1, 4, 6                                              │
    │    │                                                                    │
    ├──► Guide 10: Content Map Dashboard + Blog Registry                     │
    │    │  Table view, Hub view, article detail panel, filters,            │
    │    │  status management, link report                                   │
    │    │  Depends on: 1, 2, 6                                              │
    │    │                                                                    │
    ▼                                                                         │
Guide 11: Finalization Flow + Version History                                │
    Finalize button flow, QA gate, Cloudinary upload trigger,               │
    dual commit (canonical doc + rendered HTML), version tables,             │
    Copy HTML / Download, Mark as Published, re-edit flow                    │
    Depends on: ALL above                                                    │
                                                                              │
Guide 12: Wix Crawler + Site Reconciliation ◄─────────────────────────────────
    Vercel Cron, sitemap parsing, slug matching, auto-status update,
    core page monitoring, external post discovery
    Depends on: 1, 2
```

### Critical Path

The longest dependency chain determines the minimum build time:

```
Guide 1 → Guide 4 → Guide 5 → Guide 6 → Guide 11
```

This is the spine. Everything else hangs off this chain. Optimizing the build means keeping this path unblocked.

### Parallelization Opportunities

| After completing... | You can run in parallel... |
|---|---|
| Guide 1 | Guides 2, 3, and 4 (produce all three guides at once, execute 2 and 3 while agent works on 4) |
| Guide 6 | Guides 7, 8, 9, 10 (these touch different files and can be produced/executed in parallel) |
| Guide 2 | Guide 12 (Wix crawler only needs the content_map table) |

---

## 5. Shared Contracts

These contracts are defined **before any guide executes.** Every guide references them. They are the integration surfaces that allow subsystems to connect without needing full knowledge of each other's internals.

### 5A. Database Schema (Prisma)

The full Prisma schema is defined in Guide 1 and extends across guides. Here is the complete table inventory:

| Table | Created In | Primary Consumer |
|---|---|---|
| `users` | Guide 1 | Auth, all API routes |
| `content_map` | Guide 1 (schema), Guide 2 (seed) | Orchestration, Dashboard, Link Graph |
| `article_documents` | Guide 1 (schema), Guide 11 (writes) | Finalization, Version History, Re-edit |
| `article_html` | Guide 1 (schema), Guide 11 (writes) | Finalization, HTML Export, Wix Publishing |
| `internal_links` | Guide 1 (schema), Guide 2 (seed core pages) | Orchestration (Layer 5), QA Scorecard, Dashboard |
| `photos` | Guide 1 (schema), Guide 9 (writes) | Photo Manager, Renderer, Orchestration (Layer 6) |
| `article_photos` | Guide 1 (schema), Guide 9 (writes) | Renderer, Photo Manager |
| `leads` | Guide 1 (schema), Phase 3+ (writes) | Lead Capture API, ESP Sync |
| `lead_events` | Guide 1 (schema), Phase 3+ (writes) | Lead Reporting |

**Decision:** All tables are created in Guide 1's Prisma schema so that every subsequent guide can import models without migration conflicts. Tables that aren't actively used yet simply have no rows.

### 5B. Core TypeScript Interfaces

These types live in `src/types/` and are the contract between every subsystem. They are created in Guide 1 and imported by all subsequent guides.

```
src/types/
├── index.ts                    ← Re-exports everything
├── article.ts                  ← CanonicalArticleDocument and all sub-types
├── api.ts                      ← Request/Response types for all API routes
├── content-map.ts              ← ContentMapEntry, ArticleType, ArticleStatus
├── renderer.ts                 ← RendererInput, RendererOutput, ComponentType
├── qa.ts                       ← QACheck, QAResult, QAScore, CheckSeverity
├── onyx.ts                     ← OnyxSearchResult, OnyxContext
├── claude.ts                   ← PromptLayer, GenerationRequest, GenerationResponse
├── photo.ts                    ← Photo, PhotoManifest, CloudinaryTransform
└── auth.ts                     ← User, UserRole, Session
```

**Key interfaces (abbreviated — full definitions in the Shared Contracts File):**

```typescript
// === article.ts ===
// The central data structure — Claude generates this, Renderer consumes it

interface CanonicalArticleDocument {
  version: string;                    // Schema version, e.g. "1.0"
  articleId: number;                  // FK to content_map.id
  slug: string;
  articleType: ArticleType;           // "hub" | "spoke" | "news"
  hubId: number | null;
  title: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  publishDate: string;                // ISO 8601
  modifiedDate: string;
  author: AuthorInfo;
  executiveSummary: string;
  heroImage: ImagePlacement | null;
  sections: ArticleSection[];
  faq: FAQItem[];
  internalLinks: InternalLinkRef[];
  externalLinks: ExternalLinkRef[];
  ctaType: CaptureType;
  captureComponents: CaptureType[];
  schema: SchemaFlags;
  dataNosnippetSections: string[];
}

type ContentNodeType =
  | "paragraph"
  | "image"
  | "pullQuote"
  | "keyFacts"
  | "table"
  | "list"
  | "callout";

interface ArticleSection {
  id: string;                         // "section-1", "section-2", etc.
  heading: string;
  headingLevel: 2 | 3;
  content: ContentNode[];
}

// === api.ts ===
// Every API route's request/response shape

interface GenerateArticleRequest {
  articleId: number;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  currentDocument: CanonicalArticleDocument | null;
  photoManifest: PhotoManifest | null;
}

interface GenerateArticleResponse {
  document: CanonicalArticleDocument;
  html: string;
  validationResult: ValidationResult;
  conversationReply: string;
}

// === renderer.ts ===
interface RendererInput {
  document: CanonicalArticleDocument;
  htmlOverrides: HtmlOverride[] | null;
  templateVersion: string;
}

interface RendererOutput {
  html: string;
  metaTitle: string;
  metaDescription: string;
  schemaJson: string;
  wordCount: number;
}
```

### 5C. API Route Inventory

Every API route that will exist in the finished system, organized by guide. Each guide owns its routes and must not create routes assigned to other guides.

```
src/app/api/
├── health/
│   └── route.ts                          ← EXISTS (Guide 0)
│
├── auth/
│   └── [...nextauth]/
│       └── route.ts                      ← Guide 1: NextAuth handler
│
├── content-map/
│   ├── route.ts                          ← Guide 2: GET (list), POST (create)
│   ├── [id]/
│   │   └── route.ts                      ← Guide 2: GET, PATCH, DELETE
│   ├── import/
│   │   └── route.ts                      ← Guide 2: POST (CSV import)
│   └── recommendations/
│       └── route.ts                      ← Guide 10: GET (content gaps)
│
├── onyx/
│   ├── search/
│   │   └── route.ts                      ← Guide 3: POST (KB query)
│   └── health/
│       └── route.ts                      ← Guide 3: GET (Onyx status)
│
├── articles/
│   ├── generate/
│   │   └── route.ts                      ← Guide 5: POST (streaming generation)
│   ├── render/
│   │   └── route.ts                      ← Guide 4: POST (canonical doc → HTML)
│   ├── validate/
│   │   └── route.ts                      ← Guide 4: POST (schema validation)
│   ├── [id]/
│   │   ├── route.ts                      ← Guide 11: GET (article detail), PATCH
│   │   ├── finalize/
│   │   │   └── route.ts                  ← Guide 11: POST (finalization flow)
│   │   ├── publish/
│   │   │   └── route.ts                  ← Guide 11: POST (mark as published)
│   │   ├── html/
│   │   │   └── route.ts                  ← Guide 11: GET (rendered HTML)
│   │   └── versions/
│   │       └── route.ts                  ← Guide 11: GET (version history)
│   └── qa/
│       └── route.ts                      ← Guide 8: POST (run scorecard)
│
├── photos/
│   ├── route.ts                          ← Guide 9: GET (list), POST (catalog)
│   ├── [id]/
│   │   └── route.ts                      ← Guide 9: GET, PATCH
│   └── upload/
│       └── route.ts                      ← Guide 9: POST (Drive → Cloudinary)
│
├── links/
│   ├── verify/
│   │   └── route.ts                      ← Guide 5: POST (batch link check)
│   └── graph/
│       └── route.ts                      ← Guide 10: GET (link graph data)
│
├── capture/
│   └── route.ts                          ← Guide 11+: POST (lead capture from Wix)
│
├── crawler/
│   └── route.ts                          ← Guide 12: POST (Vercel Cron trigger)
│
└── users/
    ├── route.ts                          ← Guide 1: GET (list), POST (create)
    └── [id]/
        └── route.ts                      ← Guide 1: GET, PATCH, DELETE
```

### 5D. Environment Variables

All env vars are already set in Vercel (see architecture doc §Infrastructure). Guides must use `process.env.VARIABLE_NAME` and must not introduce new env vars without adding them to `.env.example` and documenting the purpose. `agent-guard` will auto-generate `docs/_generated/env-vars.md` from `.env.example` on every commit.

### 5E. File Ownership by Guide

Each guide owns specific directories and files. Agents executing a guide should only create/modify files within their ownership scope, plus shared contract files when extending types.

| Guide | Owns |
|---|---|
| 1 | `prisma/`, `src/app/api/auth/`, `src/app/api/users/`, `src/app/(auth)/`, `src/lib/db/`, `src/lib/auth/`, `src/types/`, `src/middleware.ts`, `CLAUDE.md`, `agent-docs.config.json`, `docs/`, `.env.example`, `.claude/agents/`, `.claude/skills/` |
| 2 | `src/app/api/content-map/`, `src/lib/content-map/`, `prisma/seed.ts` (content map portion) |
| 3 | `src/app/api/onyx/`, `src/lib/onyx/` |
| 4 | `src/app/api/articles/render/`, `src/app/api/articles/validate/`, `src/lib/renderer/`, `src/lib/article-schema/` |
| 5 | `src/app/api/articles/generate/`, `src/app/api/links/verify/`, `src/lib/orchestration/`, `src/lib/claude/`, `src/lib/prompt-assembly/` |
| 6 | `src/app/(dashboard)/`, `src/components/chat/`, `src/components/preview/`, `src/components/layout/` |
| 7 | `src/components/canvas-edit/`, `src/components/html-editor/`, `src/lib/undo-redo/` |
| 8 | `src/app/api/articles/qa/`, `src/lib/qa/`, `src/components/scorecard/` |
| 9 | `src/app/api/photos/`, `src/lib/cloudinary/`, `src/components/photo-manager/` |
| 10 | `src/app/api/content-map/recommendations/`, `src/app/api/links/graph/`, `src/components/dashboard/` |
| 11 | `src/app/api/articles/[id]/`, `src/app/api/capture/`, `src/lib/finalization/` |
| 12 | `src/app/api/crawler/`, `src/lib/crawler/` |

---

## 6. The Execution Workflow

### 6A. How Guides Get Produced

**Guide 1** is produced manually in a Claude conversation (since there's no codebase to inspect yet). After Guide 1 executes, all subsequent guides are produced by an **agent-driven exploration and build pipeline** with full codebase awareness.

**Guide 1 flow (manual):**
1. You request Guide 1 from Claude (this conversation)
2. Claude produces the guide referencing this orchestration doc and the architecture doc
3. You review and hand it to a Claude Code agent for execution

**Guide 2+ flow (agent-driven, using `.claude/` agents and skills):**
1. Previous guide completes and passes its gates
2. You run `/next-guide` — this spawns a 3-agent team (code-inspector, integration-verifier, pattern-finder) that inspects the actual codebase state in parallel
3. The skill synthesizes findings into `exploration-results.md`
4. You run `/build-guide` — this reads the exploration results plus the orchestration and architecture docs, then produces the implementation guide with full awareness of what actually exists
5. You review the guide
6. You hand it to a fresh Claude Code agent for execution
7. Repeat from step 1

**Why this is better than producing all guides upfront:** Each guide is built from the actual codebase state — not predictions about what previous guides should have produced. If Guide 3's agent put the Onyx client at `src/lib/onyx/api-client.ts` instead of the predicted `src/lib/onyx/client.ts`, Guide 5's build-guide agent sees the real path and uses it. No cascading path errors.

**Agent files location:** `.claude/agents/` (3 agents) and `.claude/skills/` (2 skills) in the repo root. These are committed to the repo and available to any Claude Code session.

**Quality over speed.** A well-written guide executes in 30–60 minutes. A poorly-written guide causes 3+ hours of debugging. The exploration step adds ~10 minutes but prevents hours of debugging from stale assumptions.

### 6B. How Agents Execute Guides

Each Implementation Guide follows this internal structure:

```
# Guide N: [Subsystem Name]

## A. Objective
What is being built and why.

## B. Scope
What is in and out of scope.

## C. Depends On
Which previous guides must be complete.

## D. Shared Contracts Referenced
Specific types, schema tables, and API signatures this guide uses.

## E. Existing Constraints to Preserve
Product behaviors that must not break.

## F. Files Created / Modified
Explicit list of every file this guide touches.

## G. Technical Design
Schema, models, API routes, orchestration flow, rendering flow,
validation flow, persistence, event logging, UI state.

## H. Step-by-Step Execution Plan
Sequenced implementation steps with enough detail for Claude Code.
Each step ends with a verification check.

## I. Gate Checks

### Lint & Type Gate
npx tsc --noEmit
npx next lint

### Integration Gate
node scripts/test-guide-N.ts
# Expected output described

### Human Gate
npm run dev → navigate to [URL] → verify [behavior]

## J. Acceptance Criteria
Objectively testable success conditions.

## K. Risks and Failure Modes
Likely problems and how to defend against them.
```

### 6C. Gate Protocol

Every guide ends with three gate checks. An agent must pass all three before the next guide begins.

**Gate 1: Lint & Type Check (Agent Self-Serve)**

```bash
npx tsc --noEmit          # Zero type errors
npx next lint              # Zero lint errors (warnings acceptable)
npx prisma validate        # Schema valid (if Prisma changed)
```

The agent runs these automatically at the end of every guide. If they fail, the agent fixes the issues before proceeding. The agent does NOT skip type errors or suppress lint rules.

**Gate 2: Integration Test (Agent Self-Serve)**

Each guide includes a test script at `scripts/test-guide-N.ts` that exercises the subsystem. Examples:

| Guide | Integration Test |
|---|---|
| 1 | Query `users` table, verify seeded admin exists, hit `/api/health` and `/api/auth/...` |
| 2 | Query `content_map` table, verify CSV rows imported, test CRUD endpoints |
| 3 | Query Onyx search endpoint, verify KB results return with source attribution |
| 4 | Pass a sample CanonicalArticleDocument to the renderer, verify valid HTML output |
| 5 | Send a generation request, verify structured JSON response streams back |
| 6 | N/A (UI — covered by Human Gate) |
| 8 | Pass a sample rendered HTML to the QA module, verify scorecard output |

**Gate 3: Human Checkpoint (You)**

The agent stops and tells you to run `npm run dev`. You check specific things:

| Guide | What You Check |
|---|---|
| 1 | Landing page still works. Login page renders. Can log in with seeded admin. Dashboard placeholder loads behind auth. `agent-guard` pre-commit hook fires on a test commit and generates `docs/_generated/` files. |
| 2 | Content Map API returns seeded data. Can create/update/delete via API (use curl or Postman). |
| 3 | Onyx health endpoint returns status. Search endpoint returns KB results for a test query like "Bajo vineyard elevation". |
| 4 | Render endpoint accepts a sample canonical doc and returns valid HTML. Preview that HTML in a browser — does it look like a BWC blog post? |
| 5 | Send a test generation request — does Claude respond with a structured canonical doc? Does the response include Onyx KB context? Do internal links point to real URLs? |
| 6 | **MAJOR CHECKPOINT.** Open the app. Select an article. Watch it generate and stream into the preview pane. Does the styled blog post appear in real time? Can you chat to iterate? Does mobile/desktop toggle work? Does the HTML source view show renderer output? |
| 7 | Click into the preview and edit text directly. Does Canvas Edit work? Switch to HTML mode — does the code editor load? Make an edit in each mode and verify undo/redo works across modes. |
| 8 | Click "Run QA Check" — does the scorecard overlay appear? Are checks running against the actual article? Click a failed/warned item — does it highlight in the preview? |
| 9 | Open Photo Manager. Can you see Drive photos? Can you add descriptions? Select photos for an article — do they appear in the preview with Cloudinary URLs? |
| 10 | Open the Content Map dashboard. Do you see all seeded articles? Can you filter by hub, status, type? Click an article row — does the detail panel open? |
| 11 | Click "Finalize Article" — does QA gate run first? Does finalization commit to DB? Can you copy HTML? Can you download .html? Click "Mark as Published" — does status update? |
| 12 | Trigger the crawler manually — does it read the Wix sitemap? (Currently no blog sub-sitemap exists, so verify graceful handling.) |

### 6D. What to Do When a Gate Fails

**Type/lint gate fails:** Agent fixes the issues. Does not move to the next step until the gate passes. Does not suppress errors with `// @ts-ignore` or `eslint-disable` unless there is a genuine false positive (which should be documented with a comment explaining why).

**Integration gate fails:** Agent reads the error output, identifies the root cause, and fixes it. If the fix requires changing shared contracts (types, schema), the agent updates the shared contract file and verifies that no other existing code breaks.

**Human gate fails:** You describe the problem to the agent. The agent fixes it. You re-check. This loop continues until you approve.

### 6E. Commit Cadence and `agent-guard` Behavior

Agents should commit at natural boundaries within each guide — typically after each major step or group of related files. This serves two purposes:

1. **Rollback safety.** If a step goes wrong, you can `git revert` to the last good commit without losing the entire guide's work.
2. **`agent-guard` sync.** Each commit triggers the pre-commit hook, which auto-runs generators and (with the API engine) updates narrative docs. Frequent commits mean documentation stays current throughout the build, not just at the end.

**Recommended commit pattern within a guide:**

```
Guide 1, Step 1: "feat: add Prisma schema with all tables"
Guide 1, Step 2: "feat: add NextAuth config and login page"
Guide 1, Step 3: "feat: add user management API routes"
Guide 1, Step 4: "feat: add middleware and role-based auth"
Guide 1, Step 5: "chore: add agent-guard and generate initial docs"
Guide 1, Step 6: "test: add integration test script for Guide 1"
```

Each commit message follows conventional commits format. `agent-guard` fires on each commit, regenerating `docs/_generated/*.md` and staging the updated files automatically.

---

## 7. Guide Specifications

### Guide 1: Foundation — DB Schema, Prisma, Auth, Scaffold, agent-guard

**What it builds:** The complete database schema (all tables for the entire system), Prisma client, NextAuth.js authentication, user management, middleware, `agent-guard` setup, `CLAUDE.md`, `.env.example`, and the test infrastructure.

**Why it's first:** Every other guide depends on the database, auth, and type definitions. Creating all tables upfront avoids migration conflicts when multiple agents work on different guides.

**Key decisions:**
- All Prisma models defined in a single schema file, even for tables not yet populated
- NextAuth.js with CredentialsProvider, bcryptjs, JWT sessions
- Roles: admin, editor, viewer
- Seed script creates initial admin user (Russell)
- `agent-guard` initialized with API engine using existing `ANTHROPIC_API_KEY`
- All shared TypeScript interfaces created in `src/types/`
- `CLAUDE.md` written with full project context for Claude Code agents
- `.claude/agents/` and `.claude/skills/` committed to repo (code-inspector, integration-verifier, pattern-finder agents + next-guide, build-guide skills) — enables the agent-driven guide-production loop for all subsequent guides

**Produces:**
- `prisma/schema.prisma` (complete)
- `prisma/seed.ts` (admin user)
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/users/route.ts` and `src/app/api/users/[id]/route.ts`
- `src/app/(auth)/login/page.tsx`
- `src/lib/auth/` (config, password utils, session helpers)
- `src/lib/db/index.ts` (Prisma client singleton)
- `src/middleware.ts` (auth + role middleware)
- `src/types/` (all shared interfaces)
- `CLAUDE.md`
- `agent-docs.config.json`
- `.env.example`
- `docs/ARCHITECTURE.md` (initial living architecture doc)
- `.claude/agents/code-inspector.md`
- `.claude/agents/integration-verifier.md`
- `.claude/agents/pattern-finder.md`
- `.claude/skills/next-guide/SKILL.md`
- `.claude/skills/build-guide/SKILL.md`
- `scripts/test-guide-1.ts`

**Integration gate:** DB queries return seeded admin. Auth endpoints respond. `agent-guard gen` produces `docs/_generated/` files. `.claude/agents/` contains 3 agent files and `.claude/skills/` contains 2 skill directories.

**Human gate:** Login works. Dashboard placeholder loads behind auth. `agent-guard` hook fires on test commit. Verify `.claude/` files are committed to the repo.

---

### Guide 2: Content Map — CSV Import, CRUD API, Seed Data

**What it builds:** The Content Map management layer — importing the CSV into the `content_map` table, CRUD API routes, core page registry seeding, and the internal link seed data.

**Why it's here:** The orchestration layer (Guide 5) needs article metadata and the link graph. The dashboard (Guide 10) needs content map data. This is a read-heavy data layer that feeds everything downstream.

**Key decisions:**
- CSV parsing with PapaParse (already available)
- Map CSV columns to `content_map` table fields (hub_name, article_type, title, target_keywords, etc.)
- Hub articles get `parent_hub_id = null`; spokes get FK to their hub
- Core BWC pages seeded into `internal_links` table with `link_type = 'to-core-page'`
- Slug auto-generation from title (lowercase, hyphenated, stop words removed, 3–6 words)

**Produces:**
- `src/app/api/content-map/` (all routes)
- `src/lib/content-map/` (import logic, slug generation, CRUD helpers)
- `prisma/seed.ts` (extended with CSV import + core page seeding)
- `scripts/test-guide-2.ts`

**Integration gate:** 39 rows in `content_map`. Core pages in `internal_links`. CRUD endpoints work.

**Human gate:** API returns correct data for test queries.

---

### Guide 3: Onyx RAG Integration

**What it builds:** The connection between the Next.js app and the Onyx CE instance for Knowledge Base retrieval.

**Why it's here:** The orchestration layer (Guide 5) needs KB context to build Layer 4 of the system prompt. This guide builds the retrieval layer.

**Key decisions:**
- Onyx API client with timeout handling (Onyx is on a 4GB DigitalOcean droplet — it can be slow)
- Structured query strategy: multiple focused queries per article rather than one broad query
- Health monitoring endpoint to check if Onyx is responsive
- Response parsing: extract document chunks with source attribution
- Retry logic with exponential backoff for Onyx cold starts
- Context assembly: format Onyx results into a prompt-ready string for Layer 4

**Produces:**
- `src/app/api/onyx/` (search, health routes)
- `src/lib/onyx/` (client, query builder, context assembler, health checker)
- `scripts/test-guide-3.ts`

**Integration gate:** Search endpoint returns relevant results for "Bajo vineyard elevation" query. Health endpoint reports Onyx status.

**Human gate:** Verify KB results contain actual vineyard data from Google Drive.

---

### Guide 4: Canonical Article Schema + Article Renderer — ⚡ CRITICAL

**What it builds:** The two most architecturally important subsystems — the CanonicalArticleDocument schema (with Zod validation) and the Article Renderer (that produces trusted HTML from the schema using the Compiled Template).

**Why it's critical:** This guide defines the data contract between Claude (producer) and the UI/QA/finalization system (consumers). Every other guide depends on the shape of the canonical document and the renderer's output. Getting this wrong cascades everywhere.

**Key decisions:**
- Zod schema for the CanonicalArticleDocument (runtime validation, not just TypeScript types)
- Repair pass: auto-fix common model output issues (missing fields, malformed links, duplicate section IDs)
- Renderer implemented as a pure function: `(CanonicalArticleDocument, HtmlOverrides?, TemplateVersion) → RendererOutput`
- Renderer reads the Compiled Template for component patterns and stylesheet
- Renderer handles: component selection, Cloudinary URL construction, JSON-LD assembly, capture form injection, `data-nosnippet` placement, HTML override application
- Renderer produces a single complete HTML string — the exact artifact that gets pasted into Wix
- Incremental rendering support: renderer can process sections individually for streaming preview

**Produces:**
- `src/lib/article-schema/` (Zod schemas, validation, repair logic)
- `src/lib/renderer/` (renderer pipeline, component templates, CSS embedding, JSON-LD builder, Cloudinary URL builder)
- `src/app/api/articles/render/route.ts` (POST: canonical doc → HTML)
- `src/app/api/articles/validate/route.ts` (POST: validate canonical doc)
- `src/lib/renderer/compiled-template.ts` (embedded Compiled Template components + stylesheet)
- Sample canonical document fixture for testing
- `scripts/test-guide-4.ts`

**Integration gate:** Sample canonical document passes validation. Renderer produces valid HTML. HTML contains correct CSS, correct Cloudinary URL patterns, valid JSON-LD, proper heading hierarchy.

**Human gate:** Open the rendered HTML in a browser. Does it look like a real BWC blog post? Correct fonts, colors, spacing, images, links?

---

### Guide 5: Orchestration Layer + Claude API — ⚡ CRITICAL

**What it builds:** The core generation engine — the 7-layer system prompt assembly, Claude API streaming calls, structured output parsing, web search tool integration, and post-generation validation.

**Why it's critical:** This is the engine. It connects Onyx (KB), Neon (content map + link graph), the Compiled Template (component reference), and Claude (generation) into the generation pipeline described in architecture doc §3D.

**Key decisions:**
- 7-layer system prompt assembly (SOP, Brand Style Guide, Compiled Template component reference, Article Brief, KB Context, Link Graph, Photo Manifest)
- Claude API with `web_search` tool enabled for external link discovery
- Claude instructed to return CanonicalArticleDocument JSON (not HTML)
- Streaming response parsing: extract structured JSON as it arrives
- Post-generation validation pipeline: schema validation → repair pass → internal link check → external link verification → new source flagging
- Conversation history management: each chat turn accumulates, full history sent with each request

**Produces:**
- `src/lib/prompt-assembly/` (layer builders for each of the 7 layers)
- `src/lib/orchestration/` (generation orchestrator, conversation manager, streaming parser)
- `src/lib/claude/` (API client, streaming handler, tool configuration)
- `src/app/api/articles/generate/route.ts` (POST: streaming generation)
- `src/app/api/links/verify/route.ts` (POST: batch link verification)
- `scripts/test-guide-5.ts`

**Integration gate:** Send a generation request for a test article. Receive a valid CanonicalArticleDocument back. Verify KB context was included. Verify internal links point to real published URLs (or correctly handle empty blog registry).

**Human gate:** Send a generation request via curl. Inspect the structured JSON output. Does it contain real KB data? Real external links from web search? Correct article structure?

---

### Guide 6: Split-Pane UI + Chat Mode — ⚡ CRITICAL

**What it builds:** The primary user interface — the split-pane layout with conversation on the left and live rendered preview on the right.

**Why it's critical:** This is the product. Everything built in Guides 1–5 is invisible backend infrastructure. Guide 6 is where the user first sees the system work.

**Key decisions:**
- Split-pane layout using a resizable panel (e.g., `react-resizable-panels`)
- Chat interface with message history, streaming message display, input field
- Preview pane as a sandboxed iframe (`sandbox="allow-same-origin"` for CSS rendering)
- Streaming render: as Claude streams the canonical doc, renderer incrementally produces HTML fragments injected into the iframe
- Toolbar: mobile/desktop toggle, HTML source view toggle, mode selector (Chat active by default), Copy HTML, Download .html, QA Check, Finalize Article
- Article selector: user can pick from content map or propose a new article
- Session state: current article, canonical doc, conversation history, HTML output

**Produces:**
- `src/app/(dashboard)/page.tsx` (main app shell)
- `src/app/(dashboard)/layout.tsx` (authenticated layout)
- `src/components/chat/` (ChatPanel, MessageList, MessageInput, StreamingMessage)
- `src/components/preview/` (PreviewPanel, PreviewIframe, PreviewToolbar, HtmlSourceView)
- `src/components/layout/` (SplitPane, AppShell, ArticleSelector)
- Client-side state management (React context or Zustand for article state)

**Integration gate:** None (UI guide — covered by Human Gate).

**Human gate:** **MAJOR MILESTONE.** Open the app. Log in. Select an article from the content map. Click "Generate." Watch the styled blog post stream into the preview pane. Chat to iterate ("make the opening more narrative"). Toggle mobile/desktop. View HTML source. This is the moment the product becomes real.

---

### Guide 7: Canvas Edit + HTML Mode + Undo/Redo

**What it builds:** The two additional editing modes and the unified undo/redo system.

**Key decisions:**
- Canvas Edit: inject `contenteditable="true"` on text elements in iframe, map edits back to canonical doc via `data-cad-path` attributes
- HTML Mode: CodeMirror or Monaco editor for rendered HTML, bidirectional sync (safe text patches → canonical doc, structural overrides → HTML override layer)
- Undo/Redo: stack of canonical doc states (+ HTML override states), works across all three modes
- Debounced canvas edit sync (300ms)
- Locked-element overlays for non-editable content in Canvas mode

**Depends on:** Guide 4 (renderer must inject `data-cad-path` attributes), Guide 6 (UI shell exists).

**Human gate:** Click into preview, edit text. Switch to HTML mode, edit source. Undo across modes. Verify all edits persist in the canonical doc.

---

### Guide 8: QA Scorecard

**What it builds:** The deterministic QA system that grades articles against every measurable rule in the Master SOP.

**Key decisions:**
- All checks are deterministic — no LLM calls
- Checks run against both the canonical doc (metadata, links, schema fields) and rendered HTML (heading hierarchy, word count, DOM structure)
- Check severity: FAIL (blocks finalization) / WARN (advisory) / INFO (informational)
- 17 FAIL-level checks, 25+ WARN-level checks (per architecture doc §3L)
- Overlay UI on preview canvas with click-to-highlight
- "Fix in Chat" and "Fix in Canvas" actions pre-populate the relevant mode
- Flesch-Kincaid readability score computation
- Scorecard persists across mode switches and re-runs after edits

**Depends on:** Guide 4 (canonical doc + rendered HTML), Guide 6 (UI for overlay).

**Human gate:** Generate an article, run QA. Does the scorecard show? Are checks accurate? Click a failure — does it highlight in the preview?

---

### Guide 9: Photo Pipeline

**What it builds:** The full image management system — Photo Manager UI, Cloudinary upload pipeline, CDN URL construction, and photo selection during article creation.

**Key decisions:**
- Photo Manager: browse Drive photos, add descriptions/alt text/categories, mark as informative/decorative
- Upload pipeline: Drive → system → Cloudinary (triggered on finalization, not during editing)
- During editing, use Drive URLs (with fallback warning); on finalization, upload to Cloudinary and swap URLs
- CDN URL construction with transformation parameters: `f_auto,q_auto,w_1200` (hero) or `w_800` (inline)
- Photo selection in chat: "select photos for this article" workflow
- Photo manifest assembly for Layer 6 of system prompt

**Depends on:** Guide 1 (photos table), Guide 4 (renderer needs photo data), Guide 6 (UI).

**Human gate:** Open Photo Manager. Browse photos. Add descriptions. Select photos for an article. Generate — do photos appear in preview?

---

### Guide 10: Content Map Dashboard + Blog Registry

**What it builds:** The dashboard views — Table View, Hub View, article detail panel, filters, and link report.

**Key decisions:**
- Table View: sortable/filterable by hub, status, type, audience, date
- Hub View: visual hub-and-spoke tree with status indicators
- Article detail panel: shows metadata, links to HTML export, QA score, version history
- Status badges: 📋 Planned, ✍️ Drafting, 📦 Finalized, ✅ Published, 🔄 Needs Update
- Backfill link report: "these existing articles should now link to your new post"

**Depends on:** Guide 1 (schema), Guide 2 (seeded data), Guide 6 (UI shell).

**Human gate:** Dashboard shows all articles. Filters work. Click an article — detail panel opens. Status badges are correct.

---

### Guide 11: Finalization Flow + Version History

**What it builds:** The "Finalize Article" button flow — QA gate, Cloudinary upload trigger, dual commit (canonical doc + rendered HTML), version management, Copy/Download buttons, Mark as Published, and the re-edit flow.

**Key decisions:**
- Finalization blocked if any FAIL-level QA checks unresolved (unless explicitly overridden by admin)
- On finalize: upload new photos to Cloudinary → re-render with CDN URLs → commit both `article_documents` and `article_html` rows → update `content_map` status
- Version numbering: auto-increment on re-finalization
- Re-edit: loads most recent canonical doc into editor state, preserves HTML overrides
- Copy HTML: copies complete rendered HTML to clipboard
- Download .html: downloads the HTML file
- Mark as Published: updates status, activates internal links, generates backfill report

**Depends on:** All previous guides.

**Human gate:** Finalize an article. Verify DB rows. Copy HTML — paste into a blank HTML file — open in browser — does it look correct? Mark as Published — does status update?

---

### Guide 12: Wix Crawler + Site Reconciliation

**What it builds:** The Vercel Cron Job that reads the Wix sitemap, discovers published blog posts, and auto-updates the Blog Registry.

**Key decisions:**
- Vercel Cron: daily schedule (`0 6 * * *` — 6am UTC)
- Reads sitemap index → finds blog sub-sitemap → parses blog URLs → matches slugs to content_map
- Graceful handling when no blog sub-sitemap exists yet (Wix hasn't generated one)
- External post discovery: blog posts published outside the engine get added as `source = 'external'`
- Core page monitoring: detect new/changed/removed pages from `pages-sitemap.xml`
- Slug matching with fuzzy fallback on title

**Depends on:** Guide 1 (schema), Guide 2 (content map data).

**Human gate:** Trigger crawler manually. Verify it handles the current state (no blog sub-sitemap) gracefully. Test with a mock sitemap if no real posts exist yet.

---

## 8. Build Timeline and Milestones

### Milestone Map

| Milestone | Guides Complete | What You Can Do |
|---|---|---|
| **M1: Data foundation** | 1, 2, 3 | Log in, see seeded content map via API, query KB |
| **M2: Generation works** | + 4, 5 | Send a generation request and get a valid article back (API only, no UI) |
| **M3: Product is real** | + 6 | **Open the app, generate an article, see it render live in the preview** |
| **M4: Full editing** | + 7 | Chat, Canvas Edit, and HTML Mode all work with undo/redo |
| **M5: Quality assured** | + 8 | QA scorecard validates articles before finalization |
| **M6: Images work** | + 9 | Photos from Drive render in articles via Cloudinary CDN |
| **M7: Dashboard** | + 10 | Content Map dashboard shows all articles with status/filters |
| **M8: Ship it** | + 11 | Full finalization flow works — you can produce and export publication-ready HTML |
| **M9: Automated sync** | + 12 | Wix crawler keeps the Blog Registry current automatically |

### Estimated Build Effort

| Guide | Estimated Agent Time | Estimated Review Time | Notes |
|---|---|---|---|
| 1 | 60–90 min | 30 min | Large scope but straightforward patterns |
| 2 | 30–45 min | 15 min | Data import + CRUD, well-defined |
| 3 | 30–45 min | 20 min | External service integration — Onyx may have quirks |
| 4 | 90–120 min | 45 min | Hardest guide — schema + renderer is complex |
| 5 | 90–120 min | 30 min | Hardest integration — connects everything |
| 6 | 90–120 min | 60 min | Most UI work — your longest review |
| 7 | 60–90 min | 30 min | Complex but well-scoped |
| 8 | 45–60 min | 20 min | Lots of checks but each is small |
| 9 | 45–60 min | 20 min | External service integration |
| 10 | 60–90 min | 30 min | Dashboard UI |
| 11 | 60–90 min | 30 min | Integration of everything |
| 12 | 30–45 min | 15 min | Simplest guide |

**Total estimated build time:** 12–18 hours of agent execution + 5–6 hours of your review time.

---

## 9. Risk Registry

### Architectural Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Claude returns malformed JSON instead of valid CanonicalArticleDocument** | High (initially) | Medium — breaks streaming render | Zod validation + repair pass in Guide 4. Iterative prompt refinement. Fallback to partial rendering of valid sections. |
| **Onyx is slow or unresponsive on 4GB droplet** | Medium | Medium — generation blocked | Timeout handling (10s default), retry with backoff, fallback to generation without KB context (with warning to user). |
| **Compiled Template CSS conflicts with Wix's host page CSS** | Medium | Medium — articles look wrong on Wix | Template uses scoped class names (`bwc-*`). Test early by pasting sample HTML into Wix. |
| **Streaming structured JSON parsing is fragile** | High | Medium — preview doesn't update in real time | Use well-tested JSON streaming library. Fall back to rendering after complete response if streaming parse fails. |
| **Canvas Edit `data-cad-path` mapping breaks on complex content** | Medium | Low — Canvas Edit degrades gracefully | Comprehensive path mapping tests. Canvas Edit failures fall back to "use Chat mode for this edit." |
| **`agent-guard` API engine consumes tokens on every commit** | Low | Low — cost ~$0.13/commit | Monitor usage. Can switch to `claude-code` engine or disable narrative updates if costs are unexpected. |

### Build Process Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Agent introduces type error that cascades through downstream guides** | Medium | High | Gate 1 (type check) catches this. Shared contracts file is the integration firewall. |
| **Agent modifies files owned by a different guide** | Medium | Medium | File ownership table (§5E) is explicit. Guides instruct agents to stay within their scope. |
| **Human gate reveals fundamental UX issue late in the build** | Low | High | Major human gate at Guide 6 (M3). This is deliberately early — before investing in editing modes, QA, etc. |
| **Documentation drifts despite `agent-guard`** | Low | Medium | `agent-guard` CI/CD audit layer (GitHub Actions) runs on every push as a safety net beyond pre-commit hooks. |

---

## 10. Conventions and Standards

### Code Conventions

| Convention | Rule |
|---|---|
| Framework | Next.js 15+ App Router (Turbopack default bundler, React 19.2, Node 20.9.0+) |
| Language | TypeScript, strict mode |
| Styling | Tailwind CSS for app UI (not for blog article output — that uses the Compiled Template's own CSS) |
| State management | React Context for simple state, Zustand if complexity warrants |
| Database | Prisma ORM, Neon Postgres |
| Auth | NextAuth.js, CredentialsProvider, JWT sessions |
| API routes | Next.js Route Handlers (app directory) |
| Validation | Zod for runtime validation, TypeScript for compile-time |
| Error handling | Try/catch with typed errors, consistent error response format |
| Logging | `console.log` initially, structured logging with pino if complexity warrants |

### API Response Format

Every API route returns a consistent shape:

```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: { code: string, message: string, details?: any } }
```

### Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| API routes | kebab-case | `/api/content-map/[id]` |
| TypeScript files | kebab-case | `article-schema.ts` |
| TypeScript interfaces | PascalCase | `CanonicalArticleDocument` |
| TypeScript functions | camelCase | `assemblePromptLayers()` |
| Database tables | snake_case | `content_map` |
| Database columns | snake_case | `parent_hub_id` |
| Prisma models | PascalCase | `ContentMap` |
| React components | PascalCase | `PreviewPanel` |
| CSS classes (app UI) | Tailwind utilities | `className="flex gap-4"` |
| CSS classes (blog output) | BEM with `bwc-` prefix | `.bwc-pullquote` |
| Environment variables | SCREAMING_SNAKE_CASE | `ONYX_API_URL` |
| Git commits | Conventional Commits | `feat: add article renderer` |

### Error Response Codes

| Code | Used For |
|---|---|
| `AUTH_REQUIRED` | No valid session |
| `AUTH_FORBIDDEN` | Role insufficient |
| `VALIDATION_ERROR` | Zod validation failure |
| `NOT_FOUND` | Resource doesn't exist |
| `GENERATION_FAILED` | Claude API error |
| `ONYX_UNAVAILABLE` | Onyx timeout or error |
| `RENDER_ERROR` | Renderer failed |
| `QA_GATE_FAILED` | Finalization blocked by FAIL checks |
| `CLOUDINARY_ERROR` | Upload failed |
| `LINK_VERIFICATION_FAILED` | External URL returned non-200 |

---

## 11. `agent-guard` Detailed Setup (Executed in Guide 1)

### Installation & Init

```bash
npm install --save-dev @mossrussell/agent-guard
npx agent-guard init --yes --project-name "BWC Content Engine" --prisma --agent-config CLAUDE.md
```

This creates:
- `agent-docs.config.json` (configuration)
- `docs/ARCHITECTURE.md` (living architecture doc — separate from the project knowledge base version, this one evolves with the code)
- `docs/_generated/` directory (auto-generated inventories)
- Generator scripts for api-routes, prisma-models, env-vars
- `.husky/pre-commit` hook (runs generators + narrative updates)
- `CLAUDE.md` (standing instructions for Claude Code agents)

### Generator Configuration

The generators scan source code and produce markdown inventories:

| Generator | Scans | Produces | Runs On |
|---|---|---|---|
| `gen:api-routes` | `src/app/api/**/*.ts` | `docs/_generated/api-routes.md` | Every commit |
| `gen:models` | `prisma/schema.prisma` | `docs/_generated/prisma-models.md` | Every commit |
| `gen:env` | `.env.example` | `docs/_generated/env-vars.md` | Every commit |

### Narrative Update Configuration

When a commit changes files matching `narrativeTriggers` (API routes, Prisma schema, or env vars), the API engine:

1. Reads the current `docs/ARCHITECTURE.md`
2. Reads the relevant `docs/_generated/*.md` files
3. Reads the git diff
4. Calls Claude Sonnet to update the architecture doc's narrative sections
5. Stages the updated doc with the commit

Cost: ~$0.13/commit with the API engine. At the expected commit cadence during the build (~50-80 commits across all guides), total cost for `agent-guard` during the build is ~$6-10.

### `.env.example` Maintenance

Every guide that introduces a new environment variable must add it to `.env.example` with a descriptive comment. `agent-guard` will auto-generate `docs/_generated/env-vars.md` from this file. The `.env.example` file serves as the canonical inventory of all required env vars.

### `CLAUDE.md` Content

The `CLAUDE.md` file is the standing instructions document for Claude Code agents. It contains:

```markdown
# BWC Content Engine — Agent Instructions

## Project Overview
Content generation system for Bhutan Wine Company that produces publication-ready,
SEO-optimized blog posts. Next.js on Vercel + Neon Postgres + Onyx RAG + Claude API.

## Documentation Structure
- `docs/ARCHITECTURE.md` — Living architecture doc (auto-updated by agent-guard)
- `docs/_generated/` — Auto-generated inventories (DO NOT EDIT MANUALLY)
- Project knowledge base docs — READ ONLY references

## When You Change Code, Also Update:
1. `docs/ARCHITECTURE.md` if you add/remove API routes, DB tables, or major features
2. `.env.example` if you add new environment variables
3. `src/types/` if you change shared interfaces
4. Relevant test scripts in `scripts/`

## Conventions
[Naming, file structure, error handling patterns — from §10 of orchestration doc]

## Current Build State
[Updated by agent-guard on each commit — shows which guides are complete]
```

### Post-Build: Ongoing Documentation Sync

After the build is complete, `agent-guard` continues to provide value:

- Any code change by a human or agent that touches API routes, Prisma models, or env vars triggers auto-documentation updates
- The `docs/ARCHITECTURE.md` file becomes the living reference for the deployed system, always in sync with the actual code
- The CI/CD audit layer catches any drift that slips past the pre-commit hook
- Running `npx agent-guard sync` performs a full documentation pass at any time

---

## 12. The Critical First Session

### What to Produce First

In your first working session, produce these deliverables:

1. **This document** ✅ (you're reading it)
2. **Agent files** — The 3 agents and 2 skills in `.claude/` that drive the guide-production loop after Guide 1.
3. **Guide 1: Foundation** — The only guide produced manually. Includes the shared contracts (all TypeScript interfaces) as part of its scope. Also installs and configures `agent-guard` and commits the `.claude/` agent files to the repo.

### What Happens After Guide 1 Executes

Once Guide 1 passes all gates:

- The database has all tables (empty except for seeded admin user)
- Auth works (login, session, role checks)
- All TypeScript interfaces exist in `src/types/`
- `agent-guard` is running, generating docs on every commit
- `CLAUDE.md` gives agents full project context
- `.claude/agents/` and `.claude/skills/` are committed — the agent-driven loop is ready
- The scaffold is ready for any of Guides 2, 3, or 4

**From this point forward, you never produce guides manually.** Instead:

```
You:          /next-guide
Agent team:   [inspects codebase, verifies integrations, finds patterns]
Agent team:   "Exploration complete for Guide 2. Run /build-guide."
You:          /build-guide
Skill:        [reads exploration results + orchestration doc + architecture doc]
Skill:        "guide-2-content-map.md complete. 6 phases, 8 files."
You:          [review guide, open new Claude Code session]
You:          "Read guide-2-content-map.md. Execute each phase. Stop at gates."
Claude Code:  [executes Guide 2]
You:          [human gate check]
... repeat ...
```

### The Goal

The build goal is to reach **Milestone M3** (Guide 6 complete — "product is real") as fast as possible.

```
Session 1: Produce this doc + agent files + Guide 1 → Agent executes Guide 1
Session 2: /next-guide → /build-guide → Agent executes Guide 2
           /next-guide → /build-guide → Agent executes Guide 3
           (parallel if using branches)
Session 3: /next-guide → /build-guide → Agent executes Guide 4 (critical)
Session 4: /next-guide → /build-guide → Agent executes Guide 5 (critical)
Session 5: /next-guide → /build-guide → Agent executes Guide 6 → 🎉 M3: PRODUCT IS REAL
Session 6+: /next-guide → /build-guide → execute Guides 7-12 based on priority
```

---

## Appendix A: Full Database Schema (Reference)

This is the complete schema. The actual Prisma models are created in Guide 1.

### `users`
```sql
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT DEFAULT 'editor',    -- "admin" | "editor" | "viewer"
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

### `content_map`
```sql
CREATE TABLE content_map (
    id                      SERIAL PRIMARY KEY,
    hub_name                TEXT NOT NULL,
    article_type            TEXT NOT NULL,           -- "hub" | "spoke" | "news"
    title                   TEXT NOT NULL,
    slug                    TEXT UNIQUE,
    main_entity             TEXT NOT NULL,
    supporting_entities     TEXT[],
    target_keywords         TEXT[],
    search_volume_est       INTEGER,
    keyword_difficulty      TEXT,
    target_audience         TEXT,
    status                  TEXT DEFAULT 'planned',  -- planned | drafting | finalized | published | needs_update
    scheduled_date          DATE,
    published_date          DATE,
    published_url           TEXT,
    parent_hub_id           INTEGER REFERENCES content_map(id),
    content_notes           TEXT,
    suggested_external_links TEXT[],
    internal_links_to       TEXT[],
    word_count              INTEGER,
    qa_score                TEXT,
    author_name             TEXT,
    source                  TEXT DEFAULT 'engine',   -- "engine" | "external"
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);
```

### `article_documents`
```sql
CREATE TABLE article_documents (
    id              SERIAL PRIMARY KEY,
    article_id      INTEGER NOT NULL REFERENCES content_map(id),
    version         INTEGER NOT NULL DEFAULT 1,
    canonical_doc   JSONB NOT NULL,
    html_overrides  JSONB,
    finalized_at    TIMESTAMP DEFAULT NOW(),
    finalized_by    TEXT,
    notes           TEXT,
    UNIQUE(article_id, version)
);
```

### `article_html`
```sql
CREATE TABLE article_html (
    id                SERIAL PRIMARY KEY,
    article_id        INTEGER NOT NULL REFERENCES content_map(id),
    version           INTEGER NOT NULL DEFAULT 1,
    document_version  INTEGER NOT NULL,
    html_content      TEXT NOT NULL,
    meta_title        TEXT,
    meta_description  TEXT,
    schema_json       TEXT,
    finalized_at      TIMESTAMP DEFAULT NOW(),
    finalized_by      TEXT,
    qa_score          TEXT,
    qa_failures       INTEGER DEFAULT 0,
    notes             TEXT,
    UNIQUE(article_id, version)
);
```

### `internal_links`
```sql
CREATE TABLE internal_links (
    id              SERIAL PRIMARY KEY,
    source_article  INTEGER REFERENCES content_map(id),
    target_article  INTEGER REFERENCES content_map(id),
    target_core_page TEXT,
    anchor_text     TEXT,
    link_type       TEXT,    -- hub-to-spoke | spoke-to-hub | spoke-to-sibling | cross-cluster | to-core-page
    is_active       BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### `photos`
```sql
CREATE TABLE photos (
    id                    SERIAL PRIMARY KEY,
    drive_file_id         TEXT UNIQUE NOT NULL,
    drive_url             TEXT NOT NULL,
    cloudinary_public_id  TEXT,
    cloudinary_url        TEXT,
    filename              TEXT NOT NULL,
    category              TEXT,
    description           TEXT,
    alt_text              TEXT,
    classification        TEXT DEFAULT 'informative',
    vineyard_name         TEXT,
    season                TEXT,
    width_px              INTEGER,
    height_px             INTEGER,
    uploaded_to_cdn       BOOLEAN DEFAULT false,
    created_at            TIMESTAMP DEFAULT NOW()
);
```

### `article_photos`
```sql
CREATE TABLE article_photos (
    article_id    INTEGER REFERENCES content_map(id),
    photo_id      INTEGER REFERENCES photos(id),
    position      TEXT,
    PRIMARY KEY (article_id, photo_id)
);
```

### `leads`
```sql
CREATE TABLE leads (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL,
    first_name      TEXT,
    source_article  INTEGER REFERENCES content_map(id),
    source_url      TEXT,
    capture_type    TEXT NOT NULL,
    hub_topic       TEXT,
    wine_interest   TEXT,
    travel_dates    TEXT,
    ip_country      TEXT,
    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,
    synced_to_esp   BOOLEAN DEFAULT false,
    esp_contact_id  TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(email, source_article, capture_type)
);
```

### `lead_events`
```sql
CREATE TABLE lead_events (
    id              SERIAL PRIMARY KEY,
    lead_id         INTEGER REFERENCES leads(id),
    event_type      TEXT NOT NULL,
    event_data      JSONB,
    article_id      INTEGER REFERENCES content_map(id),
    created_at      TIMESTAMP DEFAULT NOW()
);
```

---

## Appendix B: Core Page Registry (Seed Data)

These core BWC pages are seeded into the `internal_links` table in Guide 2:

```sql
INSERT INTO internal_links (target_core_page, link_type) VALUES
  ('https://www.bhutanwine.com/the-grapes-vineyards',       'to-core-page'),
  ('https://www.bhutanwine.com/our-wine',                   'to-core-page'),
  ('https://www.bhutanwine.com/our-wine-2023-first-barrel', 'to-core-page'),
  ('https://www.bhutanwine.com/first-release',              'to-core-page'),
  ('https://www.bhutanwine.com/visit-us',                   'to-core-page'),
  ('https://www.bhutanwine.com/about-us',                   'to-core-page'),
  ('https://www.bhutanwine.com/in-the-news',                'to-core-page'),
  ('https://www.bhutanwine.com/gallery',                    'to-core-page'),
  ('https://www.bhutanwine.com/2024-inquiry-request',       'to-core-page'),
  ('https://www.bhutanwine.com/contact-us',                 'to-core-page');
```

---

## Appendix C: Content Map CSV Column Mapping

The content map CSV has 39 rows and 10 columns. Here is how they map to the `content_map` table:

| CSV Column | DB Column | Transform |
|---|---|---|
| `Hub Article` | `hub_name` | Direct |
| `Article Type` | `article_type` | Lowercase: "Hub" → "hub", "Spoke" → "spoke" |
| `Spoke Article Title` | `title` | Use this if present; else use `Hub Article` as title |
| `Target Keywords` | `target_keywords` | Split on `;`, trim whitespace → TEXT[] |
| `Search Volume Est.` | `search_volume_est` | Map "Low"→100, "Medium"→500, "High"→2000 (estimates for relative ranking) |
| `Difficulty` | `keyword_difficulty` | Lowercase: "Low", "Medium", "High" |
| `Target Audience` | `target_audience` | Direct |
| `Internal Links To` | `internal_links_to` | Split on `;`, trim → TEXT[] (these are descriptive, not URLs yet) |
| `Suggested External Source Links` | `suggested_external_links` | Split on `;`, trim → TEXT[] |
| `Content Notes` | `content_notes` | Direct |

Additional derived columns:
- `slug`: Generated from title (lowercase, hyphenated, stop words removed, 3–6 words)
- `main_entity`: Extracted from the first target keyword
- `supporting_entities`: Extracted from remaining target keywords
- `parent_hub_id`: For spoke articles, FK to the matching hub row's id
- `status`: Default "planned"
- `source`: Default "engine"

---

## Appendix D: QA Scorecard Check Registry (Quick Reference)

### FAIL-Level (17 checks — blocks finalization)

| # | Check | Rule |
|---|---|---|
| F1 | H1 present | Exactly 1 `<h1>` |
| F2 | Heading hierarchy | No skips (H1→H3 without H2), no H4–H6 |
| F3 | Executive Summary Block | Bolded, 25–40 words, after H1 |
| F4 | Meta title present | Non-empty, 50–60 chars |
| F5 | Meta description present | Non-empty, 150–160 chars |
| F6 | Word count in range | Hub: 2,500–4,000 / Spoke: 1,200–2,000 / News: 600–1,000 |
| F7 | Internal link minimum | Hub: 8 / Spoke: 5 / News: 3 |
| F8 | Core page link minimum | Hub: 4 / Spoke: 3 / News: 2 |
| F9 | External link minimum | Hub: 5 / Spoke: 3 / News: 2 |
| F10 | BlogPosting schema | Required fields present |
| F11 | Hero image alt text | Non-empty, descriptive |
| F12 | No blank alt attributes | Every `<img>` has alt (descriptive or `alt=""`) |
| F13 | Author byline | Name + credentials present |
| F14 | Publication date | Visible date element |
| F15 | Prohibited anchor text | No "click here," "read more," "learn more" |
| F16 | Internal links valid | All hrefs exist in Blog Registry or core page list |
| F17 | External links live | All hrefs return HTTP 200 |

### WARN-Level (26 checks — advisory)

| # | Check | Rule |
|---|---|---|
| W1 | H1 length | 50–65 chars |
| W2 | H2 count | Hub: 5–8 / Spoke: 3–5 / News: 2–3 |
| W3 | Duplicate headings | No identical heading text |
| W4 | Meta title ≠ H1 | Similar but not identical |
| W5 | Slug length | 3–6 words |
| W6 | Spoke → parent hub link | At least 1 |
| W7 | Sibling spoke links | 1–2 |
| W8 | Cross-cluster link | At least 1 |
| W9 | Anchor text length | 3–8 words |
| W10 | External links new tab | `target="_blank"` |
| W11 | No competitor links | No competing winery storefronts |
| W12 | External link distribution | Spread across sections |
| W13 | Trust tier coverage | At least 1 primary source |
| W14 | Image count | Hub: 5 / Spoke: 3 / News: 1 |
| W15 | Visual gap | Max 400 words between images |
| W16 | Alt text length | 10–25 words (informative images) |
| W17 | Location/process captions | Captions on relevant images |
| W18 | FAQ schema conditional | Present only if FAQ section exists |
| W19 | data-nosnippet | On pricing, legal, allocation terms |
| W20 | Hero image performance | `loading="eager"`, `fetchpriority="high"` |
| W21 | Image dimensions | Width/height on all `<img>` |
| W22 | Hardcoded volatile data | No price/ABV patterns |
| W23 | Main entity positions | In H1, summary, meta, first 100 words, ≥1 H2, conclusion |
| W24 | Reading level | Flesch-Kincaid Grade 10–14 |
| W25 | Citable paragraphs | At least 3 standalone |
| W26 | Canonical URL set | Present and correct |

---

*This document defines the build. The Implementation Guides define the work. The Shared Contracts define the integration surfaces. `agent-guard` keeps the documentation honest. Together, they turn the BWC Content Engine architecture into working software.*
