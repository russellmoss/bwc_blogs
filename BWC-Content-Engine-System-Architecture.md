# BWC Content Engine — System Architecture & Build Plan

**Purpose:** Technical blueprint for a content generation system that produces publication-ready, SEO-optimized blog posts for Bhutan Wine Company. The system connects a dynamic knowledge base to Claude's API through a conversational interface, enabling non-technical users to produce A+ content by answering questions and providing direction — not by writing code or understanding SEO mechanics.

**The Promise:** A non-technical team member opens the app, says "I want to write the spoke article about Traminette," and walks away 20 minutes later with a complete HTML blog post — photos embedded, internal links wired, schema markup injected, Wix-ready — that an elite SEO director would approve without revision.

---

## Current Infrastructure State — As Built

> **Last updated:** 2026-03-01
> This section documents what is actually deployed and working RIGHT NOW. It serves as the source of truth for all future implementation guides.

### Deployed Infrastructure

| Component | Status | Details |
|---|---|---|
| **Vercel Project** | ✅ Live | `bwc-content-engine` at `https://bwc-content-engine.vercel.app` |
| **GitHub Repo** | ✅ Connected | `russellmoss/bwc_blogs` — auto-deploys on push to `main` |
| **Neon Postgres** | ✅ Provisioned | Via Vercel Storage integration, US East |
| **Onyx CE (RAG)** | ✅ Running | Self-hosted on DigitalOcean droplet at `159.65.45.1`, accessible at `https://rmoss-onyx.xyz` |
| **Onyx Google Drive Connector** | ✅ Indexing | Connected to BWC knowledge base folder, OAuth authenticated |
| **Cloudinary** | ✅ Configured | Cloud name: `deahtb4kj`, upload preset: `blog` (signed) |
| **Cloudflare DNS** | ✅ Active | `rmoss-onyx.xyz` → `159.65.45.1`, SSL mode: Flexible |
| **Claude API** | ✅ Key set | Model: `claude-sonnet-4-5-20250929` |

### DigitalOcean Droplet (Onyx Host)

- **IP:** 159.65.45.1
- **OS:** Ubuntu 24.04 LTS
- **RAM:** 4GB + 4GB swap
- **Disk:** 80GB
- **Region:** NYC3
- **Domain:** `rmoss-onyx.xyz` (via Cloudflare, SSL Flexible)
- **Docker containers:** nginx, api_server, web_server, background, inference_model_server, indexing_model_server, relational_db (postgres), minio, cache (redis), index (vespa), code-interpreter
- **Auth:** Google OAuth (`russellmoss87@gmail.com`)
- **Connectors:** Google Drive (OAuth, pointed at BWC knowledge base folder)

### Vercel Project

- **Name:** `bwc-content-engine`
- **URL:** `https://bwc-content-engine.vercel.app`
- **Team/Scope:** `russell-moss-projects`
- **Region:** `iad1` (US East — Washington DC)
- **Framework:** Next.js (App Router)
- **GitHub:** `russellmoss/bwc_blogs` (auto-deploy on push to `main`)

### Current App Scaffold

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              ← Landing page (BWC branded)
│   ├── favicon.ico
│   ├── globals.css
│   ├── api/
│   │   └── health/
│   │       └── route.ts      ← Health check endpoint
│   └── (dashboard)/
│       └── page.tsx          ← Placeholder
├── lib/
│   ├── db/index.ts           ← Placeholder (Prisma client goes here)
│   ├── onyx/client.ts        ← Config object
│   ├── claude/client.ts      ← Config object
│   ├── cloudinary/client.ts  ← Config object
│   └── env.ts                ← Env validation
├── types/index.ts            ← Article type stub
└── config/site.ts            ← Site constants
```

### Environment Variables — Complete Inventory

| Variable | Service | Has Value | In Vercel |
|---|---|---|---|
| `NODE_ENV` | App | ✅ | ✅ |
| `APP_URL` | App | ✅ | ✅ |
| `NEXT_PUBLIC_APP_URL` | App | ✅ | ✅ |
| `DATABASE_URL` | Neon | ✅ | ✅ |
| `DATABASE_URL_UNPOOLED` | Neon | ✅ | ✅ |
| `PGHOST` | Neon | ✅ | ✅ |
| `PGHOST_UNPOOLED` | Neon | ✅ | ✅ |
| `PGUSER` | Neon | ✅ | ✅ |
| `PGDATABASE` | Neon | ✅ | ✅ |
| `PGPASSWORD` | Neon | ✅ | ✅ |
| `POSTGRES_URL` | Neon | ✅ | ✅ |
| `POSTGRES_URL_NON_POOLING` | Neon | ✅ | ✅ |
| `POSTGRES_USER` | Neon | ✅ | ✅ |
| `POSTGRES_HOST` | Neon | ✅ | ✅ |
| `POSTGRES_PASSWORD` | Neon | ✅ | ✅ |
| `POSTGRES_DATABASE` | Neon | ✅ | ✅ |
| `POSTGRES_URL_NO_SSL` | Neon | ✅ | ✅ |
| `POSTGRES_PRISMA_URL` | Neon | ✅ | ✅ |
| `DIRECT_URL` | Neon | ✅ | ✅ |
| `AUTH_SECRET` | Auth | ✅ | ✅ |
| `NEXTAUTH_SECRET` | Auth | ✅ | ✅ |
| `AUTH_URL` | Auth | ✅ | ✅ |
| `NEXTAUTH_URL` | Auth | ✅ | ✅ |
| `ADMIN_EMAIL` | Auth | ❌ placeholder | ✅ |
| `ADMIN_NAME` | Auth | ✅ | ✅ |
| `ADMIN_PASSWORD` | Auth | ❌ placeholder | ✅ |
| `ANTHROPIC_API_KEY` | Claude | ✅ | ✅ |
| `ANTHROPIC_MODEL` | Claude | ✅ | ✅ |
| `ANTHROPIC_SMALL_MODEL` | Claude | ✅ | ✅ |
| `ANTHROPIC_MAX_OUTPUT_TOKENS` | Claude | ✅ | ✅ |
| `ONYX_BASE_URL` | Onyx | ✅ | ✅ |
| `ONYX_API_URL` | Onyx | ✅ | ✅ |
| `ONYX_API_KEY` | Onyx | ✅ | ✅ |
| `ONYX_INDEX_NAME` | Onyx | ✅ | ✅ |
| `ONYX_SEARCH_TIMEOUT_MS` | Onyx | ✅ | ✅ |
| `CLOUDINARY_URL` | Cloudinary | ✅ | ✅ |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | ✅ | ✅ |
| `CLOUDINARY_API_KEY` | Cloudinary | ✅ | ✅ |
| `CLOUDINARY_API_SECRET` | Cloudinary | ✅ | ✅ |
| `CLOUDINARY_UPLOAD_FOLDER` | Cloudinary | ✅ | ✅ |
| `CLOUDINARY_SECURE_DELIVERY` | Cloudinary | ✅ | ✅ |
| `BWC_SITE_URL` | BWC Site | ✅ | ✅ |
| `BWC_BLOG_BASE_URL` | BWC Site | ✅ | ✅ |
| `BWC_SITEMAP_URL` | BWC Site | ✅ | ✅ |
| `CRON_SECRET` | App | ❌ placeholder | ✅ |
| `WIX_BLOG_COLLECTION_PATH` | BWC Site | ✅ | ✅ |
| `DEFAULT_CANONICAL_DOMAIN` | BWC Site | ✅ | ✅ |
| `DEFAULT_TIMEZONE` | App | ✅ | ✅ |
| `DEFAULT_LOCALE` | App | ✅ | ✅ |
| `ENABLE_QA_SCORECARD` | Feature Flag | ✅ | ✅ |
| `ENABLE_HTML_MODE` | Feature Flag | ✅ | ✅ |
| `ENABLE_CANVAS_EDIT` | Feature Flag | ✅ | ✅ |
| `ENABLE_WEB_SEARCH` | Feature Flag | ✅ | ✅ |
| `ENABLE_PHOTO_MANAGER` | Feature Flag | ✅ | ✅ |
| `ENABLE_LEAD_CAPTURE` | Feature Flag | ✅ | ✅ |
| `LINK_CHECK_TIMEOUT_MS` | App | ✅ | ✅ |
| `MAX_EXTERNAL_LINKS_PER_ARTICLE` | App | ✅ | ✅ |
| `USER_AGENT` | App | ✅ | ✅ |
| `CAPTURE_ENABLED` | Lead Capture | ✅ | ✅ |
| `CAPTURE_HMAC_SECRET` | Lead Capture | ❌ placeholder | ✅ |
| `DEFAULT_NEWSLETTER_LIST_ID` | Lead Capture | ❌ empty | ✅ |
| `DEFAULT_ALLOCATION_LIST_ID` | Lead Capture | ❌ empty | ✅ |
| `DEFAULT_TOUR_LIST_ID` | Lead Capture | ❌ empty | ✅ |
| `KLAVIYO_API_KEY` | ESP (Klaviyo) | ❌ empty | ✅ |
| `KLAVIYO_LIST_ID` | ESP (Klaviyo) | ❌ empty | ✅ |
| `MAILCHIMP_API_KEY` | ESP (Mailchimp) | ❌ empty | ✅ |
| `MAILCHIMP_SERVER_PREFIX` | ESP (Mailchimp) | ❌ empty | ✅ |
| `MAILCHIMP_AUDIENCE_ID` | ESP (Mailchimp) | ❌ empty | ✅ |
| `GSC_SITE_URL` | Google Search Console | ✅ | ✅ |
| `GOOGLE_CLIENT_ID` | Google API | ❌ empty | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google API | ❌ empty | ✅ |
| `GOOGLE_REFRESH_TOKEN` | Google API | ❌ empty | ✅ |
| `LOG_LEVEL` | Observability | ✅ | ✅ |
| `SENTRY_DSN` | Sentry | ❌ empty | ✅ |
| `SENTRY_AUTH_TOKEN` | Sentry | ❌ empty | ✅ |
| `SENTRY_ORG` | Sentry | ❌ empty | ✅ |
| `SENTRY_PROJECT` | Sentry | ❌ empty | ✅ |
| `SEED_DEV_DATA` | Dev | ✅ | ✅ |
| `SKIP_AUTH_IN_DEV` | Dev | ✅ | ✅ |

### Verified Endpoints

| Endpoint | URL | Status |
|---|---|---|
| Landing page | `https://bwc-content-engine.vercel.app` | ✅ |
| Health check | `https://bwc-content-engine.vercel.app/api/health` | ✅ |
| Onyx UI | `https://rmoss-onyx.xyz` | ✅ |

### What's NOT Built Yet

The architecture doc describes the following features that do **not** yet exist in the codebase:

- Prisma schema / database tables
- Auth system (NextAuth)
- Article generation orchestration
- Claude prompt assembly
- Onyx RAG integration in the app
- Split-pane UI (chat + preview)
- Canvas Edit mode
- HTML mode
- Article scorecard / QA system
- Image pipeline (Cloudinary integration)
- Internal link graph
- Content map / blog registry
- Schema markup generation
- Version history
- Finalized HTML export

---

## 1. System Overview

### What the System Does

1. **Knows everything BWC knows.** The system maintains a living connection to BWC's Google Drive, indexing every document — vineyard data, winemaker notes, tasting notes, press coverage, brand guidelines, photos — and making it queryable in real time.

2. **Knows the content strategy.** The system is aware of every hub article, every spoke, every target keyword, and every article that has or hasn't been written yet. It knows which content gaps remain and can recommend what to write next.

3. **Knows what's already published.** The system maintains a live registry of every blog post on bhutanwine.com — URLs, titles, publication dates, hub/spoke assignments, and the internal links each post contains. When it generates a new article, it links to real, published URLs — not placeholders.

4. **Generates structured content, then renders deployable HTML.** Not markdown. Not a rough draft. The system works in two stages: first, Claude generates a **Canonical Article Document** — a typed, structured representation of the entire article (title, sections, paragraphs, images, links, key facts, FAQ items, schema fields, and metadata). Second, the application's **rendering engine** converts that structured document into a single HTML block styled to BWC's Wix CSS specifications, using the Compiled Template's locked component library and stylesheet. Images are served via Cloudinary CDN (auto-optimized for WebP, compression, and responsive sizing), schema markup is injected by the renderer, and every internal/external link is in place. The user copies the rendered HTML into Wix's HTML embed and publishes. This separation keeps HTML generation deterministic and brand-consistent — the model focuses on content and structure, the renderer guarantees visual fidelity.

5. **Guides the user through the process.** The system asks the right questions in the right order — what article to write, what photos are available, what new data exists — so the user never needs to remember the SOP. The SOP is encoded in the system's behavior.

### What the System Does NOT Do

- It does not auto-publish to Wix. Wix's native blog editor and Velo API have limitations that make reliable automated publishing fragile. The deliberate "copy HTML into Wix" step also serves as a human review gate.
- It does not replace editorial judgment. It generates drafts. A human with wine knowledge reviews before publishing.
- It does not scrape or monitor competitor sites. Content strategy is driven by the Content Map, not reactive competitive analysis.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER (Browser)                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Next.js Frontend (Vercel)                 │  │
│  │                                                       │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │   Chat UI   │  │ Content Map  │  │  Blog Post   │  │  │
│  │  │ (Converse   │  │  Dashboard   │  │  Preview &   │  │  │
│  │  │  with the   │  │ (What's been │  │  HTML Export  │  │  │
│  │  │  engine)    │  │  written,    │  │              │  │  │
│  │  │             │  │  what hasn't)│  │              │  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  │  │
│  └─────────┼────────────────┼─────────────────┼──────────┘  │
└────────────┼────────────────┼─────────────────┼─────────────┘
             │                │                 │
             ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                Next.js API Routes (Vercel)                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 Orchestration Layer                    │   │
│  │                                                       │   │
│  │  1. Receive user message                              │   │
│  │  2. Query Onyx for relevant KB context                │   │
│  │  3. Query Blog Registry for published posts/links     │   │
│  │  4. Query Content Map for article metadata            │   │
│  │  5. Assemble system prompt (SOP + context + data)     │   │
│  │  6. Call Claude API → receive structured article       │   │
│  │  7. Validate structured output against article schema │   │
│  │  8. Render trusted HTML via Article Renderer          │   │
│  │  9. Push finalized photos → Cloudinary CDN            │   │
│  │ 10. Return rendered HTML + article state to frontend  │   │
│  └──┬──────────┬──────────┬──────────┬──────────┬───────┘   │
│     │          │          │          │          │            │
└─────┼──────────┼──────────┼──────────┼──────────┼───────────┘
      │          │          │          │          │
      ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐
│  Onyx CE │ │  Neon  │ │ Claude │ │  Google  │ │Cloudinary │
│ (Docker) │ │Postgres│ │  API   │ │  Drive   │ │   CDN     │
│          │ │        │ │        │ │          │ │           │
│ Indexes: │ │Stores: │ │Returns:│ │ Team     │ │ Serves:   │
│ - G Drive│ │- Blog  │ │Struct. │ │ uploads  │ │ - Auto    │
│   docs   │ │  Reg.  │ │Article │ │ photos & │ │   WebP    │
│ - Wines  │ │- Cont. │ │Document│ │ docs     │ │ - Auto    │
│ - Terroir│ │  Map   │ │(JSON)  │ │          │ │   compress│
│ - Press  │ │- Link  │ │        │ │ (Storage │ │ - Global  │
│ - Notes  │ │  Graph │ │        │ │  library)│ │   edge    │
│          │ │- Photo │ │        │ │          │ │   caching │
│          │ │  Reg.  │ │        │ │          │ │ - On-the- │
│          │ │- Art.  │ │        │ │          │ │   fly     │
│          │ │  Docs  │ │        │ │          │ │   resize  │
└──────────┘ └────────┘ └────────┘ └──────────┘ └───────────┘

Canonical Generation Flow:
  User request → Orchestration gathers context → Claude generates
  Canonical Article Document (structured JSON) → Orchestration validates
  against article schema → Article Renderer produces trusted Wix-ready
  HTML using Compiled Template components + stylesheet → Preview iframe
  renders final HTML → User iterates → Finalization stores BOTH the
  Canonical Article Document AND the rendered HTML artifact

Photo Flow:
  Google Drive (team uploads) ──► Photo Manager UI (catalog & describe)
       ──► Cloudinary Upload API (on article finalization)
            ──► CDN URL embedded in rendered HTML by Article Renderer
                 ──► User pastes HTML into Wix (images load from CDN)
```

---

## 3. Component Breakdown

### 3A. Knowledge Base — Onyx CE + Google Drive

**What it is:** Onyx (formerly Danswer) is an open-source, self-hosted RAG system that connects to data sources, indexes their content, and exposes a search/chat API. It replaces the need to build custom embedding pipelines, vector databases, or retrieval logic.

**How it connects:**

```
Google Drive (BWC Shared Drive)
    │
    ├── /Knowledge Base
    │   ├── /Vineyards & Terroir
    │   │   ├── Vineyard Master Data.gsheet
    │   │   ├── Soil Reports/
    │   │   └── Elevation Survey Data/
    │   ├── /Wines & Vintages
    │   │   ├── 2024 Vintage Portfolio.gdoc
    │   │   ├── 2025 Vintage Planning.gdoc
    │   │   └── Tasting Notes/
    │   ├── /Winemaker Reports
    │   │   ├── 2024 Harvest Log.gdoc
    │   │   └── Growing Season Notes/
    │   ├── /Brand & Story
    │   │   ├── Founder Bios.gdoc
    │   │   ├── Brand Voice Guide.gdoc
    │   │   └── Origin Story Master.gdoc
    │   ├── /Press & Authority
    │   │   ├── Jancis Robinson Coverage.pdf
    │   │   ├── Wine Enthusiast Feature.pdf
    │   │   ├── Bonhams Auction Results.gdoc
    │   │   └── Advisory Board.gdoc
    │   ├── /Tourism & Experiences
    │   │   └── Current Tour Offerings.gdoc
    │   └── /Commerce & Allocation
    │       ├── Current Pricing.gsheet
    │       └── Allocation Policy.gdoc
    │
    ├── /Blog Photos
    │   ├── /Vineyards
    │   │   ├── bajo-vineyard-harvest-2024-01.jpg
    │   │   ├── bajo-vineyard-harvest-2024-02.jpg
    │   │   └── ... (descriptive filenames)
    │   ├── /Winemaking
    │   ├── /Bhutan Culture
    │   ├── /Team
    │   └── /Food & Pairing
    │
    └── /System Documents
        ├── BWC-SEO-Blog-Master-SOP-2026.md
        ├── BWC-Brand-Style-Guide.md              (Document 1 — design intent, human + AI reads)
        ├── BWC-Compiled-Blog-Template.html        (Document 2 — locked CSS + component library, AI copies from)
        └── Site-Architecture-Internal-Linking-Guide.md
```

**Onyx configuration:**

- **Connector:** Google Drive (native Onyx connector — OAuth2, auto-re-indexes on a schedule)
- **Index scope:** The entire `/Knowledge Base` folder and `/System Documents` folder. The `/Blog Photos` folder is indexed for filenames and metadata only — Onyx does not process image content, but the system can list available photos.
- **Re-index frequency:** Every 6 hours (configurable). When someone updates the pricing spreadsheet or adds a new winemaker report, the system reflects that within hours.
- **Deployment:** Docker Compose on a small VPS (DigitalOcean $12–24/mo) or Railway. Onyx CE is MIT-licensed — no per-user fees.

**What it provides to the generation pipeline:**

When the orchestration layer needs context for an article about, say, the Bajo vineyard, it queries Onyx with structured questions:

```
"What is the current elevation, soil type, and planted varieties at Bajo vineyard?"
"What are the winemaker's notes on Merlot from Bajo in the most recent vintage?"
"Has Jancis Robinson or Wine Enthusiast written about Bajo specifically?"
```

Onyx returns relevant document chunks with source attribution. The orchestration layer packages these into the Claude API call as grounding context.

---

### 3B. Content Map & Blog Registry — Neon Serverless Postgres

**Why a database instead of Google Sheets:**

The Content Map starts as a Google Sheet (it already exists as one), but the system needs to query it programmatically — "give me all unpublished spokes in the High-Altitude Viticulture hub" or "what internal links should this article contain?" — and Google Sheets API is slow, rate-limited, and awkward for relational queries. The Blog Registry (tracking what's been published) needs to be updated transactionally — "mark this article as published and add it to the link graph."

Neon Serverless Postgres gives us a proper database with zero cold-start latency, a generous free tier, and native compatibility with Next.js on Vercel.

**Schema:**

```sql
-- The content strategy: every article BWC plans to write, plus its finalized output
CREATE TABLE content_map (
    id              SERIAL PRIMARY KEY,
    hub_name        TEXT NOT NULL,           -- "High-Altitude Viticulture"
    article_type    TEXT NOT NULL,           -- "hub" | "spoke" | "news"
    title           TEXT NOT NULL,           -- "How Bhutan Grows Wine Above the Clouds"
    slug            TEXT UNIQUE,             -- "high-altitude-viticulture-bhutan"
    main_entity     TEXT NOT NULL,           -- "high-altitude viticulture"
    supporting_entities TEXT[],              -- ARRAY of entity strings
    target_keywords TEXT[],                  -- ARRAY for reference (not density)
    search_volume_est INTEGER,              -- Monthly search volume estimate
    keyword_difficulty TEXT,                 -- "low" | "medium" | "high" | numeric score
    target_audience TEXT,                    -- "collectors" | "sommeliers" | "travelers" etc.
    status          TEXT DEFAULT 'planned',  -- "planned" | "drafting" | "finalized" |
                                             -- "published" | "needs_update"
    scheduled_date  DATE,                    -- Planned/target publish date
    published_date  DATE,                    -- Actual publish date (set on detection)
    published_url   TEXT,                    -- Full URL once live
    parent_hub_id   INTEGER REFERENCES content_map(id),
    content_notes   TEXT,                    -- Brief from content map CSV
    suggested_external_links TEXT[],         -- Pre-identified source URLs
    internal_links_to TEXT[],               -- Planned internal link targets (URLs or slugs)
    word_count      INTEGER,                -- Set when HTML is finalized
    qa_score        TEXT,                   -- Last QA scorecard result, e.g. "48/52"
    author_name     TEXT,                    -- Byline author
    source          TEXT DEFAULT 'engine',   -- "engine" | "external" (manually published in Wix)
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Stores the Canonical Article Document for every article (structured source of truth)
CREATE TABLE article_documents (
    id              SERIAL PRIMARY KEY,
    article_id      INTEGER NOT NULL REFERENCES content_map(id),
    version         INTEGER NOT NULL DEFAULT 1,  -- Increments on each re-finalization
    canonical_doc   JSONB NOT NULL,              -- The full Canonical Article Document (structured)
    html_overrides  JSONB,                       -- Any user HTML-mode overrides stored as patches
    finalized_at    TIMESTAMP DEFAULT NOW(),
    finalized_by    TEXT,                        -- User who clicked "Finalize"
    notes           TEXT,                        -- Optional: "Updated pricing for Q2 2026"

    UNIQUE(article_id, version)
);

-- Stores the rendered HTML for every article (plus version history)
-- HTML is a derived artifact produced by the Article Renderer from the Canonical Article Document
CREATE TABLE article_html (
    id              SERIAL PRIMARY KEY,
    article_id      INTEGER NOT NULL REFERENCES content_map(id),
    version         INTEGER NOT NULL DEFAULT 1,  -- Increments on each re-finalization
    document_version INTEGER NOT NULL,           -- References article_documents.version it was rendered from
    html_content    TEXT NOT NULL,               -- The complete, rendered HTML block
    meta_title      TEXT,                        -- Extracted by renderer from canonical doc
    meta_description TEXT,                       -- Extracted by renderer from canonical doc
    schema_json     TEXT,                        -- The JSON-LD schema block (rendered from canonical doc)
    finalized_at    TIMESTAMP DEFAULT NOW(),
    finalized_by    TEXT,                        -- User who clicked "Finalize"
    qa_score        TEXT,                        -- Scorecard result at time of finalization, e.g. "48/52"
    qa_failures     INTEGER DEFAULT 0,           -- Number of FAIL-level checks (must be 0 to finalize)
    notes           TEXT,                        -- Optional: "Updated pricing for Q2 2026"

    UNIQUE(article_id, version)
);

-- Every internal link relationship (both planned and actual)
CREATE TABLE internal_links (
    id              SERIAL PRIMARY KEY,
    source_article  INTEGER REFERENCES content_map(id),
    target_article  INTEGER REFERENCES content_map(id),
    target_core_page TEXT,                   -- OR a core BWC page URL
    anchor_text     TEXT,
    link_type       TEXT,                    -- "hub-to-spoke" | "spoke-to-hub" |
                                             -- "spoke-to-sibling" | "cross-cluster" |
                                             -- "to-core-page"
    is_active       BOOLEAN DEFAULT false,   -- true once both articles are published
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Photo registry: metadata for available images
CREATE TABLE photos (
    id              SERIAL PRIMARY KEY,
    drive_file_id   TEXT UNIQUE NOT NULL,    -- Google Drive file ID
    drive_url       TEXT NOT NULL,           -- Drive link (for team browsing)
    cloudinary_public_id TEXT,               -- Cloudinary asset ID (set after upload)
    cloudinary_url  TEXT,                    -- CDN URL (set after upload)
    filename        TEXT NOT NULL,
    category        TEXT,                    -- "vineyard" | "winemaking" | "culture" etc.
    description     TEXT,                    -- User-provided description
    alt_text        TEXT,                    -- Pre-written or AI-suggested
    classification  TEXT DEFAULT 'informative', -- "informative" | "decorative"
    vineyard_name   TEXT,                    -- If vineyard-specific
    season          TEXT,                    -- "spring" | "summer" | "harvest" | "winter"
    width_px        INTEGER,                -- Original dimensions (set after upload)
    height_px       INTEGER,                -- Original dimensions (set after upload)
    uploaded_to_cdn BOOLEAN DEFAULT false,   -- true once pushed to Cloudinary
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Track which photos are used in which articles
CREATE TABLE article_photos (
    article_id      INTEGER REFERENCES content_map(id),
    photo_id        INTEGER REFERENCES photos(id),
    position        TEXT,                    -- "hero" | "inline-1" | "inline-2" etc.
    PRIMARY KEY (article_id, photo_id)
);
```

**Core Page Registry (from live `pages-sitemap.xml`, captured Feb 2026):**

These are the permanent BWC site pages that the engine must know about for internal linking. Every blog post links to relevant core pages — not just other blog posts. This registry is seeded into the database on first setup and verified by the Wix site crawler on each run.

```sql
-- Seed the core pages that blog posts link to
INSERT INTO internal_links (target_core_page, link_type) VALUES
  -- Primary content pages (high-frequency link targets)
  ('https://www.bhutanwine.com/the-grapes-vineyards',   'to-core-page'),
  ('https://www.bhutanwine.com/our-wine',               'to-core-page'),
  ('https://www.bhutanwine.com/our-wine-2023-first-barrel', 'to-core-page'),
  ('https://www.bhutanwine.com/first-release',           'to-core-page'),
  ('https://www.bhutanwine.com/visit-us',                'to-core-page'),
  ('https://www.bhutanwine.com/about-us',                'to-core-page'),
  ('https://www.bhutanwine.com/in-the-news',             'to-core-page'),
  ('https://www.bhutanwine.com/gallery',                 'to-core-page'),
  -- CTA / conversion pages
  ('https://www.bhutanwine.com/2024-inquiry-request',    'to-core-page'),
  ('https://www.bhutanwine.com/contact-us',              'to-core-page');
  -- NOTE: /contact-4 and /general-6 are Wix auto-slugs — verify or rename before including
```

The engine uses this registry when assembling the Internal Link Graph (Layer 5 of the system prompt). For each article, the orchestration layer selects the relevant core pages based on the article's hub, main entity, and content type:

| Article Topic | Core Pages to Link | Anchor Text Pattern |
|---|---|---|
| Any wine-specific article | `/our-wine`, `/the-grapes-vineyards` | "explore our wines," "our vineyard sites" |
| Viticulture / terroir articles | `/the-grapes-vineyards` | "the vineyards of Bhutan" |
| Origin story / brand articles | `/about-us`, `/first-release` | "the founding of BWC," "our first vintage" |
| Travel / experience articles | `/visit-us`, `/gallery` | "plan your visit," "see the vineyards" |
| Articles mentioning allocation | `/2024-inquiry-request` | "request an allocation" |
| Press / authority articles | `/in-the-news` | "recent press coverage" |

**Sync from Google Sheets:** On first setup, import the existing Content Map CSV into the `content_map` table. From that point forward, the database is the source of truth. A simple admin action in the UI can re-import from Sheets if someone bulk-edits the spreadsheet, but day-to-day operations run against Postgres.

---

### 3C. The Frontend — Next.js on Vercel

**Authentication — Email/Password via NextAuth.js + Neon**

The Content Engine is a private tool for the BWC team — it needs login, but not a complex auth system. This uses the same proven pattern from the Savvy Dashboard (a production Next.js app on Vercel serving 35+ daily users against Neon Postgres).

**Stack:** NextAuth.js (CredentialsProvider) + Prisma + bcryptjs + Neon

**Schema (added to the existing Neon database):**

```sql
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    password_hash   TEXT NOT NULL,           -- bcryptjs hash (cost factor 10)
    role            TEXT DEFAULT 'editor',   -- "admin" | "editor" | "viewer"
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

**How it works:**

- User submits email + password on the login page
- NextAuth's `CredentialsProvider` calls a `validateUser()` function
- `validateUser()` normalizes email to lowercase, queries Prisma for the user, checks `is_active`, then runs `bcrypt.compare(password, user.password_hash)`
- On success, NextAuth creates a JWT session with user id, email, name, and role embedded via `jwt` and `session` callbacks
- On failure (wrong email, wrong password, inactive account), returns the same generic "Invalid email or password" — no info leakage
- The Prisma query wraps in `retryDatabaseOperation` with exponential backoff to handle Neon cold starts on Vercel

**Password utilities (bcryptjs, not native bcrypt — for Vercel/serverless compatibility):**

- `hashPassword(password)` → `bcrypt.hash(password, 10)` — random salt, 60-char hash
- `verifyPassword(password, hash)` → `bcrypt.compare(password, hash)` — extracts salt from stored hash, re-hashes, compares
- `validatePassword(password)` — minimum 8 characters

**Password mutation paths:**

- **Admin reset:** Admin role can reset any user's password via API route. Hashes new password and updates `password_hash` directly.
- **Self-service change:** Logged-in user provides current password (verified first), then sets a new one.

**What's intentionally excluded (vs. the Savvy Dashboard pattern):**

- No Upstash Redis rate limiting — this is a small-team internal tool, not a public-facing app
- No OAuth/Google login — unnecessary complexity for 2–5 users
- No forgot-password email flow — admin can reset passwords directly. Can be added later with SendGrid if the team grows.
- No password reset tokens table — not needed without the email flow

**Roles:**

| Role | Permissions |
|---|---|
| `admin` | Full access: generate content, manage Content Map, manage users, view leads, access all settings |
| `editor` | Generate content, iterate, finalize, view Content Map dashboard, view leads |
| `viewer` | Read-only: view Content Map, view published HTML, view leads dashboard |

Initial setup: seed one admin user (you) with a hashed password via a database migration or seed script. Admin creates additional users through the app.

**Three views, one app:**

#### View 1: Chat Interface + Live Preview (Primary)

This is where content gets made. The screen is split into two panes: the **conversation pane** on the left (where the user talks to the engine) and the **live preview canvas** on the right (where the renderer-produced HTML displays in real time as a fully styled blog post).

```
┌──────────────────────────────────┬──────────────────────────────────┐
│  CONVERSATION                    │  LIVE PREVIEW                    │
│                                  │                                  │
│  Engine: Welcome back. You have  │  ┌────────────────────────────┐  │
│  4 spoke articles planned in the │  │                            │  │
│  "Emerging Wine Regions" hub     │  │  [Rendered HTML article    │  │
│  that haven't been written yet.  │  │   appears here — fully     │  │
│  The highest-priority gap is     │  │   styled with BWC fonts,   │  │
│  "Best Wineries in Asia."       │  │   colors, images from      │  │
│                                  │  │   Cloudinary CDN, live     │  │
│  Would you like to work on that  │  │   links, and accurate      │  │
│  one, or did you have something  │  │   mobile/desktop layout]   │  │
│  else in mind?                   │  │                            │  │
│                                  │  │  The preview updates in    │  │
│  User: Let's do the Traminette   │  │  real time as the engine   │  │
│  grape guide instead. I just got │  │  generates content and the │  │
│  new tasting notes from Matt.    │  │  renderer produces HTML.   │  │
│                                  │  │  The user sees the blog    │  │
│  Engine: Great choice. I can see │  │  post taking shape — not   │  │
│  the "Traminette Grape Guide"    │  │  raw code.                 │  │
│  is a spoke under the "Complete  │  │                            │  │
│  Guide to Bhutan Wine" hub.      │  └────────────────────────────┘  │
│  I've pulled the latest data     │  [📱 Mobile] [🖥 Desktop] [</>]  │
│  from the Knowledge Base...      │  [💬 Chat] [✏️ Canvas] [🔧 HTML] │
│                                  │                                  │
│  Before I draft, I need a few    │  [Copy HTML] [Download .html]    │
│  things:                         │  [↩ Undo] [↪ Redo]              │
│                                  │  [Finalize Article ▶]            │
│  1. New tasting notes — paste    │                                  │
│     or confirm in the Drive?     │                                  │
│                                  │                                  │
│  2. Do you have photos?          │                                  │
│                                  │                                  │
│  3. Any specific angle?          │                                  │
│                                  │                                  │
├──────────────────────────────────┤                                  │
│  [Type your message...]  [Send ▶]│                                  │
└──────────────────────────────────┴──────────────────────────────────┘
```

**How the live preview works:**

The preview canvas is a **sandboxed iframe** that renders trusted HTML exactly as it will appear on the Wix blog. When Claude streams the structured article content, the orchestration layer incrementally feeds the arriving structured nodes to the **Article Renderer**, which produces HTML fragments using the Compiled Template's locked component library and stylesheet. Those rendered HTML fragments are injected into the iframe in real time — the user watches the article take shape visually as the AI generates it, just like watching a message stream in regular Claude chat, but rendered as a styled web page instead of raw text.

The key difference from a raw-HTML-streaming approach: the preview always shows **renderer-produced HTML**, not raw model output. This guarantees that every preview frame is valid, brand-consistent, and structurally correct — even mid-stream. The Compiled Template's `<style>` block and component patterns are applied by the renderer, not assembled by the model.

The preview includes:
- **Full CSS rendering.** The Compiled Template's `<style>` block is loaded into the iframe by the renderer, so fonts, colors, spacing, and layout match the production site identically on every generation run.
- **Live images.** Photos render from their Cloudinary CDN URLs (or Google Drive URLs during drafting before finalization pushes them to CDN).
- **Clickable links.** Internal and external links in the preview are functional — the user can click them to verify they lead to the right destination (links open in a new tab from the iframe).
- **Mobile/Desktop toggle.** The user switches between a 375px mobile viewport and a 1200px desktop viewport to verify responsive behavior. This catches layout issues before they reach Wix.
- **Raw HTML view.** A `</>` toggle switches the right pane from rendered preview to a syntax-highlighted code view of the rendered HTML — useful for the user who will paste this into Wix to see exactly what they're copying. This HTML is a derived artifact produced by the renderer from the Canonical Article Document.

**Three Editing Modes — the user picks what fits the edit:**

The canvas supports three ways to modify the article, and the user can switch freely between them during a single session. A toolbar at the top of the preview pane shows the active mode:

```
[📱 Mobile] [🖥 Desktop] [</>]    Mode: [💬 Chat] [✏️ Canvas Edit] [🔧 HTML]
                                              ↑ active

[Copy HTML] [Download .html] [↩ Undo] [↪ Redo] [🔍 QA Check] [Finalize Article ▶]
```

**Mode 1: 💬 Chat (default)** — Talk to the engine, it modifies the article.

This is the existing conversation-driven iteration. The user describes what they want changed in natural language on the left pane. Claude updates the relevant section(s) of the **Canonical Article Document** — the structured representation of the article — and the **Article Renderer** regenerates the affected HTML. The preview updates in real time. The user sees the same magical streaming experience, but under the hood the model is editing a structured document, not splicing raw HTML strings. Best for:
- Structural changes (add a section, move paragraphs, insert a key-facts box)
- Creative rewrites ("make the opening more narrative")
- Research-dependent edits ("find a specific Jancis Robinson quote about this grape")
- Batch changes ("add internal links to every section")
- KB-aware edits ("update the pricing from the latest data")
- Link-aware edits ("add a link to the parent hub article")
- Image/component requests ("swap the hero image," "add a key-facts box")
- Anything that requires the engine's knowledge of the KB, link graph, or SEO rules

**Mode 2: ✏️ Canvas Edit** — Click directly into the article and type.

When the user activates Canvas Edit mode, the iframe becomes a live editing surface. They click on any text element — headings, paragraphs, list items, captions, blockquotes — and a cursor appears. They type, delete, rephrase, fix typos, exactly like editing in Google Docs or Notion. No HTML knowledge required. No waiting for Claude to regenerate.

How it works technically:

1. When Canvas Edit is activated, the parent app injects `contenteditable="true"` on all editable text elements inside the iframe (`h1`, `h2`, `h3`, `p`, `li`, `figcaption`, `blockquote`, `td`, `.bwc-key-fact-value`, `.bwc-pull-quote-text`, etc.). Each editable element is mapped to a specific field or content node in the **Canonical Article Document** via `data-cad-path` attributes injected by the renderer (e.g., `data-cad-path="sections[2].paragraphs[0].text"`).
2. Non-text elements remain locked — images, structural containers, navigation components, capture forms, and schema blocks are not editable. They get a subtle locked-icon overlay on hover so the user knows to use Chat mode for those.
3. The currently focused element gets a subtle highlight border (thin blue outline) so the user knows exactly what they're editing.
4. As the user types, the app listens for `input` events on the iframe's editable elements and syncs the changes back to the **Canonical Article Document** — not raw HTML. The `data-cad-path` attribute on each element tells the sync layer which field in the structured document to update. This sync is debounced (300ms) — it doesn't fire on every keystroke. After the canonical document updates, the renderer regenerates the affected HTML fragment so the preview and HTML source view stay consistent.
5. The HTML source view (`</>` mode) stays in sync — if the user switches to raw HTML after making canvas edits, the source reflects their changes (because the renderer re-derived the HTML from the updated canonical document).
6. **Undo/Redo** — Canvas edits are tracked in a local history stack that operates on the **Canonical Article Document state**, not raw HTML strings. The toolbar shows Undo (↩) and Redo (↪) buttons. `Ctrl+Z` / `Cmd+Z` works inside the iframe. Each undo step represents either a single canvas edit or a single Claude-driven document update, so undo works across both editing modes and always produces a valid article state.

What users can do in Canvas Edit mode:
- Fix typos, rephrase sentences, adjust word choice (updates paragraph text nodes)
- Change headings (updates section heading fields)
- Edit list items (updates list item text nodes)
- Modify image captions and alt text (updates caption/alt fields in the image placement)
- Edit key-facts box values (updates key-fact value fields)
- Adjust pull quotes (updates pull-quote text fields)
- Edit table cell contents (updates table cell value fields)

What users cannot do in Canvas Edit mode (use Chat or HTML mode instead):
- Add or remove sections, paragraphs, or headings
- Insert or swap images
- Add or modify links (the `<a>` tag's `href` isn't editable via click-to-type)
- Change CSS styling
- Move content between sections
- Insert components (key-facts boxes, capture forms, etc.)

This is intentional. Canvas Edit handles the 80% of edits that are just "change these words." Every Canvas Edit maps cleanly to a field in the Canonical Article Document — it's always a controlled, schema-valid mutation. The other 20% — structural or semantic changes — go through Chat mode where Claude can update the document structure, the link graph, and schema markup coherently.

**Mode 3: 🔧 HTML** — Edit the rendered HTML source directly.

The right pane switches to a syntax-highlighted code editor (CodeMirror or Monaco) showing the **renderer-produced HTML** — the same HTML that will be pasted into Wix. Power users or developers can edit this source directly. Changes render in real time when the user switches back to Desktop or Mobile preview. This is the escape hatch for anything the other two modes can't handle — custom CSS tweaks, adding a `data-` attribute, adjusting a component's markup.

How HTML mode edits sync with the Canonical Article Document:

1. **Safe text patches** — If the user edits text content within a known component structure (e.g., changing paragraph text, heading text, caption text inside a recognized HTML pattern), the system maps the edit back to the corresponding field in the Canonical Article Document. The renderer re-derives clean HTML on the next render cycle, preserving the edit.
2. **Structural overrides** — If the user makes an HTML edit that cannot be cleanly mapped back to the canonical document (e.g., adding a custom `class` attribute, inserting a non-standard element, tweaking CSS), the system stores the edit as a **controlled HTML override** in the `html_overrides` field of the article state. These overrides are re-applied by the renderer after it generates the base HTML from the canonical document, so they persist through subsequent Chat and Canvas edits without being lost.
3. **The override layer is explicit** — the system tracks which parts of the final HTML are renderer-produced and which are user-overridden. The Article Scorecard can flag overrides for review if they affect schema, accessibility, or structural compliance.

This means HTML mode remains a full-power escape hatch — nothing is broken or second-class about it. Advanced users retain complete control over the final output. The difference is that the system now knows what's canonical (from the structured document) and what's a human override (from direct HTML editing), making the entire state more auditable and maintainable.

**How the three modes interact:**

All three modes operate on the same **Canonical Article Document** as the source of truth, with **rendered HTML as a derived artifact**. The state flow:

```
┌──────────────────────────────────────────────────────────────┐
│     Canonical Article Document (structured source of truth)   │
│     + HTML Overrides (from direct HTML editing)               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  💬 Chat Mode                                                │
│  Claude updates section(s) of the canonical document         │
│  → Article Renderer regenerates affected HTML                │
│  → Preview updates with renderer output                      │
│  → HTML source view updates (derived from renderer)          │
│  → Canonical document state pushed to undo stack             │
│                                                              │
│  ✏️ Canvas Edit Mode                                          │
│  User types in a paragraph                                   │
│  → input event fires on iframe element                       │
│  → data-cad-path maps edit to canonical document field       │
│  → Canonical document updates                                │
│  → Renderer regenerates affected HTML fragment               │
│  → HTML source view updates                                  │
│  → Canonical document state pushed to undo stack             │
│                                                              │
│  🔧 HTML Mode                                                │
│  User edits rendered HTML source                             │
│  → Safe text patches: mapped back to canonical document      │
│  → Structural overrides: stored in HTML overrides layer      │
│  → Preview re-renders (renderer output + overrides applied)  │
│  → State pushed to undo stack                                │
│                                                              │
│  ↕ Article Renderer (runs after every edit from any mode)    │
│  Takes: canonical document + compiled template + overrides   │
│  Produces: trusted, brand-consistent Wix-ready HTML          │
│                                                              │
│  Undo/Redo operates on the unified stack of canonical        │
│  document states + override states, regardless of which      │
│  mode made the change.                                       │
└──────────────────────────────────────────────────────────────┘
```

The user can freely mix modes in a single session. A typical flow might look like:

1. **Chat:** "Generate the Traminette Grape Guide article"
2. **Chat:** "Make the opening more narrative"
3. **Canvas Edit:** Click into the third paragraph, fix a typo, rephrase a sentence
4. **Canvas Edit:** Change the H2 from "Growing Conditions" to "Where Traminette Thrives"
5. **Chat:** "Add a key-facts box after the first H2 with elevation, soil type, and varieties"
6. **Canvas Edit:** Click into the key-facts box, change "2,200m" to "2,250m" (the user has fresher data than the KB)
7. **Chat:** "Swap the hero image with the fence photo"
8. **Canvas Edit:** Fix the image caption wording
9. **Finalize Article** → Canonical Article Document + rendered HTML committed to database with all edits from all modes

**The iteration loop (updated with all three modes):**

> **User (Chat):** "The opening is too dry. Make it more narrative — describe the feeling of walking through Bajo at harvest."
>
> **Engine:** *[Updates the opening section in the Canonical Article Document. The renderer regenerates the section's HTML. The preview pane updates in real time — the old opening fades and the new one streams in, fully styled.]*
>
> **User (Canvas Edit):** *[Clicks into the second paragraph, changes "The vineyard sits at 2,200 meters" to "The vineyard clings to the hillside at 2,250 meters" — types it directly, sees it render instantly.]*
>
> **User (Chat):** "Swap the hero image with the fence photo instead."
>
> **Engine:** *[Updates the heroImage field in the Canonical Article Document. The renderer regenerates the hero figure HTML. The preview pane instantly reflects the new hero — loaded from Cloudinary, properly sized, with the correct alt text displayed on hover.]*
>
> **User (Canvas Edit):** *[Clicks the image caption, changes "Vineyard at sunset" to "The Bajo vineyard fence line at golden hour, looking east toward the Himalayas."]*
>
> **User (Chat):** "Add a key facts box after the first H2 with the vineyard elevation, soil type, and planted varieties."
>
> **Engine:** *[Inserts a keyFacts content node into the Canonical Article Document, populated with data from the Knowledge Base. The renderer produces the key-facts box HTML using the Compiled Template's component. It appears in the preview with the correct styling — cream background, definition list layout, gold accent heading.]*
>
> **User (Canvas Edit):** *[Clicks into the key-facts box, notices the soil type says "alluvial clay" but the latest report says "glacial alluvial clay loam" — types the correction directly.]*

The user never has to see raw HTML unless they want to. They can write and edit the article as naturally as they would in a word processor, while still having Claude available for the heavy lifting — structural changes, research, SEO, link management, and creative rewrites.

**Key behaviors of the chat interface:**

- On session start, the engine reviews the Content Map database and surfaces the highest-priority content gaps or recommendations.
- When the user selects an article, the engine queries Onyx for all relevant KB context, the Blog Registry for published articles to link to, and web search for current external sources.
- The engine asks for photos, new data, and editorial direction before generating.
- Generation streams structured content into the Article Renderer, which produces HTML fragments that appear in the live preview pane in real time — the user watches the styled article appear.
- The user iterates in natural language until satisfied. Each edit updates the Canonical Article Document, the renderer regenerates affected HTML, and the preview updates immediately.
- **"Finalize Article"** first runs the Article Scorecard (Section 3L) against the rendered HTML and extracted metadata — if any FAIL-level checks are unresolved, finalization is blocked until fixed. On pass, it triggers the Cloudinary photo upload, link verification, and **commits both the Canonical Article Document and the rendered HTML to the database** with versioning and the QA score. The article appears as 📦 in the Content Map dashboard with instant access to copy/download the stored HTML.
- **"Mark as Published"** (manual shortcut) or the Wix site crawler (automatic, daily) updates the Blog Registry after the article goes live on Wix.

#### View 2: Content Map Dashboard

The dashboard has two sub-views: a **Table View** showing every article with full metadata, and a **Hub View** showing the visual hub-and-spoke tree. The user toggles between them.

**Table View (default):**

The table is sortable and filterable by any column. Every row is clickable — opening the article detail panel.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Content Map                                          [Hub View] [Table View ●]  [+ New Article]  [Filters ▼] │
│                                                                                                                │
│  Filters: Hub [All ▼]  Status [All ▼]  Type [All ▼]  Audience [All ▼]  Date Range [Any ▼]                     │
├──────┬──────────────┬──────┬──────────────────────────────┬────────────────────┬───────┬──────┬────────┬───────┤
│ Hub  │ Type         │ Stat │ Title                        │ Target Keywords    │ Vol.  │ Diff │ Sched. │ Pub.  │
├──────┼──────────────┼──────┼──────────────────────────────┼────────────────────┼───────┼──────┼────────┼───────┤
│ BWC  │ 🏛 Hub       │ ✅   │ Bhutan Wine: Complete Guide  │ bhutan wine, bhu...│ 2,400 │ Med  │ Jan 15 │ Jan 15│
│ BWC  │ ◗ Spoke      │ ✅   │ Himalayan Terroir Explained  │ himalayan terroir  │   880 │ Low  │ Jan 22 │ Jan 24│
│ BWC  │ ◗ Spoke      │ 📦   │ Traminette Grape Guide       │ traminette grape   │   590 │ Low  │ Feb 28 │  —    │
│ BWC  │ ◗ Spoke      │ ✅   │ The Ser Kem Auction Story    │ bhutan wine auct...│   320 │ Low  │ Feb 01 │ Feb 03│
│ BWC  │ ◗ Spoke      │ ⬜   │ Bhutan Grape Varieties Deep  │ bhutan grape var...│   720 │ Med  │ Mar 15 │  —    │
│ BWC  │ ◗ Spoke      │ ⬜   │ 2024 Vintage Tasting Notes   │ bhutan wine 2024   │   440 │ Low  │ Mar 22 │  —    │
│ ALT  │ 🏛 Hub       │ ✅   │ High-Altitude Viticulture    │ high altitude vi...│ 1,600 │ High │ Jan 08 │ Jan 10│
│ ALT  │ ◗ Spoke      │ 🔶   │ World's Highest Vineyards    │ highest vineyards  │   950 │ Med  │ Mar 01 │  —    │
│ EMR  │ 🏛 Hub       │ ⬜   │ Emerging Wine Regions        │ emerging wine re...│ 3,200 │ High │ Apr 01 │  —    │
│ ...  │              │      │                              │                    │       │      │        │       │
└──────┴──────────────┴──────┴──────────────────────────────┴────────────────────┴───────┴──────┴────────┴───────┘

  ✅ = Published    📦 = Finalized (HTML ready)    🔶 = Drafting    ⬜ = Planned
```

**Status lifecycle:** `Planned → Drafting → Finalized → Published → Needs Update`

- **Planned:** Article is in the content strategy but no work has started.
- **Drafting:** Someone has opened this article in the Chat Interface and is actively iterating.
- **Finalized:** The user clicked "Finalize Article" — HTML is committed to the database, photos are on Cloudinary, links are verified. Ready to paste into Wix.
- **Published:** The article is live on bhutanwine.com (detected by the Wix crawler or manually marked).
- **Needs Update:** A significant KB change or content refresh trigger has flagged this article for revision.

**Hub View (alternate):**

The original tree visualization, now with dates and status badges:

```
┌─────────────────────────────────────────────────────────────────┐
│  Content Map                     [Hub View ●] [Table View]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Hub: Complete Guide to Bhutan Wine               [5/8 spokes] │
│  ├── ✅ Bhutan Wine: The Complete Guide (Hub)     Pub: Jan 15   │
│  ├── ✅ Himalayan Terroir Explained               Pub: Jan 24   │
│  ├── 📦 Traminette Grape Guide         Finalized: Feb 28       │
│  ├── ✅ The Ser Kem Auction Story                 Pub: Feb 03   │
│  ├── ✅ Buddhist Winemaking: Ahimsa               Pub: Feb 10   │
│  ├── ⬜ Bhutan Grape Varieties Deep Dive           Sched: Mar 15 │
│  ├── ⬜ 2024 Vintage Tasting Notes                 Sched: Mar 22 │
│  └── ⬜ Visiting BWC: The Vineyard Tour Guide      Sched: Apr 05 │
│                                                                 │
│  Hub: High-Altitude Viticulture                   [2/6 spokes] │
│  ├── ✅ High-Altitude Viticulture (Hub)           Pub: Jan 10   │
│  ├── ✅ UV Exposure and Phenolic Ripeness         Pub: Feb 14   │
│  ├── 🔶 World's Highest Vineyards Compared        Sched: Mar 01 │
│  ...                                                            │
└─────────────────────────────────────────────────────────────────┘
```

**Clicking any row opens the Article Detail Panel:**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Content Map                                                       │
│                                                                              │
│  Traminette Grape Guide                                       Status: 📦    │
│  ─────────────────────────────────────────────────────────────────────       │
│                                                                              │
│  METADATA                                                                    │
│  ┌─────────────────────────┬───────────────────────────────────────────────┐ │
│  │ Hub                     │ Complete Guide to Bhutan Wine                 │ │
│  │ Article Type            │ Spoke                                        │ │
│  │ Main Entity             │ Traminette grape                             │ │
│  │ Target Keywords         │ traminette grape, traminette wine, bhutan... │ │
│  │ Search Volume (est.)    │ 590/mo                                       │ │
│  │ Difficulty              │ Low                                          │ │
│  │ Target Audience         │ Sommeliers, collectors                       │ │
│  │ Author                  │ Michael [Last Name]                          │ │
│  │ Word Count              │ 2,340                                        │ │
│  │ Internal Links To       │ Hub Article, Himalayan Terroir, Visit Us...  │ │
│  │ External Sources Used   │ OIV, Jancis Robinson, Cornell Viticulture    │ │
│  │ Content Notes           │ Include new tasting notes from Matt...       │ │
│  ├─────────────────────────┼───────────────────────────────────────────────┤ │
│  │ Scheduled Publish Date  │ February 28, 2026                            │ │
│  │ Finalized Date          │ February 28, 2026 at 3:42 PM                 │ │
│  │ Actual Publish Date     │ — (not yet published)                        │ │
│  │ Published URL           │ — (not yet published)                        │ │
│  │ HTML Version            │ v1                                           │ │
│  │ QA Score                │ 48/52 ✅ (0 failures, 4 warnings)             │ │
│  └─────────────────────────┴───────────────────────────────────────────────┘ │
│                                                                              │
│  ACTIONS                                                                     │
│  [📄 View HTML]  [📋 Copy HTML]  [⬇ Download .html]  [✏️ Edit in Chat]      │
│  [📅 Set Scheduled Date]  [✅ Mark as Published]  [🔍 View QA Report]       │
│                                                                              │
│  HTML PREVIEW (click "View HTML" to expand)                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                        │  │
│  │  [Rendered iframe preview of the stored HTML — same as the live       │  │
│  │   preview canvas, but loaded from the database instead of a           │  │
│  │   generation stream. Shows the article exactly as finalized.]         │  │
│  │                                                                        │  │
│  │  [📱 Mobile] [🖥 Desktop] [</> Raw HTML]                              │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  VERSION HISTORY                                                             │
│  ┌──────┬──────────────────────┬──────────────┬───────────────────────────┐  │
│  │ Ver. │ Finalized            │ By           │ Notes                     │  │
│  ├──────┼──────────────────────┼──────────────┼───────────────────────────┤  │
│  │ v1   │ Feb 28, 2026 3:42 PM │ Russell      │ Initial finalization      │  │
│  │ v2   │ Mar 15, 2026 1:10 PM │ Russell      │ Updated pricing for Q2    │  │
│  └──────┴──────────────────────┴──────────────┴───────────────────────────┘  │
│                                                                              │
│  LEAD CAPTURE                                                                │
│  3 leads captured from this article (2 newsletter, 1 allocation)             │
│  [View Leads →]                                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**How "Finalize Article" commits the article to the database:**

When the user clicks **"Finalize Article"** in the Chat Interface after completing the iteration loop, the system:

1. Pushes any new photos to Cloudinary (if not already uploaded)
2. Runs final link verification (internal + external)
3. Runs the Article Renderer one final time against the current Canonical Article Document to produce the definitive HTML artifact
4. Writes a new row to the `article_documents` table with the complete Canonical Article Document (structured JSON), any HTML overrides, a version number (auto-incremented), timestamp, and the user's name
5. Writes a corresponding row to the `article_html` table with the rendered HTML, meta title, meta description, extracted schema JSON (all derived from the canonical document by the renderer), the QA score, and a reference to the document version it was rendered from
6. Updates the `content_map` row: status → "finalized," sets `word_count`, `qa_score`, `updated_at`
7. The article now appears as 📦 in the dashboard with a "Copy HTML" button

Both the Canonical Article Document and the rendered HTML live in Neon permanently. The user can return to the dashboard at any time — days, weeks, months later — click the article, and immediately view, copy, or download the finalized HTML. If they need to update the article later (new pricing, new vintage data), they open it in the Chat Interface via "Edit in Chat," which loads the most recent **Canonical Article Document** into the editor state and renders the preview from it. They iterate, and re-finalize — which creates **new versions** in both `article_documents` and `article_html` while preserving all previous versions in the version history.

**How publication date gets set:**

- **Scheduled date:** Set manually by the user in the Article Detail Panel via "Set Scheduled Date." This is the *target* publish date — when the team plans to paste it into Wix and go live. The dashboard can sort and filter by this date to show an editorial calendar view.
- **Actual publish date:** Set automatically by the Wix site crawler when it discovers the article's URL in the sitemap (Section 3I). Can also be set manually via "Mark as Published." The dashboard displays both dates — if the actual publish date slipped from the scheduled date, that's visible at a glance.

This view lets the user see the entire content pipeline at a glance — what's planned, what's being drafted, what's ready to publish, and what's live. Clicking any article gives full access to its metadata, its finalized HTML (with version history), and its performance data.

#### View 3: Photo Manager

A simple interface for managing the photo library.

```
┌─────────────────────────────────────────────────────┐
│  Photo Library                      [+ Add Photos]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🖼  bajo-vineyard-harvest-2024-01.jpg    [CDN ✅]  │
│     Category: Vineyard                              │
│     Description: "Merlot clusters on VSP trellises  │
│     at Bajo, rust-red laterite soil visible between │
│     rows, Lesser Himalayas in background"           │
│     Alt Text: "Ripe Merlot grape clusters on VSP-   │
│     trained vines at Bajo vineyard in Punakha..."   │
│     Classification: Informative                     │
│     CDN URL: res.cloudinary.com/bwc/image/...       │
│     Used in: Traminette Grape Guide, Hub Article    │
│     [Edit] [View in Drive] [Copy CDN URL]           │
│                                                     │
│  🖼  misty-himalaya-panorama.jpg          [CDN ✅]  │
│     Category: Culture                               │
│     Description: "Morning mist over the valley,     │
│     no specific vineyard — atmospheric/mood shot"   │
│     Alt Text: (empty — decorative)                  │
│     Classification: Decorative                      │
│     CDN URL: res.cloudinary.com/bwc/image/...       │
│     Used in: (none yet)                             │
│     [Edit] [View in Drive] [Copy CDN URL]           │
│                                                     │
│  🖼  paro-vineyard-spring-2025.jpg        [CDN ⬜]  │
│     Category: Vineyard                              │
│     Description: (not yet described)                │
│     ⚠ Needs description before it can be used       │
│     [Add Description]                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Photo workflow:**

1. User uploads photos to the `/Blog Photos` folder in Google Drive (organized by category subfolder).
2. User opens the Photo Manager in the app and clicks "Add Photos" — the system lists new files from Drive that haven't been cataloged yet.
3. For each new photo, the user provides: a plain-language description of what's in the image, a category, and whether it's informative or decorative.
4. The system generates suggested alt text based on the description (using Claude) and stores the metadata in the `photos` table.
5. When drafting an article in the Chat Interface, the engine can say: "I see you have 4 vineyard photos from Bajo. Want to use `bajo-vineyard-harvest-2024-01.jpg` as the hero image?"
6. The user confirms or swaps. When the article is **finalized**, the system automatically pushes the selected photos to Cloudinary via the Upload API (see Section 3F: Automated Image Pipeline).
7. The final HTML embeds Cloudinary CDN URLs with on-the-fly transformation parameters — auto-WebP, auto-compression, and responsive sizing — ensuring the images meet Core Web Vitals LCP targets without any manual optimization step.

---

### 3D. The Orchestration Layer — Next.js API Routes

This is the brain. Every message from the Chat UI hits the orchestration layer, which:

1. **Determines intent.** Is the user asking to start a new article? Asking a question about the content strategy? Requesting edits to a draft? Asking what to write next?

2. **Gathers context.** Based on intent, the orchestration layer makes parallel calls to:
   - **Onyx API** — retrieves relevant Knowledge Base documents (vineyard data, tasting notes, brand facts, press coverage)
   - **Neon Postgres** — retrieves the article's Content Map entry (main entity, supporting entities, parent hub, sibling spokes), the Blog Registry (all published articles with URLs for internal linking), and available photos with their Cloudinary CDN URLs
   - **Google Drive API** — lists available photos from the Drive library if new images need to be cataloged

3. **Assembles the system prompt.** This is the critical step. The system prompt sent to Claude is constructed dynamically for every generation request:

```
┌──────────────────────────────────────────────────┐
│              CLAUDE API CALL                      │
│                                                  │
│  System Prompt:                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  LAYER 1: Master SOP (static)              │  │
│  │  The full BWC-SEO-Blog-Master-SOP-2026     │  │
│  │  Loaded once, never changes per-request     │  │
│  ├────────────────────────────────────────────┤  │
│  │  LAYER 2a: Brand Style Guide (static)      │  │
│  │  Design philosophy, color rationale,        │  │
│  │  typography principles, do/don't rules.     │  │
│  │  Claude READS this for intent.              │  │
│  ├────────────────────────────────────────────┤  │
│  │  LAYER 2b: Compiled HTML/CSS Template       │  │
│  │  (static — component reference)             │  │
│  │  Component library listing every available  │  │
│  │  content type (hero, section, paragraph,    │  │
│  │  figure, pullquote, FAQ, key-facts box,     │  │
│  │  author bio, CTA, schema blocks).           │  │
│  │  Claude REFERENCES this to know which       │  │
│  │  structured content types exist — it does   │  │
│  │  NOT output HTML. The Article Renderer      │  │
│  │  uses this template to produce HTML.        │  │
│  ├────────────────────────────────────────────┤  │
│  │  LAYER 3: Article Brief (per-article)      │  │
│  │  From Content Map DB:                       │  │
│  │  - Article title, type, hub assignment      │  │
│  │  - Main Entity + Supporting Entities        │  │
│  │  - Parent hub URL (if spoke)                │  │
│  │  - Sibling spoke URLs                       │  │
│  │  - Content notes / editorial brief          │  │
│  ├────────────────────────────────────────────┤  │
│  │  LAYER 4: Knowledge Base Context            │  │
│  │  (per-article, from Onyx)                   │  │
│  │  - Relevant vineyard data                   │  │
│  │  - Current tasting notes                    │  │
│  │  - Pricing & availability                   │  │
│  │  - Press coverage excerpts                  │  │
│  │  - Brand story elements                     │  │
│  ├────────────────────────────────────────────┤  │
│  │  LAYER 5: Internal Link Graph (dynamic)     │  │
│  │  From Blog Registry:                        │  │
│  │  - All published BWC core page URLs         │  │
│  │  - All published blog post URLs + titles    │  │
│  │  - Hub-spoke relationships                  │  │
│  │  - Which articles link to what already      │  │
│  │  "Link to these published URLs. Do not      │  │
│  │   link to articles with status 'planned.'"  │  │
│  ├────────────────────────────────────────────┤  │
│  │  LAYER 6: Photo Manifest (per-article)      │  │
│  │  - Selected photos with Cloudinary CDN URLs  │  │
│  │  - User-provided descriptions               │  │
│  │  - Alt text (pre-generated or user-written) │  │
│  │  - Classification (informative/decorative)  │  │
│  │  - Assigned positions (hero, inline-1, etc.)│  │
│  │  - Image dimensions for width/height attrs  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  User Message:                                   │
│  "Generate the full article for the Traminette   │
│  Grape Guide spoke article."                     │
│                                                  │
│  Claude Response Format:                         │
│  A Canonical Article Document (structured JSON)  │
│  conforming to the article schema — NOT raw HTML │
│                                                  │
└──────────────────────────────────────────────────┘
```

4. **Calls Claude API with tool access.** Uses Claude Sonnet 4 for generation with `web_search` enabled as a tool. Claude is instructed to return a **Canonical Article Document** — a typed structured JSON object conforming to the article schema (see Section 3E). During generation, Claude can invoke web search to find specific external source URLs from the Editorial Trust Hierarchy, research current data not in the Knowledge Base, and discover recent press coverage of BWC. The structured article content streams back to the orchestration layer as it is generated.

5. **Validates the structured output.** The orchestration layer validates the incoming Canonical Article Document against the article schema:
   - **Schema validation:** Every required field is present, typed correctly, and within expected ranges (e.g., section count, paragraph lengths, image placement positions).
   - **Repair pass:** Common model output issues — missing fields, malformed link objects, duplicate section IDs — are automatically repaired or flagged. The validation layer is deterministic; it never calls the LLM.
   - **Internal link check:** Every internal link target in the structured document is compared against the Blog Registry. Links to URLs not in the registry are flagged.
   - **External link verification:** A batch HEAD request confirms every external URL in the document returns a 200 status. Dead links or redirects are flagged.
   - **New source flagging:** Any external link to a domain not in the pre-approved source registry is marked with a `newSource: true` flag in the structured document for editorial review.

6. **Renders trusted HTML via the Article Renderer.** The validated Canonical Article Document is fed to the **Article Renderer** — a deterministic, app-controlled pipeline that:
   - Selects the correct HTML component pattern from the Compiled Template for each content node (hero, section heading, paragraph, figure, pull-quote, key-facts box, FAQ, author bio, capture form, schema block, etc.)
   - Fills in the content from the structured document fields
   - Embeds the Compiled Template's complete `<style>` block verbatim
   - Constructs Cloudinary CDN URLs with transformation parameters from the photo manifest
   - Generates JSON-LD schema blocks from the metadata fields
   - Applies any stored HTML overrides from previous HTML-mode edits
   - Produces a single, complete, trusted Wix-ready HTML artifact

   The rendered HTML streams into the live preview iframe as the renderer processes each section — the user sees the styled article appear in real time. Because the renderer uses the locked Compiled Template exclusively, the output is guaranteed to be brand-consistent, structurally valid, and free of CSS drift or class-name improvisation.

   The user can run the **full Article Scorecard** (Section 3L) at any time during editing via the "🔍 Run QA Check" toolbar button. The scorecard runs against the rendered HTML output and the canonical document's metadata. It runs automatically on Finalize and blocks publication if any FAIL-level checks are unresolved.

---

### 3E. The Generation Output — Canonical Article Document + Rendered HTML

**The Canonical Article Document** is the primary artifact that Claude generates — a typed, structured JSON object representing the complete article. The **Article Renderer** then converts this document into the final Wix-ready HTML block using the Compiled Template's locked components and stylesheet.

**Why structured-first generation instead of direct HTML?**

| Problem with raw-HTML-first | How structured-first solves it |
|---|---|
| Claude may invent CSS classes, improvise component patterns, or produce inconsistent HTML across articles | The renderer uses the Compiled Template exclusively — Claude never writes HTML, so it can't drift |
| Malformed HTML (unclosed tags, broken nesting) requires complex post-processing to repair | The renderer produces structurally valid HTML by construction — it assembles from known-good components |
| Schema markup (JSON-LD) is generated as a string by the model, making validation fragile | Schema fields live as typed metadata in the canonical document; the renderer constructs valid JSON-LD from them |
| Style drift accumulates across articles (slightly different spacing, color values, class names) | Every article renders through the same template pipeline — zero drift by design |
| Canvas edits modify raw HTML strings, which can break structure | Canvas edits modify typed fields in the canonical document — always schema-valid |
| Redesigning the blog template requires regenerating every article | Canonical documents can be re-rendered with a new template version without regeneration |
| QA checks parse HTML strings with fragile heuristics | QA can validate the structured document directly (schema fields, link targets, image metadata) in addition to the rendered HTML |

**The Canonical Article Document schema:**

```json
{
  "version": "1.0",
  "articleId": 42,
  "slug": "traminette-grape-guide",
  "articleType": "spoke",
  "hubId": 1,
  "title": "Traminette: The Aromatic White Grape Thriving in Bhutan's Himalayas",
  "metaTitle": "Traminette Grape Guide | Bhutan Wine Company",
  "metaDescription": "Discover Traminette, the aromatic white grape producing perfumed wines in Bhutan's Himalayas. Growing conditions, tasting notes, and where to find Ser Kem.",
  "canonicalUrl": "https://www.bhutanwine.com/post/traminette-grape-guide",
  "publishDate": "2026-03-01",
  "modifiedDate": "2026-03-01",
  "author": {
    "name": "Michael [Last Name]",
    "credentials": "[Credentials]",
    "bio": "[1-2 sentence bio]",
    "linkedinUrl": "[URL]"
  },
  "executiveSummary": "Traminette is an aromatic white hybrid grape that has emerged as one of Bhutan Wine Company's most expressive varieties, producing a perfumed, Gewürztraminer-like wine from vineyards in the eastern Himalayas.",
  "heroImage": {
    "photoId": 12,
    "cloudinaryPublicId": "blog/vineyards/norzenthang-traminette-clusters",
    "alt": "Traminette grape clusters showing golden-green color on VSP-trained vines at the Norzenthang vineyard in eastern Bhutan",
    "caption": "Traminette clusters at Norzenthang vineyard, eastern Bhutan — one of the first aromatic white varieties planted in the Kingdom.",
    "width": 1200,
    "height": 800,
    "classification": "informative"
  },
  "sections": [
    {
      "id": "section-1",
      "heading": "The Story of Traminette in Bhutan",
      "headingLevel": 2,
      "content": [
        {
          "type": "paragraph",
          "text": "The Traminette vines at Norzenthang present a striking sight in late summer — clusters of golden-green grapes hanging in tight, compact bunches against the deep green canopy of the VSP trellises..."
        },
        {
          "type": "paragraph",
          "text": "When you walk between the rows in the weeks before harvest, the perfume is unmistakable: lychee, rose petal, and a honeyed spice..."
        },
        {
          "type": "image",
          "photoId": 15,
          "cloudinaryPublicId": "blog/vineyards/norzenthang-rows-summer",
          "alt": "VSP-trained Traminette rows at Norzenthang vineyard...",
          "caption": "Summer canopy at Norzenthang...",
          "width": 800,
          "height": 533,
          "classification": "informative",
          "position": "inline-1"
        },
        {
          "type": "pullQuote",
          "text": "The perfume is unmistakable — lychee, rose petal, and a honeyed spice.",
          "attribution": null
        }
      ]
    },
    {
      "id": "section-2",
      "heading": "Where Traminette Thrives",
      "headingLevel": 2,
      "content": [
        {
          "type": "paragraph",
          "text": "..."
        },
        {
          "type": "keyFacts",
          "title": "Key Facts",
          "facts": [
            { "label": "Elevation", "value": "2,250m" },
            { "label": "Soil Type", "value": "Glacial alluvial clay loam" },
            { "label": "Planted Varieties", "value": "Traminette, Riesling, Sauvignon Blanc" }
          ]
        }
      ]
    }
  ],
  "faq": [
    {
      "question": "What does Traminette wine taste like?",
      "answer": "Traminette produces an aromatic white wine with pronounced notes of lychee, rose petal, and white spice — similar in profile to Gewürztraminer..."
    }
  ],
  "internalLinks": [
    { "targetUrl": "https://www.bhutanwine.com/post/complete-guide-bhutan-wine", "anchorText": "our complete guide to Bhutan wine", "context": "hub-to-spoke" },
    { "targetUrl": "https://www.bhutanwine.com/the-grapes-vineyards", "anchorText": "BWC's vineyard sites", "context": "to-core-page" }
  ],
  "externalLinks": [
    { "url": "https://www.oiv.int/...", "anchorText": "OIV global viticulture report", "trustTier": "primary", "newSource": false }
  ],
  "ctaType": "newsletter",
  "captureComponents": ["newsletter", "allocation"],
  "schema": {
    "blogPosting": true,
    "faqPage": true,
    "product": false
  },
  "dataNosnippetSections": ["pricing", "allocation-terms"]
}
```

**The Article Renderer then produces the final Wix-ready HTML from this document.** The rendered output is a single HTML block that the user pastes into Wix. It includes everything it always has:

```html
<!-- BWC Blog Post: Traminette Grape Guide -->
<!-- Generated: 2026-03-01 | Status: DRAFT — Review before publishing -->
<!-- Rendered from Canonical Article Document v1 -->

<!-- SCHEMA MARKUP -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Traminette: The Aromatic White Grape Thriving in Bhutan's Himalayas",
  "datePublished": "2026-03-01",
  "dateModified": "2026-03-01",
  "author": {
    "@type": "Person",
    "name": "[AUTHOR NAME]",
    "jobTitle": "[TITLE]",
    "url": "[LINKEDIN URL]"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Bhutan Wine Company",
    "url": "https://www.bhutanwine.com"
  },
  "image": "https://res.cloudinary.com/bwc/image/upload/v1/blog/[HERO_IMAGE_PUBLIC_ID]",
  "description": "[META DESCRIPTION]"
}
</script>

<!-- ARTICLE BODY -->
<article class="bwc-blog-post">

  <p class="bwc-executive-summary">
    <strong>Traminette is an aromatic white hybrid grape that has emerged
    as one of Bhutan Wine Company's most expressive varieties, producing
    a perfumed, Gewürztraminer-like wine from vineyards in the eastern
    Himalayas.</strong>
  </p>

  <figure class="bwc-hero-image">
    <img
      src="https://res.cloudinary.com/bwc/image/upload/w_1200,f_auto,q_auto/blog/[PHOTO_PUBLIC_ID]"
      alt="Traminette grape clusters showing golden-green color on
           VSP-trained vines at the Norzenthang vineyard in eastern Bhutan"
      width="1200"
      height="800"
      loading="eager"
      fetchpriority="high"
    />
    <figcaption>Traminette clusters at Norzenthang vineyard,
    eastern Bhutan — one of the first aromatic white varieties
    planted in the Kingdom.</figcaption>
  </figure>

  <p>The Traminette vines at Norzenthang present a striking sight
  in late summer — clusters of golden-green grapes hanging in tight,
  compact bunches against the deep green canopy of the VSP trellises.
  When you walk between the rows in the weeks before harvest, the
  perfume is unmistakable: lychee, rose petal, and a honeyed spice
  that intensifies as the afternoon sun warms the eastern slopes...</p>

  <!-- ... full article continues with all H2s, internal links,
       external links, images, Visual-to-Text bridges, FAQ if
       applicable, and conclusion with CTA ... -->

  <h2>Frequently Asked Questions</h2>

  <h3>What does Traminette wine taste like?</h3>
  <p>Traminette produces an aromatic white wine with pronounced
  notes of lychee, rose petal, and white spice — similar in profile
  to Gewürztraminer, which is one of its parent grapes. Bhutan Wine
  Company's Ser Kem Traminette expresses these aromatics with a
  crisp, high-altitude acidity that balances the richness.</p>

  <!-- Pricing wrapped in data-nosnippet -->
  <p><span data-nosnippet>The current vintage Ser Kem Traminette
  is priced at [PRICE FROM KB] per bottle. Request an allocation
  through our <a href="https://www.bhutanwine.com/2024-inquiry-request"
  target="_blank">allocation request page</a>.</span></p>

  <!-- AUTHOR BIO -->
  <div class="bwc-author-bio">
    <p><strong>[AUTHOR NAME]</strong> — [CREDENTIALS]. [1-2 sentence bio].
    <a href="[LINKEDIN]" target="_blank" rel="noopener">Connect on LinkedIn</a>.</p>
  </div>

  <!-- DATA CAPTURE — Newsletter (baseline, every article) -->
  <aside class="bwc-capture bwc-capture--newsletter">
    <div class="bwc-capture__inner">
      <h3 class="bwc-capture__heading">Stay Close to the Vineyard</h3>
      <p class="bwc-capture__body">Quarterly dispatches from the Kingdom — 
      harvest updates, new releases, and invitations to experience 
      Bhutan's wine country firsthand.</p>
      <div class="bwc-capture__form" id="bwc-capture-newsletter">
        <input type="email" placeholder="Your email address" 
          class="bwc-capture__input" aria-label="Email address" required />
        <button type="button" class="bwc-capture__button">Subscribe</button>
      </div>
      <p class="bwc-capture__privacy">We respect your privacy. Unsubscribe anytime.</p>
    </div>
  </aside>

  <!-- Capture form JavaScript (included once, handles all form types) -->
  <script>/* [Capture submission script — see Section 3K] */</script>

</article>
```

---

### 3F. Automated Image Pipeline — Google Drive → Cloudinary CDN

**Why not serve images directly from Google Drive?**

Google Drive is designed for file storage and collaboration, not for serving images on production websites. Drive URLs are rate-limited under traffic, lack CDN edge caching, offer no format conversion (WebP), no compression control, and no responsive sizing. Google can interpose "virus scan" interstitial pages on larger files, breaking the image embed entirely. For a luxury brand where page speed and visual presentation directly affect conversion and SEO (LCP is a Core Web Vital), Drive URLs are a liability in production.

**The architecture: Google Drive for storage, Cloudinary for delivery.**

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Google Drive │     │  Content Engine   │     │    Cloudinary CDN  │
│  (Team lib.) │     │  (Orchestration)  │     │    (Delivery)      │
│              │     │                  │     │                    │
│ Team uploads ├────►│ Photo Manager    ├────►│ Upload API         │
│ photos here  │     │ catalogs &       │     │ (on finalization)  │
│              │     │ describes images  │     │                    │
│ /Blog Photos │     │                  │     │ Returns:           │
│  /Vineyards  │     │ On article       │     │ - CDN URL          │
│  /Winemaking │     │ finalization:    │     │ - Public ID        │
│  /Culture    │     │ downloads from   │     │ - Width/Height     │
│  /Team       │     │ Drive, uploads   │     │                    │
│  /Food       │     │ to Cloudinary    │     │ Serves with:       │
└──────────────┘     └──────────────────┘     │ - Auto WebP/AVIF   │
                                               │ - Auto compression │
                                               │ - URL-based resize │
                                               │ - Global edge CDN  │
                                               └────────────────────┘
```

**How the upload works (automated, invisible to the user):**

1. When the user finalizes an article in the Chat Interface and clicks "Finalize Article," the orchestration layer checks each selected photo's `uploaded_to_cdn` status in the database (reading photo references from the Canonical Article Document's image placements).

2. For any photo not yet on Cloudinary, the system:
   - Downloads the image from Google Drive via the Drive API (using the stored `drive_file_id`)
   - Uploads it to Cloudinary via the Upload API with a structured public ID: `blog/{category}/{filename}` (e.g., `blog/vineyards/bajo-harvest-2024-01`)
   - Cloudinary returns the CDN URL, public ID, and original image dimensions
   - The system stores `cloudinary_public_id`, `cloudinary_url`, `width_px`, `height_px` in the `photos` table and sets `uploaded_to_cdn = true`

3. For photos already on Cloudinary, the system uses the stored CDN URL directly. No re-upload.

4. The Article Renderer produces the final HTML with Cloudinary URLs including on-the-fly transformation parameters:

```html
<!-- Hero image: max 1200px wide, auto-format, auto-quality -->
<img
  src="https://res.cloudinary.com/bwc/image/upload/w_1200,f_auto,q_auto/blog/vineyards/bajo-harvest-2024-01"
  alt="Ripe Merlot grape clusters on VSP-trained vines at the Bajo
       vineyard in Bhutan's Punakha Valley during the autumn harvest"
  width="1200"
  height="800"
  loading="eager"
  fetchpriority="high"
/>

<!-- Inline image: max 800px wide, auto-format, auto-quality, lazy-loaded -->
<img
  src="https://res.cloudinary.com/bwc/image/upload/w_800,f_auto,q_auto/blog/winemaking/barrel-sample-thimphu"
  alt="BWC winemaker drawing a barrel sample of red wine in the
       Thimphu production facility"
  width="800"
  height="533"
  loading="lazy"
/>

<!-- Decorative section break: smaller, lazy-loaded, empty alt -->
<img
  src="https://res.cloudinary.com/bwc/image/upload/w_1200,f_auto,q_30/blog/culture/misty-himalaya-panorama"
  alt=""
  role="presentation"
  width="1200"
  height="400"
  loading="lazy"
/>
```

**What Cloudinary handles automatically (zero manual effort):**

| Feature | How It Works | Why It Matters |
|---|---|---|
| **Format conversion** | `f_auto` in the URL serves WebP to Chrome/Edge, AVIF to supported browsers, JPEG as fallback | WebP is 25–35% smaller than JPEG at equivalent quality. Directly improves LCP. |
| **Quality optimization** | `q_auto` analyzes each image and selects the lowest file size that preserves visual quality | Typically reduces file size 40–60% vs. unoptimized originals with no visible degradation. |
| **Responsive sizing** | `w_1200` or `w_800` in the URL resizes server-side | A 4000px camera original is never sent to a 1200px container. Eliminates the most common LCP killer. |
| **Global CDN** | Cloudinary serves from 80+ edge locations worldwide | An image loads in <100ms from any geography. Critical for Bhutan travel content read from Asia, Europe, and North America. |
| **Persistent URLs** | Once uploaded, the URL is permanent and cacheable | No link rot. No Drive permission issues. No interstitial virus scan pages. |

**The user never interacts with Cloudinary.** They upload photos to Google Drive, describe them in the Photo Manager, select them during article creation, and the system handles everything else. The CDN URLs appear in the rendered HTML automatically — the Article Renderer constructs Cloudinary URLs with transformation parameters from the photo metadata stored in the Canonical Article Document.

**Cloudinary cost:** The free tier provides 25GB storage and 25GB bandwidth per month. At BWC's content volume (~5 images per article, ~6 articles per month, average 200KB per optimized image), this covers approximately 3–4 years of content before hitting the limit. The paid tier starts at $89/mo if needed.

**Fallback strategy:** If Cloudinary is unavailable during generation, the system falls back to Google Drive URLs (`https://drive.google.com/uc?id=[FILE_ID]`) and flags the article for CDN migration once the service is restored. This ensures the content pipeline is never blocked by an image delivery issue.

---

### 3G. The Two-Document Style System — Eliminating Visual Drift

**The problem with feeding a design guide directly to an AI:**

BWC has a comprehensive Brand Style Guide (the `BWC-Brand-Style-Guide-for-HTML-Blog-Posts.md`). It documents every color, font, spacing decision, and design philosophy behind the brand's visual system. It is an excellent human reference document.

But as an AI generation template, it has a structural flaw. The CSS is distributed across dozens of individual code blocks, scattered throughout prose explanations. The AI has to *assemble* a complete stylesheet from fragments, figure out which classes map to which HTML elements, and infer the full component structure from examples. Every generation run, Claude is essentially recompiling the design system from prose. That's where drift happens — slightly different class names between articles, inconsistent spacing values, a forgotten CSS variable, a pull-quote component that uses `<blockquote>` in one article and `<div class="pullquote">` in the next.

**The solution: Two documents, two jobs.**

The style system is split into two files that serve two fundamentally different consumers:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  DOCUMENT 1: Brand Style Guide                             │
│  (BWC-Brand-Style-Guide.md)                                │
│                                                            │
│  Consumer: Humans (designers, editors) + Claude for        │
│            understanding design INTENT                     │
│                                                            │
│  Contains:                                                 │
│  - Design philosophy and principles                        │
│  - Color palette with rationale for each color             │
│  - Typography hierarchy and font selection reasoning       │
│  - Do / Do Not rules                                       │
│  - Component usage guidelines (when to use a pullquote     │
│    vs. a key facts box, etc.)                              │
│  - Performance philosophy                                  │
│  - Accessibility standards                                 │
│  - QA checklist                                            │
│                                                            │
│  Claude READS this to understand WHY the design system     │
│  works the way it does. This informs editorial decisions   │
│  (e.g., "should this section use a cream background or     │
│  stay white?") but Claude does NOT copy CSS from here.     │
│                                                            │
│  → Loaded into system prompt as LAYER 2a                   │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                                                            │
│  DOCUMENT 2: Compiled HTML/CSS Template                    │
│  (BWC-Compiled-Blog-Template.html)                         │
│                                                            │
│  Consumer: Claude for GENERATING output                    │
│                                                            │
│  Contains:                                                 │
│  - ONE complete <style> block with ALL CSS variables,      │
│    ALL class definitions, ALL responsive breakpoints,      │
│    consolidated into a single stylesheet                   │
│  - A COMPONENT LIBRARY: the exact HTML pattern for         │
│    every element the AI might generate, each shown as      │
│    a named, copy-ready snippet:                            │
│                                                            │
│    COMPONENT: article-wrapper                              │
│    COMPONENT: blog-hero (with Executive Summary Block)     │
│    COMPONENT: section-heading (h2)                         │
│    COMPONENT: subsection-heading (h3)                      │
│    COMPONENT: body-paragraph                               │
│    COMPONENT: figure-with-caption (informative image)      │
│    COMPONENT: decorative-image                             │
│    COMPONENT: pull-quote                                   │
│    COMPONENT: key-facts-box                                │
│    COMPONENT: comparison-table                             │
│    COMPONENT: faq-section                                  │
│    COMPONENT: internal-link (styled)                       │
│    COMPONENT: external-link (new tab)                      │
│    COMPONENT: data-nosnippet-wrapper                       │
│    COMPONENT: author-bio                                   │
│    COMPONENT: article-footer                               │
│    COMPONENT: capture-newsletter                           │
│    COMPONENT: capture-allocation                           │
│    COMPONENT: capture-tour                                 │
│    COMPONENT: capture-waitlist                             │
│    COMPONENT: capture-content-upgrade                      │
│    COMPONENT: capture-javascript (shared submission logic) │
│    COMPONENT: schema-blogposting (JSON-LD template)        │
│    COMPONENT: schema-faqpage (JSON-LD template)            │
│    COMPONENT: schema-product (JSON-LD template)            │
│                                                            │
│  Claude REFERENCES this to know which content types        │
│  exist — it generates structured content nodes that        │
│  correspond to these components. The Article Renderer      │
│  then COPIES from these patterns to produce HTML,          │
│  filling in values from the Canonical Article Document.    │
│  HTML output never deviates from the declared structure.   │
│                                                            │
│  → Loaded into system prompt as LAYER 2b (for Claude)      │
│  → Compiled into rendering functions (for the Renderer)    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Why this eliminates drift (now even more effectively with the structured-first architecture):**

In the current architecture, Claude no longer generates HTML directly — it generates a **Canonical Article Document** (structured JSON). The **Article Renderer** is the component that reads the Compiled Template and produces HTML. This means the Compiled Template is consumed by **deterministic application code**, not by a language model, which eliminates the last remaining source of drift: model interpretation.

| Problem | With raw-HTML generation (old) | With structured-first + renderer (current) |
|---|---|---|
| CSS assembly | Claude copies a pre-compiled `<style>` block verbatim. Risk: model may truncate or modify it. | The renderer embeds the `<style>` block programmatically. Zero risk of truncation or modification. |
| Component structure | Claude selects from a fixed component library. Risk: model may subtly alter structure. | The renderer selects and fills component templates. Component structure is locked in application code. |
| Class naming | Class names locked in compiled stylesheet. Risk: model may still paraphrase under pressure. | Claude never sees class names — it outputs structured fields. The renderer applies correct classes. |
| Schema markup | Schema templates pre-built with placeholders. Risk: model may fill them inconsistently. | Schema fields are typed data in the canonical document. The renderer constructs valid JSON-LD deterministically. |
| New element needed | Claude uses closest existing component and flags it. | Claude adds a `customNote` field to the structured document. The renderer uses the closest component and flags it for review. |

The Brand Style Guide (Document 1) still informs Claude's **editorial decisions** — when to use a pull-quote vs. a key-facts box, when cream backgrounds are warranted, the design philosophy. But Claude's output is structured content, not HTML. The Compiled Template (Document 2) is now consumed exclusively by the renderer, giving it the precision of code rather than the approximation of an LLM copying patterns.

**How the Compiled Template is structured internally:**

```html
<!-- ============================================
     BWC COMPILED BLOG TEMPLATE
     Version: 2026.1

     DUAL-PURPOSE DOCUMENT:

     FOR AI (Claude — generates Canonical Article Document):
     1. Reference the COMPONENT LIBRARY below to know which
        structured content types are available
     2. Each COMPONENT maps to a content node type in the
        Canonical Article Document schema (paragraph, pullQuote,
        keyFacts, figure, faq, authorBio, capture, etc.)
     3. Generate structured content using only node types that
        correspond to components defined here
     4. If you need a content type not in this library, use the
        closest match and add a customNote field
     5. Do NOT generate HTML — generate structured article JSON

     FOR ARTICLE RENDERER (application code — produces HTML):
     1. Begin every rendered article with the FULL <style> block
        below — embed it exactly, do not modify or abbreviate
     2. For each content node in the Canonical Article Document,
        select the matching COMPONENT pattern and fill in the
        structured field values
     3. Never invent new CSS classes — use only what is defined here
     4. Never modify component HTML structure — only fill in content
     5. Apply HTML overrides (from HTML mode edits) after base render
     ============================================ -->

<!-- ==================== FULL STYLESHEET ==================== -->
<style>
  :root {
    --bwc-gold: #bc9b5d;
    --bwc-black: #000000;
    --bwc-white: #ffffff;
    --bwc-text-primary: #000000;
    --bwc-text-secondary: #414141;
    /* ... all variables ... */
  }
  
  /* ... complete, consolidated stylesheet ... */
  /* Every class from the Brand Style Guide, compiled into one block */
  /* Responsive breakpoints included */
  /* Print styles included */
</style>

<!-- ==================== COMPONENT LIBRARY ==================== -->

<!-- COMPONENT: blog-hero -->
<header class="blog-hero">
  <p class="eyebrow">Bhutan Wine Company Journal</p>
  <h1>[ARTICLE TITLE]</h1>
  <p class="bwc-executive-summary"><strong>[EXECUTIVE SUMMARY BLOCK — 25-40 words]</strong></p>
  <p class="meta">
    <time datetime="[YYYY-MM-DD]">[Human-readable date]</time>
    <span aria-hidden="true"> · </span>
    <span>By [AUTHOR NAME]</span>
  </p>
</header>

<!-- COMPONENT: figure-informative -->
<figure class="bwc-figure">
  <img
    src="[CLOUDINARY_CDN_URL]"
    alt="[DESCRIPTIVE ALT TEXT — 10-25 words]"
    width="[WIDTH]"
    height="[HEIGHT]"
    loading="[eager for hero, lazy for all others]"
  />
  <figcaption>[Caption text]</figcaption>
</figure>

<!-- COMPONENT: figure-decorative -->
<figure class="bwc-figure bwc-figure--decorative">
  <img
    src="[CLOUDINARY_CDN_URL]"
    alt=""
    role="presentation"
    width="[WIDTH]"
    height="[HEIGHT]"
    loading="lazy"
  />
</figure>

<!-- COMPONENT: pull-quote -->
<blockquote class="bwc-pullquote">
  <p>[Quote text]</p>
  <cite>[Attribution if applicable]</cite>
</blockquote>

<!-- COMPONENT: key-facts-box -->
<aside class="bwc-key-facts">
  <h3 class="bwc-key-facts__title">Key Facts</h3>
  <dl class="bwc-key-facts__list">
    <dt>[Label]</dt><dd>[Value]</dd>
    <dt>[Label]</dt><dd>[Value]</dd>
  </dl>
</aside>

<!-- ... etc. for every component ... -->
```

**How this fits in the system prompt assembly:**

The orchestration layer loads both documents into every generation call, but their roles have shifted with the structured-first architecture:

- **Layer 2a** (Brand Style Guide): Loaded as context Claude reads for design understanding and editorial decision-making. Tells Claude *why* the system works this way — when to use warm cream backgrounds vs. white, when a pull-quote is warranted, the performance philosophy. Claude uses this to make intelligent content structuring decisions in the Canonical Article Document (e.g., choosing to include a key-facts box vs. a pull-quote for a given piece of information).
- **Layer 2b** (Compiled Template): Loaded as a **component reference** so Claude knows which content types are available. The system prompt includes an explicit instruction: *"Generate a Canonical Article Document using the content types defined in the Compiled Template's component library. Each component corresponds to a structured content node type (paragraph, pullQuote, keyFacts, figure, faq, etc.). Do not invent content types that don't correspond to a template component. If you need an element not in the library, use the closest match and add a customNote."* Claude does **not** copy HTML from the template — the renderer handles that. But Claude needs to see the component library to know what building blocks are available.

**The Compiled Template's second consumer: the Article Renderer.**

The Article Renderer (application code, not the LLM) reads the Compiled Template at build/deploy time and compiles it into a set of rendering functions — one per component. When it receives a Canonical Article Document, it walks the document's content tree and renders each node by calling the corresponding component function, filling in the structured field values. This is deterministic code — it cannot drift, hallucinate, or improvise.

**Maintaining the two documents:**

When the brand's visual system changes (new color, new component, updated spacing), the workflow is:

1. Update the Brand Style Guide (Document 1) with the new design rationale.
2. Update the Compiled Template (Document 2) with the new CSS and component pattern.
3. Both documents live in the `/System Documents` folder in Google Drive and are versioned with a date stamp.
4. The orchestration layer always loads the latest version from the file system.

Changes to the Compiled Template affect all future articles immediately — the Article Renderer picks up the new components and stylesheet automatically. Previously published articles retain their original CSS (since the `<style>` block is embedded in each article's rendered HTML — there is no shared external stylesheet to update retroactively). However, because the **Canonical Article Document** is stored alongside the rendered HTML, any previously published article can be **re-rendered** with the updated template at any time. This is a key benefit of the structured-first architecture: content is independent of presentation, so template updates never require article regeneration.

**The key insight:** The Brand Style Guide is a *thinking* document (Claude reads it for editorial intelligence). The Compiled Template is a *doing* document (the Article Renderer uses it to produce HTML). The Canonical Article Document is the *bridge* between them — structured content that captures Claude's editorial decisions in a form the renderer can execute deterministically. No recompilation. No drift. No ambiguity.

---

### 3H. Wix Platform Profile — Live Site Intelligence (Captured Feb 28, 2026)

The following data was captured by running the BWC Site Explorer v2.0 on four live pages (homepage, About Us, Grapes & Vineyards, Visit Us). This profile informs every downstream component — how the HTML output must be structured, how images are served, what the crawler will encounter, and what SEO gaps the content engine should address.

**Wix Platform Details:**

| Property | Value |
|---|---|
| Platform | Wix.com Website Builder |
| Meta Site ID | `1ffae8d1-b103-4f62-84e5-e756e876393e` |
| Application Instance ID | `13a9858e-02a3-41a7-9c4d-79a7e0e526eb` |
| Published Version | 767 (as of Feb 28, 2026) |
| Language | `en` |
| Blog App Installed | **No** — `has_blog_feed: false`, zero blog-related data hooks |

**DOM Structure (consistent across all pages):**

```
<body>
  <script> (multiple — Wix runtime scripts)
  <div id="SITE_CONTAINER">
    <header id="SITE_HEADER" class="x4zVYf SITE_HEADER wixui-header">
      <nav class="StylableHorizontalMenu3372578893__root ...">
        <!-- 8 nav items: HOME, ABOUT US, GRAPES & VINEYARDS, OUR WINE, 
             VISIT US, GALLERY, MERCH, cart icon -->
      </nav>
    </header>
    <main id="PAGES_CONTAINER" class="PAGES_CONTAINER">
      <section id="comp-[hash]"> <!-- Wix sections, not <article> -->
        <!-- Page content as nested div/section blocks -->
      </section>
    </main>
    <footer id="SITE_FOOTER" class="AT7o0U SITE_FOOTER wixui-footer">
      <!-- PRESS INQUIRIES (/general-6), CONTACT US (/contact-us) -->
    </footer>
  </div>
</body>
```

Key observations for the HTML output:
- Wix does **not** use `<article>` elements — all content is in `<section>` blocks with auto-generated `comp-` IDs
- No `<aside>` or sidebar on any page
- No semantic heading hierarchy on core pages (headings are in styled divs, not `<h1>`/`<h2>` chains)
- Blog posts (once the Wix Blog app is installed) will likely introduce `<article>`, `[data-hook="blog-post"]`, and proper heading structures — we'll confirm with the explorer when the first post is published

**Navigation (identical on all pages):**

| Position | Label | URL | Notes |
|---|---|---|---|
| Nav 1 | HOME | `/` | |
| Nav 2 | ABOUT US | `/about-us` | |
| Nav 3 | GRAPES & VINEYARDS | `/the-grapes-vineyards` | |
| Nav 4 | OUR WINE | `/our-wine` | |
| Nav 5 | VISIT US | `/visit-us` | |
| Nav 6 | GALLERY | `/gallery` | |
| Nav 7 | MERCH | `/category/all-products` | Store category page |
| Nav 8 | Cart | `/cart-page` | Cart icon, displays "0" |
| Footer 1 | PRESS INQUIRIES | `/general-6` | Opens in new tab (`_blank`) |
| Footer 2 | CONTACT US | `/contact-us` | |

The MERCH page wasn't in the sitemap's `pages-sitemap.xml` — it's generated by the Wix Stores app (`store-products-sitemap.xml` / `store-categories-sitemap.xml`).

**Image Hosting — Wix Static CDN:**

All images are served from Wix's CDN. The engine's rendered HTML must link to Cloudinary (not Wix static) for blog post images, but understanding the Wix pattern matters for the crawler's deep-crawl feature (extracting images from published pages).

```
Wix image URL pattern:
https://static.wixstatic.com/media/db4df3_[hash]~mv2.[ext]/v1/fill/w_[w],h_[h],al_[align],q_[quality],enc_avif,quality_auto/[original_filename]

BWC media account prefix: db4df3_
Encoding: AVIF preferred (modern, good compression)
Image element: <wow-image> (custom Wix element) wrapping standard <img>
Parent container: div.j7pOnl (logo) or div.BzTPNT (gallery grid items)
```

**SEO Gaps Identified (the Content Engine should fix these for blog content):**

| Issue | Status | Engine's Fix |
|---|---|---|
| Meta descriptions | **NULL on all 4 pages** | Blog posts get meta descriptions via schema layer |
| JSON-LD schema | Only homepage (2x WebSite) — inner pages have none | Blog posts get full Article + BreadcrumbList schema |
| og:image | Missing on all pages | Blog posts get og:image from Cloudinary hero |
| twitter:image | Missing on all pages | Blog posts get twitter:image from Cloudinary hero |
| Heading hierarchy | No semantic H1/H2 chain on core pages | Blog posts use proper H1 → H2 → H3 hierarchy |
| Alt text | Some images have it, many don't | Blog posts have alt text on every image |
| Internal links | Only nav + footer links — no in-content cross-linking | Blog posts link to core pages and other blog posts in-content |

These gaps are standard for a Wix-built site that hasn't been SEO-optimized. The Content Engine's blog posts will be the most technically SEO-complete pages on the site by a wide margin, which is exactly the point — the blog is the primary organic discovery channel.

**External Links on the Live Site:**

Only the Grapes & Vineyards page has external links — 9 Google Earth links to individual vineyard locations (GorTshalu, Lingmethang, Norzenthang, Paro, Pinsa, Bajo, Yusipang, Ser Bhum, Gelephu). The Visit Us page has a mailto link (`experiences@bhutanwine.com`). No other external links exist on the site. The blog will be the first part of the site to link to external authoritative sources.

**Data Hooks (Wix internal component identifiers):**

Only 6 data hooks are present across all pages: `bgLayers`, `cart-icon-button`, `items-count`, `svg-icon-1`, `svg-icon-wrapper`, `tpa-components-provider`. These are all Wix shell components, not content-related. When the Wix Blog app is installed, we expect to see blog-specific hooks (`blog-post`, `blog-feed`, `post-content`, etc.) — these will be captured by a second explorer run and will inform the crawler's DOM parsing selectors.

---

### 3I. Wix Site Crawler — Automatic Publication Detection

**The problem:** The current system relies on a manual "Mark as Published" step — the user publishes to Wix, then returns to the Content Engine to enter the live URL. If they forget (and they will), the Blog Registry falls out of sync with reality. The link graph becomes stale. New articles can't link to content that the system doesn't know exists.

**The solution:** A lightweight scheduled crawler that reads the Wix sitemap index and auto-reconciles the Blog Registry.

**Wix sitemap structure (confirmed from live site, Feb 2026):**

Wix uses a **sitemap index** pattern — the root `sitemap.xml` is not a flat list of URLs but an index pointing to sub-sitemaps by content type:

```xml
<!-- https://www.bhutanwine.com/sitemap.xml (live, confirmed) -->
<sitemapindex generatedBy="WIX">
  <sitemap>
    <loc>https://www.bhutanwine.com/store-products-sitemap.xml</loc>
    <lastmod>2024-12-20</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.bhutanwine.com/store-categories-sitemap.xml</loc>
    <lastmod>2022-12-11</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.bhutanwine.com/pages-sitemap.xml</loc>
    <lastmod>2026-02-08</lastmod>
  </sitemap>
  <!-- When Wix Blog is activated and posts are published, Wix will 
       automatically add a new entry here:
       <sitemap>
         <loc>https://www.bhutanwine.com/blog-posts-sitemap.xml</loc>
         <lastmod>[date]</lastmod>
       </sitemap>
  -->
</sitemapindex>
```

The crawler must read the index first, find the blog sub-sitemap dynamically, then parse it. The blog sub-sitemap name may vary (`blog-posts-sitemap.xml`, `blog-sitemap.xml`, or similar) — the crawler identifies it by looking for any sub-sitemap URL containing "blog" or "post" that isn't already known (`store-products`, `store-categories`, `pages`).

**How it works:**

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Wix Sitemap     │     │  Blog Sub-      │     │  Crawler         │     │  Neon        │
│  Index           │     │  Sitemap        │     │  (Vercel Cron)   │     │  Postgres    │
│                  │     │                 │     │                  │     │              │
│ sitemap.xml      │ GET │ blog-posts-     │ GET │ 1. Fetch index   │ SQL │ content_map  │
│ (index of sub-  ├────►│ sitemap.xml     ├────►│ 2. Find blog sub ├────►│ internal_    │
│  sitemaps)       │     │ (all blog URLs) │     │ 3. Parse URLs    │     │   links      │
│                  │     │                 │     │ 4. Compare to DB │     │              │
│ Also monitors:   │     │                 │     │ 5. Auto-update   │     │              │
│ pages-sitemap    │     │                 │     │    status &      │     │              │
│ for core page    │     │                 │     │    activate links│     │              │
│ changes          │     │                 │     │ 6. Also check    │     │              │
│                  │     │                 │     │    pages-sitemap  │     │              │
│                  │     │                 │     │    for new core   │     │              │
│                  │     │                 │     │    pages          │     │              │
└─────────────────┘     └─────────────────┘     └──────────────────┘     └──────────────┘
```

**The crawl cycle (runs daily via Vercel Cron Job):**

1. **Fetch the sitemap index.** `GET https://www.bhutanwine.com/sitemap.xml` — parse the XML to get all sub-sitemap URLs and their `<lastmod>` dates. No API key required. No authentication. Just a public HTTP request.

2. **Identify the blog sub-sitemap.** Scan the sub-sitemap URLs for any entry containing "blog" or "post" that isn't `store-products-sitemap.xml`. If no blog sub-sitemap exists yet (the current state), the crawl cycle ends gracefully — no blog posts to discover. Once BWC's first blog post is published, Wix will auto-generate the sub-sitemap and the crawler will find it on the next run.

3. **Fetch and parse the blog sub-sitemap.** Extract every `<url>` entry — capturing the full URL, the slug (extracted from the URL path), and the `<lastmod>` date.

4. **Compare against the Blog Registry.** For each blog URL found in the sitemap:
   - **If the slug matches a `content_map` entry with status "planned," "drafting," or "finalized":** Auto-update to "published," store the live URL and `<lastmod>` as `published_date`. Activate all `internal_links` entries involving this article. Log the change.
   - **If the slug matches a "published" entry:** Verify the URL hasn't changed. Update `lastmod` if the page was modified (may indicate the user edited the post in Wix — flag for review if HTML version divergence matters).
   - **If the slug doesn't match any `content_map` entry:** This is a blog post published outside the Content Engine (someone wrote it manually in Wix). Create a new `content_map` entry with status "published," flag it as `source = 'external'`, and make it available for internal linking. The system doesn't need to have *planned* an article to know it exists and link to it.

5. **Also monitor the pages sub-sitemap.** `GET https://www.bhutanwine.com/pages-sitemap.xml` — compare against the core page registry. If a new core page appears (e.g., BWC adds a new `/grapes/traminette` page), add it to the link graph so future articles can link to it. If a core page URL changes or disappears, flag it for review.

6. **Optional deep crawl (weekly, not daily).** For each published blog URL, fetch the page HTML and extract:
   - The `<h1>` title (for display in the Content Map dashboard)
   - All internal links on the page (to populate the `internal_links` table with actual link relationships, not just planned ones)
   - The `<meta name="description">` content
   - This keeps the link graph accurate even if someone manually edits a published post in Wix.

**Blog URL pattern (to be confirmed when first post is published):**

Wix Blog typically uses one of these patterns:
- `bhutanwine.com/post/[slug]` (most common for Wix Blog app)
- `bhutanwine.com/blog/[slug]` (alternate)
- `bhutanwine.com/[custom-blog-page-name]/[slug]` (if the blog page is renamed)

The crawler doesn't hardcode a pattern — it discovers blog URLs from the blog sub-sitemap, which Wix populates automatically. The slug is extracted as the last path segment of each URL. Once the first blog post is published and the explorer script is run on that page, we'll confirm the exact pattern and can add a validation check.

**Slug matching logic:**

The Content Map stores a `slug` field (e.g., `high-altitude-viticulture-bhutan`). The crawler extracts the slug from the Wix blog URL's path. Matching is straightforward string comparison. For edge cases where the Wix slug was modified during publishing (the user tweaked the URL), the system falls back to fuzzy matching on the article title, and if no match is found, creates a new entry flagged for human review.

**What this gives the system:**

- **The link graph is always current.** If an article was published yesterday, today's generation run knows about it and can link to it.
- **No manual step required.** The "Mark as Published" button still exists as a shortcut (instantly updates the DB without waiting for the next crawl cycle), but if the user forgets, the crawler catches it within 24 hours.
- **External content is visible.** If a team member publishes a quick news post directly in Wix without using the Content Engine, the system still discovers it and can link to it from future articles.
- **Core page changes are tracked.** If BWC adds, renames, or removes a core site page, the crawler detects it through the pages sub-sitemap and keeps the link graph accurate.

**Cost:** Zero. Two HTTP requests to public XML files, plus a handful of database queries. Runs as a Vercel Cron Job on the free tier.

---

### 3J. Web Search Integration — Finding and Verifying External Links

**The problem:** The Master SOP requires 3–8 external links per article from the Editorial Trust Hierarchy (primary sources, established authorities, niche experts). The pre-approved source registry lists *which* publications to prefer, but it doesn't help Claude *find* the specific article or data page to link to. Without web access, Claude can only generate plausible-looking URLs (which may be dead or point to the wrong content) or leave placeholder tokens for the user to fill in manually.

For a system that promises "publication-ready HTML," placeholder links are a broken promise.

**The solution:** Give the orchestration layer web search capability through Claude's tool use.

**How it works:**

During article generation, Claude has access to a `web_search` tool that it can invoke to:

1. **Find specific source URLs from the Editorial Trust Hierarchy.** When writing about high-altitude viticulture and needing an OIV reference, Claude searches `OIV global viticulture statistics altitude` and retrieves the actual URL to the report — not a guessed URL.

2. **Verify that external links are live.** Before embedding any external URL in the final HTML, the system makes a HEAD request to confirm it returns a 200 status. Dead links are flagged in the preview for the user to resolve.

3. **Discover new authoritative sources.** If the pre-approved registry doesn't cover a topic (e.g., a new academic paper on Himalayan soil chemistry), Claude can search for it, evaluate the source against the Editorial Trust Hierarchy criteria, and propose it — with the source, URL, and its trust-tier classification shown to the user for approval.

4. **Research current data for article context.** If the article discusses Bhutan's position among emerging wine regions and the Knowledge Base doesn't have current OIV production statistics, Claude can search for them, cite the source, and weave the data into the article with a proper external link.

**Implementation:**

The Claude API supports tool use natively. The orchestration layer defines a `web_search` tool and a `url_verify` tool in the API call:

```javascript
// In the Claude API call configuration
tools: [
  {
    type: "web_search_20250305",
    name: "web_search"
  }
]
```

Claude invokes the search tool during generation when it needs to:
- Find a specific source URL it can't construct from memory
- Verify a URL is live before embedding it
- Research current data not available in the Knowledge Base
- Discover authoritative coverage of BWC or Bhutanese wine

**Controls and guardrails:**

- **Source priority is enforced by the SOP.** Claude's system prompt includes the Editorial Trust Hierarchy — it searches for primary sources first, established authorities second, niche experts third. The hierarchy is baked into the generation instructions, not left to Claude's judgment.
- **No competitor links.** The SOP explicitly prohibits linking to competitor wine e-commerce. This instruction persists in the system prompt regardless of what web search returns.
- **User approval for new sources.** If Claude finds a source not in the pre-approved registry, it marks the link with a `newSource: true` flag in the Canonical Article Document. The Article Renderer includes an HTML comment (`<!-- NEW SOURCE: [domain] — not in pre-approved registry, verify editorially -->`) and a visual indicator in the preview for editorial review.
- **Link verification runs post-generation.** After Claude produces the HTML, the orchestration layer extracts all external `<a href>` URLs and runs a batch HEAD request check. Any URL returning a non-200 status is flagged in the preview: "⚠ This link may be broken — [URL] returned [status code]."

**What this gives the system:**

| Without Web Search | With Web Search |
|---|---|
| Claude generates plausible URLs from memory (may be dead or wrong) | Claude finds real, verified URLs from actual search results |
| User must manually find and insert 3–8 external links per article | External links arrive in the rendered HTML, ready to publish |
| System can't discover new press coverage of BWC | System can find recent Wine Enthusiast or Jancis Robinson articles about BWC and link to them |
| Static knowledge — Claude doesn't know about papers published after training cutoff | Live research — Claude can find current OIV data, recent academic papers, new press coverage |
| Placeholder tokens: `[LINK TO OIV SOURCE]` | Real URLs: `https://www.oiv.int/what-we-do/global-report?year=2025` |

**Cost:** Web search is included in the Claude API call at no additional charge beyond the standard token usage. URL verification is simple HTTP HEAD requests — negligible cost.

---

### 3K. In-Article Data Capture — Building a First-Party Lead Database

**The strategic case:**

BWC sells wine through an allocation model to a niche, high-net-worth audience. Every person who reads a blog post about Bhutanese wine and is interested enough to leave an email address is a potential allocator, tour guest, or brand ambassador. The blog isn't just a content marketing channel — it's the top of a luxury conversion funnel.

Most brands push email capture directly to Mailchimp or Klaviyo. That works, but it loses context. A generic "Subscribe to our newsletter" form captures an email address and nothing else. The ESP doesn't know *which article* captured the lead, *what topic* they were reading about, or *what action* they were considering when they signed up. That context is the difference between a generic nurture sequence and a targeted one that converts.

**The architecture: Capture to Neon first, sync to ESP later.**

Every data capture form embedded in a blog post submits to a BWC Content Engine API route, which writes the lead and its full context to Neon Postgres. When BWC later connects Klaviyo, Mailchimp, or any ESP, a sync job pushes leads with rich tagging — article title, hub topic, capture intent, content type — that powers segmented automations from day one.

```
┌────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Blog Post         │     │  Vercel API Route     │     │  Neon Postgres   │
│  (on Wix)          │     │  /api/capture         │     │                 │
│                    │     │                      │     │  leads table    │
│  [Capture Form]   ├────►│  Validates input      ├────►│  lead_events    │
│  JavaScript POST   │     │  Enriches with        │     │  table          │
│  to API endpoint   │     │  article context      │     │                 │
│                    │     │  Writes to Neon       │     │  (First-party   │
│                    │     │  Returns confirmation  │     │   data asset)   │
└────────────────────┘     └──────────────────────┘     └────────┬────────┘
                                                                 │
                                                    Phase 4+:    │
                                                    Scheduled    │
                                                    sync job     │
                                                                 │
                                                        ┌────────▼────────┐
                                                        │  Klaviyo /      │
                                                        │  Mailchimp      │
                                                        │                 │
                                                        │  Leads arrive   │
                                                        │  with full      │
                                                        │  context tags:  │
                                                        │  - article_slug │
                                                        │  - hub_topic    │
                                                        │  - capture_type │
                                                        │  - content_type │
                                                        └─────────────────┘
```

**Capture form types (components in the Compiled Template):**

The engine selects and places the appropriate capture component based on the article type and editorial context. Each form type captures a different intent signal:

| Component | Trigger | What It Captures | Where It Appears |
|---|---|---|---|
| **Newsletter Signup** | Every article | Email, first name (optional) | Article footer, above author bio |
| **Allocation Interest** | Articles mentioning specific wines, pricing, or availability | Email, first name, wine of interest | Inline after wine description, or at `data-nosnippet` pricing section |
| **Tour / Visit Inquiry** | Articles about visiting Bhutan, the winery experience, or travel planning | Email, first name, preferred travel dates (optional) | Inline within tour/travel sections |
| **Content Upgrade** | Hub articles or comprehensive guides | Email (gated download: vineyard map PDF, vintage guide, etc.) | Inline mid-article, after establishing value |
| **Waitlist** | Sold-out vintage or upcoming release articles | Email, first name | Inline when referencing sold-out or upcoming wines |

**The engine decides which capture components to include** based on the article's hub assignment and content. The SOP does not dictate exact placement — the engine evaluates the article during generation and places capture forms where they are contextually relevant and non-intrusive. The user can adjust placement during the iteration loop ("move the allocation form lower," "remove the content upgrade, this article doesn't need it").

**Database schema (added to Neon Postgres):**

```sql
-- Every email captured from any blog post
CREATE TABLE leads (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL,
    first_name      TEXT,
    source_article  INTEGER REFERENCES content_map(id),
    source_url      TEXT,                    -- Full URL of the page that captured them
    capture_type    TEXT NOT NULL,           -- "newsletter" | "allocation" | "tour" |
                                             -- "content_upgrade" | "waitlist"
    hub_topic       TEXT,                    -- The hub this article belongs to
    wine_interest   TEXT,                    -- If allocation/waitlist: which wine
    travel_dates    TEXT,                    -- If tour inquiry: preferred dates
    ip_country      TEXT,                    -- Geo from request headers (for timezone/locale)
    utm_source      TEXT,                    -- If they arrived via a tracked link
    utm_medium      TEXT,
    utm_campaign    TEXT,
    synced_to_esp   BOOLEAN DEFAULT false,   -- true once pushed to Klaviyo/Mailchimp
    esp_contact_id  TEXT,                    -- Klaviyo/Mailchimp ID once synced
    created_at      TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(email, source_article, capture_type)  -- Prevent duplicate captures per article
);

-- Every interaction beyond the initial capture (for behavioral scoring later)
CREATE TABLE lead_events (
    id              SERIAL PRIMARY KEY,
    lead_id         INTEGER REFERENCES leads(id),
    event_type      TEXT NOT NULL,           -- "capture" | "content_upgrade_download" |
                                             -- "allocation_submitted" | "tour_booked" |
                                             -- "repeat_visit" | "second_article_capture"
    event_data      JSONB,                   -- Flexible payload for event-specific data
    article_id      INTEGER REFERENCES content_map(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Pre-built views for ESP sync and reporting
CREATE VIEW leads_for_esp_sync AS
SELECT 
    l.id,
    l.email,
    l.first_name,
    l.capture_type,
    l.hub_topic,
    l.wine_interest,
    l.ip_country,
    l.utm_source,
    cm.title AS article_title,
    cm.hub_name,
    cm.article_type,
    l.created_at
FROM leads l
LEFT JOIN content_map cm ON l.source_article = cm.id
WHERE l.synced_to_esp = false;
```

**How the capture forms work in the rendered HTML:**

The Compiled Template includes styled capture components that match the BWC brand. Each form submits via JavaScript `fetch()` to the Content Engine's API — the form never navigates away from the page.

```html
<!-- COMPONENT: capture-newsletter -->
<aside class="bwc-capture bwc-capture--newsletter">
  <div class="bwc-capture__inner">
    <h3 class="bwc-capture__heading">Stay Close to the Vineyard</h3>
    <p class="bwc-capture__body">Receive quarterly dispatches from 
    the Kingdom — harvest updates, new vintage releases, and invitations 
    to experience Bhutan's wine country firsthand.</p>
    <div class="bwc-capture__form" id="bwc-capture-newsletter">
      <input 
        type="email" 
        placeholder="Your email address" 
        class="bwc-capture__input"
        aria-label="Email address"
        required
      />
      <button type="button" class="bwc-capture__button">Subscribe</button>
    </div>
    <p class="bwc-capture__privacy">We respect your privacy. Unsubscribe anytime.</p>
  </div>
</aside>

<!-- COMPONENT: capture-allocation -->
<aside class="bwc-capture bwc-capture--allocation">
  <div class="bwc-capture__inner">
    <h3 class="bwc-capture__heading">Request an Allocation</h3>
    <p class="bwc-capture__body">Interested in securing bottles of 
    [WINE NAME FROM KB]? Join the allocation list and we'll contact 
    you when the next vintage is available.</p>
    <div class="bwc-capture__form" id="bwc-capture-allocation">
      <input 
        type="text" 
        placeholder="First name" 
        class="bwc-capture__input bwc-capture__input--half"
        aria-label="First name"
      />
      <input 
        type="email" 
        placeholder="Email address" 
        class="bwc-capture__input bwc-capture__input--half"
        aria-label="Email address"
        required
      />
      <button type="button" class="bwc-capture__button">Join the List</button>
    </div>
    <p class="bwc-capture__privacy">We respect your privacy. Unsubscribe anytime.</p>
  </div>
</aside>

<!-- JavaScript for all capture forms (included once at end of article) -->
<script>
document.querySelectorAll('.bwc-capture__button').forEach(button => {
  button.addEventListener('click', async function() {
    const form = this.closest('.bwc-capture__form');
    const emailInput = form.querySelector('input[type="email"]');
    const nameInput = form.querySelector('input[type="text"]');
    
    if (!emailInput.value || !emailInput.validity.valid) {
      emailInput.classList.add('bwc-capture__input--error');
      return;
    }
    
    const captureType = form.id.replace('bwc-capture-', '');
    
    try {
      const response = await fetch('https://content.bhutanwine.com/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value,
          first_name: nameInput ? nameInput.value : null,
          capture_type: captureType,
          source_url: window.location.href,
          article_slug: window.location.pathname.split('/post/')[1] || null,
          // UTM params from URL
          utm_source: new URLSearchParams(window.location.search).get('utm_source'),
          utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
          utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign')
        })
      });
      
      if (response.ok) {
        form.innerHTML = '<p class="bwc-capture__success">Thank you. We\'ll be in touch.</p>';
      }
    } catch (err) {
      form.innerHTML = '<p class="bwc-capture__success">Thank you. We\'ll be in touch.</p>';
      // Graceful degradation — show success even if API is temporarily down.
      // The form data is lost in this case, but the user experience is preserved.
    }
  });
});
</script>
```

**The API route (`/api/capture`):**

A Next.js API route on Vercel that receives the form submission, enriches it with article context from the Blog Registry, and writes to Neon:

```javascript
// /api/capture — simplified logic flow
export async function POST(request) {
  const body = await request.json();
  
  // 1. Validate email format
  // 2. Look up article in content_map by slug → get hub_topic, article_type, article_id
  // 3. Extract geo from request headers (Vercel provides x-vercel-ip-country)
  // 4. Insert into leads table with full context
  // 5. Insert "capture" event into lead_events
  // 6. Return 200
}
```

**What the captured data looks like in Neon:**

| email | first_name | capture_type | hub_topic | article_title | wine_interest | ip_country | utm_source |
|---|---|---|---|---|---|---|---|
| jane@example.com | Jane | allocation | Complete Guide to Bhutan Wine | Traminette Grape Guide | Ser Kem Traminette | US | instagram |
| mark@example.com | | newsletter | High-Altitude Viticulture | How Bhutan Grows Wine Above the Clouds | | GB | google |
| alice@example.com | Alice | tour | Bhutan Wine Tourism | Visiting BWC: The Vineyard Tour Guide | | SG | direct |

**When Klaviyo/Mailchimp is connected later (Phase 4+):**

A scheduled sync job (Vercel Cron, daily) queries the `leads_for_esp_sync` view, pushes new leads to the ESP API with tag data:

```
Klaviyo Profile:
  email: jane@example.com
  first_name: Jane
  tags: ["allocation-interest", "traminette", "bhutan-wine-hub"]
  custom_properties:
    capture_source: "Traminette Grape Guide"
    capture_type: "allocation"
    hub_topic: "Complete Guide to Bhutan Wine"
    wine_interest: "Ser Kem Traminette"
    country: "US"
    utm_source: "instagram"
```

This enables segmented flows on day one of ESP connection:
- **Allocation leads** get a sequence about the wine they expressed interest in, availability updates, and the ordering process.
- **Newsletter subscribers** get quarterly dispatches with new articles from the hub they were reading.
- **Tour inquirers** get a travel planning sequence with seasonal recommendations, visa info, and booking details.
- **Waitlist leads** get notified the moment a sold-out wine becomes available again.

No ESP-native form could capture this level of context. The blog *is* the segmentation engine.

**Privacy and compliance:**

- Forms include a visible privacy statement ("We respect your privacy. Unsubscribe anytime.")
- The `leads` table supports a `deleted_at` column (add when GDPR/privacy compliance is formalized) for right-to-deletion requests
- No cookies are set by the capture forms — compliance with cookie consent regulations is simplified
- UTM parameters are captured from the URL query string only, not from tracking pixels
- The capture endpoint should be rate-limited (Vercel's built-in rate limiting or a simple IP-based throttle) to prevent abuse

**What the engine does during article generation:**

When generating an article, the engine evaluates the content and selects the appropriate capture components:

1. **Every article** gets a newsletter capture in the article footer (above the author bio). This is the baseline.
2. **Articles mentioning specific wines or pricing** get an allocation interest capture placed inline near the wine discussion. The engine pulls the wine name from the Knowledge Base to personalize the form copy.
3. **Articles about visiting Bhutan or tours** get a tour inquiry capture.
4. **Hub articles** may get a content upgrade capture (gated PDF download of a vineyard map, vintage guide, or regional overview).
5. **Articles about sold-out or upcoming wines** get a waitlist capture.

The user can override these during the iteration loop: "Remove the allocation form from this article — it's too editorial for a hard CTA" or "Add a waitlist form after the section about the 2024 vintage being sold out."

**Cost:** Zero additional infrastructure. The API route runs on Vercel (included). The database tables are in the existing Neon instance (included). ESP sync is a future addition.

---

### 3L. Content QA & Scoring Layer — The Article Scorecard

**The problem:** The current architecture validates links after generation, which catches broken URLs but says nothing about whether the article actually meets BWC's publication standard. Without a formal QA layer, "review before publishing" is a subjective vibe check. Two different editors looking at the same article might disagree on whether it's ready. Worse, the non-technical user the system is designed for has no way to know they forgot a meta description, have an H1→H3 skip, or are six internal links short of the SOP minimum.

**The solution:** A deterministic QA pass that runs automatically when the user clicks "Finalize Article." It grades the article against every measurable rule in the Master SOP and produces a visual scorecard — pass/fail/warn for each check — directly in the preview canvas. The user sees exactly what needs fixing before publication, and they can fix it (via Chat, Canvas Edit, or HTML mode) and re-run the check instantly.

**When it runs:**

The QA layer runs at two moments:

1. **On demand** — the user clicks a "🔍 Run QA Check" button in the toolbar at any time during editing. This lets them check progress mid-iteration without committing.
2. **Automatically on Finalize** — when the user clicks "Finalize Article," the QA pass runs first. If any checks score as ❌ FAIL, finalization is blocked with a clear explanation. The user fixes the issue and clicks Finalize again. If all checks pass (or only have ⚠️ warnings), finalization proceeds.

**The scorecard — graded against the Master SOP:**

The QA layer is entirely deterministic — no LLM calls, no subjective judgment. It validates both the **Canonical Article Document** (structured fields, metadata, link targets, image data) and the **rendered HTML** (heading hierarchy, word count, visual structure). Each check maps to a specific SOP section. Some checks are more naturally run against the structured document (e.g., meta title length, link count, schema field completeness), while others validate the rendered output (e.g., heading hierarchy in the DOM, alt attribute presence on `<img>` elements). Both sources are available to every check.

```
┌─────────────────────────────────────────────────────────────────┐
│  ARTICLE SCORECARD                              Score: 47/52 ✅  │
│  "High-Altitude Viticulture: How Bhutan Grows Wine Above..."    │
│  Type: Hub Article                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STRUCTURE (SOP §2–3)                                           │
│  ✅ H1 present — exactly one                                    │
│  ✅ H1 length — 58 chars (target: 50–65)                        │
│  ✅ Heading hierarchy — H1→H2→H3, no skips, no H4–H6           │
│  ✅ H2 count — 6 (target: 5–8 for hub)                          │
│  ✅ No duplicate headings                                       │
│  ✅ Executive Summary Block — present, bolded, 34 words          │
│  ✅ Word count — 3,240 (target: 2,500–4,000 for hub)            │
│                                                                 │
│  META & SEO (SOP §2)                                            │
│  ✅ Meta title — 56 chars (target: 50–60)                        │
│  ✅ Meta title differs from H1                                   │
│  ✅ Meta description — 154 chars (target: 150–160)               │
│  ✅ URL slug — 4 words, lowercase, hyphenated                    │
│  ✅ Canonical URL set                                            │
│                                                                 │
│  INTERNAL LINKS (SOP §6)                                        │
│  ✅ Internal link count — 10 (min: 8 for hub)                    │
│  ✅ Core page links — 5 of 3 minimum met                         │
│  ✅ Links to parent hub — N/A (this IS a hub)                    │
│  ⚠️ Sibling spoke links — 1 (recommend 2+)                      │
│  ✅ Anchor text — all 3–8 words, no prohibited phrases           │
│  ✅ No "click here" / "read more" / "learn more" anchors         │
│                                                                 │
│  EXTERNAL LINKS (SOP §7)                                        │
│  ✅ External link count — 6 (min: 5 for hub)                     │
│  ✅ All open in new tab (target="_blank")                         │
│  ✅ No competitor e-commerce links                                │
│  ✅ Source trust tiers — 2 primary, 3 authority, 1 niche          │
│  ⚠️ Link distribution — 4 of 6 are in sections 2–3 (spread more)│
│  ✅ All URLs return 200 (live check passed)                       │
│                                                                 │
│  IMAGES & ACCESSIBILITY (SOP §8)                                │
│  ✅ Image count — 6 (min: 5 for hub)                             │
│  ✅ Hero image — has alt text, loading="eager", fetchpriority     │
│  ✅ All informative images have alt text (10–25 words)            │
│  ✅ No blank/missing alt attributes                               │
│  ✅ Max consecutive words without visual — 320 (limit: 400)       │
│  ⚠️ 1 image missing caption (img_3 — Bajo vineyard)             │
│                                                                 │
│  SCHEMA & STRUCTURED DATA (SOP §11)                             │
│  ✅ BlogPosting schema — present, all required fields             │
│  ✅ FAQPage schema — present (FAQ section detected)               │
│  ✅ data-nosnippet on pricing/allocation content                  │
│  ✅ Publication date and "Last Updated" date present              │
│                                                                 │
│  E-E-A-T & BRAND VOICE (SOP §5)                                │
│  ✅ Author byline with credentials present                       │
│  ✅ No unsubstantiated superlatives detected                      │
│  ⚠️ Reading level — Grade 13.2 (target: 10–14 for luxury wine)  │
│                                                                 │
│  DATA INTEGRITY (SOP §1)                                        │
│  ✅ No hardcoded pricing detected                                │
│  ✅ No hardcoded ABV or vintage statistics detected               │
│  ✅ KB-sourced data attributed in prose                           │
│                                                                 │
│  AI CITABILITY (SOP §10)                                        │
│  ✅ Executive Summary Block extraction-ready                      │
│  ✅ 4 standalone citable paragraphs detected (min: 3)             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  4 warnings  •  0 failures  •  Ready to finalize ✅              │
│                                                                 │
│  [Fix Warnings in Chat]  [Finalize Anyway ▶]  [Dismiss]         │
└─────────────────────────────────────────────────────────────────┘
```

**The complete check registry:**

Every check is classified as FAIL (blocks finalization), WARN (advisory, can proceed), or INFO (informational only). Thresholds come directly from the SOP.

**FAIL-level checks (must pass to finalize):**

| Check | Rule | SOP Section |
|---|---|---|
| H1 present | Exactly 1 `<h1>` element | §2, §3 |
| Heading hierarchy | No skips (H1→H3 without H2), no H4–H6 | §3 |
| Executive Summary Block | Bolded paragraph immediately after H1, 25–40 words | §2 |
| Meta title present | Non-empty, 50–60 characters | §2 |
| Meta description present | Non-empty, 150–160 characters | §2 |
| Word count in range | Hub: 2,500–4,000 / Spoke: 1,200–2,000 / News: 600–1,000 | §3 |
| Internal link minimum | Hub: 8 / Spoke: 5 / News: 3 | §6 |
| Core page link minimum | Hub: 4 / Spoke: 3 / News: 2 links to Tier 1–3 core pages | §6 |
| External link minimum | Hub: 5 / Spoke: 3 / News: 2 | §7 |
| BlogPosting schema present | Required fields: headline, datePublished, author, image | §11 |
| Hero image alt text | Hero `<img>` must have non-empty, descriptive alt attribute | §8 |
| No blank alt attributes | Every `<img>` has alt (descriptive or `alt=""` for decorative) | §8 |
| Author byline present | Author name + credentials block exists | §5 |
| Publication date present | Visible date element in article | §5 |
| Prohibited anchor text | No "click here," "read more," "learn more," "this article" | §6 |
| All internal links valid | Every internal href exists in Blog Registry or core page list | §6 |
| All external links live | Every external href returns HTTP 200 | §7 |
| Canonical URL set | `<link rel="canonical">` present and matches expected URL | §11 |

**WARN-level checks (advisory — can still finalize):**

| Check | Rule | SOP Section |
|---|---|---|
| H1 length | 50–65 characters | §2 |
| H2 count in range | Hub: 5–8 / Spoke: 3–5 / News: 2–3 | §3 |
| Duplicate headings | No two headings share identical text | §3 |
| Meta title differs from H1 | Meta title and H1 should be similar but not identical | §2 |
| URL slug length | 3–6 words, lowercase, hyphenated | §2 |
| Spoke links to parent hub | If spoke article, at least 1 link to parent hub | §6 |
| Sibling spoke links | 1–2 links to spokes in same cluster | §6 |
| Cross-cluster link | At least 1 link to a spoke in a different cluster | §6 |
| Anchor text length | All anchors 3–8 words | §6 |
| External links open in new tab | All external `<a>` have `target="_blank"` | §7 |
| No competitor e-commerce links | No links to competing winery storefronts | §7 |
| External link distribution | Links spread across sections, not clustered | §7 |
| Source trust tier coverage | At least 1 primary source among external links | §7 |
| Image count minimum | Hub: 5 / Spoke: 3 / News: 1 | §8 |
| Consecutive words without visual | No more than 400 words between images | §8 |
| Informative image alt text length | 10–25 words for non-decorative images | §8 |
| Captions on location/process images | Images depicting specific places or processes should have captions | §8 |
| FAQPage schema conditional | Present only if FAQ section exists; absent if no FAQ | §11 |
| data-nosnippet on sensitive content | Applied to pricing, legal, allocation terms | §11 |
| Hero image performance | `loading="eager"` and `fetchpriority="high"` set | §12 |
| Width/height on all images | All `<img>` have explicit dimensions (CLS prevention) | §12 |
| No hardcoded volatile data | Scan for price patterns ($XXX), ABV patterns (XX.X%), raw elevation numbers without KB attribution | §1 |
| Banned superlatives | Flag "best winery," "finest wine," "greatest" etc. without substantiation | §5 |
| Main entity in required positions | Check H1, Executive Summary, meta title, meta description, first 100 words, at least one H2, conclusion | §4 |
| Reading level | Flesch-Kincaid Grade Level 10–14 (luxury wine audience range) | §5 |
| Standalone citable paragraphs | At least 3 paragraphs that work as self-contained statements (AI citability) | §10 |

**How each check works technically:**

All checks are deterministic — no LLM involved. The QA module receives both the **Canonical Article Document** (for metadata and structural field validation) and the **rendered HTML string** (for DOM-level validation). Most checks can run against either source; the module uses whichever is more natural. For example, meta title length is checked directly from the canonical document's `metaTitle` field, while heading hierarchy is validated by parsing the rendered HTML DOM:

```javascript
// Example check implementations (conceptual)

// FAIL: H1 count
const h1s = doc.querySelectorAll('h1');
if (h1s.length !== 1) return { status: 'FAIL', message: `Found ${h1s.length} H1 elements (expected exactly 1)` };

// FAIL: Heading hierarchy — no skips
const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
for (let i = 1; i < headings.length; i++) {
  const prev = parseInt(headings[i-1].tagName[1]);
  const curr = parseInt(headings[i].tagName[1]);
  if (curr > prev + 1) return { status: 'FAIL', message: `H${prev} → H${curr} skip at "${headings[i].textContent}"` };
  if (curr > 3) return { status: 'FAIL', message: `H${curr} found — only H1–H3 allowed` };
}

// FAIL: Word count range (varies by article type)
const bodyText = doc.querySelector('.bwc-article-body').textContent;
const wordCount = bodyText.trim().split(/\s+/).length;
const range = articleType === 'hub' ? [2500, 4000] : articleType === 'spoke' ? [1200, 2000] : [600, 1000];
if (wordCount < range[0] || wordCount > range[1]) return { status: 'FAIL', ... };

// WARN: Banned superlatives
const banList = ['best winery', 'finest wine', 'greatest wine', 'most prestigious', 'world\'s best'];
const text = doc.body.textContent.toLowerCase();
const found = banList.filter(phrase => text.includes(phrase));
if (found.length > 0) return { status: 'WARN', message: `Unsubstantiated superlatives: ${found.join(', ')}` };

// WARN: Hardcoded volatile data — price patterns
const pricePattern = /\$\d{2,}/g;
const prices = text.match(pricePattern);
if (prices) return { status: 'WARN', message: `Possible hardcoded prices: ${prices.join(', ')} — verify from KB` };

// WARN: Reading level (Flesch-Kincaid)
const fkGrade = calculateFleschKincaid(bodyText);
if (fkGrade < 10 || fkGrade > 14) return { status: 'WARN', message: `Reading level ${fkGrade.toFixed(1)} (target: 10–14)` };
```

**The scoring system:**

Each check earns 1 point if passed, 0.5 if warned, 0 if failed. The total score is displayed as X/Y where Y is the total number of applicable checks (some checks are conditional — e.g., FAQ schema check only applies if an FAQ section exists, spoke-links-to-hub only applies to spoke articles).

The score is informational — it gives the user a quick "how ready is this?" signal. But the gate logic is binary: **any FAIL blocks finalization.** A 48/52 with one FAIL is not publishable. A 40/52 with zero FAILs is.

**What the user sees:**

The scorecard renders as an overlay panel on the preview canvas (similar to how the Site Explorer tool renders its results). The user can:

- Click any ❌ or ⚠️ line to highlight the relevant element in the preview (e.g., clicking "H1 length — 72 chars" highlights the H1 in the iframe with a red border)
- Click "Fix in Chat" on any line — pre-populates the chat with a fix request (e.g., "Shorten the H1 to under 65 characters while keeping the main topic front-loaded")
- Click "Fix in Canvas" — switches to Canvas Edit mode with the relevant element focused
- Dismiss warnings they've reviewed and accepted
- Re-run the check after making fixes

**Schema validation detail:**

The BlogPosting schema check doesn't just confirm the `<script type="application/ld+json">` block exists — it validates the required fields against the SOP:

```json
{
  "@type": "BlogPosting" — required
  "headline" — required, must match H1 or meta title
  "datePublished" — required, ISO 8601
  "dateModified" — required
  "author" — required, must include name and credentials
  "publisher" — required, must be "Bhutan Wine Company"
  "image" — required, must be a valid Cloudinary URL
  "description" — required, must match meta description
  "mainEntityOfPage" — required, must match canonical URL
}
```

If the article includes an FAQ section, the QA layer also validates that the FAQPage schema `mainEntity` array matches the actual FAQ Q&A pairs in the HTML — no orphaned questions, no missing answers.

**Integration with the Three Editing Modes:**

The QA scorecard is designed to work with the existing editing workflow, not replace it. When the user sees a warning or failure:

- **Text fixes** (H1 too long, meta description too short, banned phrase) → Canvas Edit mode. Click the text, fix it.
- **Structural fixes** (missing section, need more internal links, add a key-facts box) → Chat mode. Ask Claude to make the change.
- **Technical fixes** (schema field missing, loading attribute wrong, data-nosnippet needed) → HTML mode or Chat mode. Either edit the source directly or ask Claude to fix it.

The scorecard persists across mode switches. After every edit (from any mode), the user can re-run the check to see their score update in real time.

**Cost:** Zero. The QA layer is pure client-side JavaScript validating the Canonical Article Document fields and parsing the rendered HTML. No API calls, no database queries (except looking up the Blog Registry for internal link validation, which is already loaded). It adds negligible latency to the finalize flow.

---

## 4. The Content Generation Workflow (Step by Step)

This is what the user actually experiences.

### Step 1: Open the App

User opens the BWC Content Engine at `content.bhutanwine.com` (or wherever deployed). The engine greets them with a status update pulled from the Content Map database:

> "3 new articles planned this month. The 'Emerging Wine Regions' hub hasn't been started yet — it's the highest-priority gap. You also have new tasting notes from Matt in the Drive that haven't been used in any published article. What would you like to work on?"

### Step 2: Select or Propose an Article

The user either picks from the Content Map or proposes something new:

- **From the map:** "Let's do the Emerging Wine Regions hub article."
- **New idea:** "I want to write a post about the elephant problem at Bajo."

If the user proposes something new, the engine evaluates it against the Content Map, suggests which hub it belongs to, identifies the Main Entity and Supporting Entities, and checks for keyword cannibalization with existing articles. It adds the article to the database.

### Step 3: Engine Gathers Context

The engine makes its parallel queries (Onyx, Postgres, Drive) and summarizes what it knows:

> "Here's what I've pulled for this article:
>
> **From the Knowledge Base:** [Summary of relevant docs]
> **Published articles that should link here:** [List]
> **Articles this post should link to:** [List with URLs]
> **Available photos in the Vineyards/Bajo folder:** [List with filenames]
>
> Before I start drafting, I have a few questions..."

### Step 4: Engine Asks Clarifying Questions

The engine identifies gaps between what the SOP requires and what it currently has:

> "1. I don't see any photos specifically of elephants or wildlife at Bajo. Do you have any, or should I plan the article without a wildlife photo?
>
> 2. The Knowledge Base has yield data from 2024 but not from the most recent season. Is there newer data you can provide or confirm?
>
> 3. This story has a strong experiential angle. Who should the author byline be? Someone who has personally witnessed the elephant encounters would strengthen the E-E-A-T signal."

### Step 5: User Provides Photos and Direction

The user responds to questions and provides photo information:

> "I have 3 photos. Here they are:
>
> Photo 1 (hero): Elephant footprints in the vineyard soil between vine rows at Bajo. You can see the scale against the trellis posts. Link: [Google Drive URL]
>
> Photo 2: The electric fence system we installed around the Bajo perimeter. Taken at sunset with the mountains behind. Link: [Google Drive URL]
>
> Photo 3: Just a moody shot of the valley — use it as a section break. It's decorative. Link: [Google Drive URL]
>
> Author byline should be Michael. He was there when the elephant came through last March."

### Step 6: Engine Generates the Full Article

The engine assembles all seven layers of the system prompt and calls Claude with web search enabled. Claude generates a **Canonical Article Document** — a complete structured representation of the article including:

- Executive Summary Block (as a structured text field)
- All H2/H3 sections with full prose, organized as typed content nodes (paragraphs, pull-quotes, key-facts boxes, images, tables, etc.) referencing the Compiled Template's component types
- Photo placements at appropriate positions, referencing Cloudinary CDN URLs with correct alt text (descriptive for informative, empty for decorative), dimensions, and classification
- Visual-to-Text Bridge prose adjacent to every informative image placement
- Internal link targets to all relevant published BWC pages and blog posts (real URLs from the Blog Registry, stored as structured link objects)
- External link targets found via live web search, sourced per the Editorial Trust Hierarchy (primary sources first, then established authorities, then niche experts) — real, verified URLs, not placeholders, stored as structured link objects with trust-tier metadata
- FAQ items (if intent-based assessment says to include them) as structured question/answer pairs
- Schema metadata fields (article type, date, author, image, description) — the renderer constructs JSON-LD from these
- `dataNosnippet` markers on any pricing or allocation content
- Author bio data (name, credentials, bio text, LinkedIn URL)
- CTA type and capture component selections based on article context (newsletter baseline + allocation/tour/waitlist/content upgrade where relevant)

The orchestration layer validates the structured document against the article schema, repairing common issues (missing fields, malformed links) automatically. It then feeds the validated Canonical Article Document to the **Article Renderer**, which produces trusted Wix-ready HTML using the Compiled Template's locked components and stylesheet. The renderer handles all HTML concerns: Cloudinary URL construction with transformation parameters (`f_auto,q_auto,w_1200`), `loading="eager"` and `fetchpriority="high"` on the hero image, JSON-LD schema block assembly, capture form JavaScript injection, and `data-nosnippet` attribute placement.

The rendered HTML streams into the **live preview canvas** as the renderer processes each section — the user watches the fully styled blog post appear in real time on the right side of the screen. By the time generation is complete, the preview shows the article exactly as it will look on bhutanwine.com.

The orchestration layer then runs the post-processing validation pass: internal link check, external link verification (HEAD requests to confirm all URLs are live), and new-source flagging. Any issues appear as warning badges overlaid on the preview.

### Step 7: User Reviews and Iterates

The user reviews the live preview and edits the article using whichever mode fits the change. They can freely switch between all three modes during the iteration. Every edit — regardless of mode — updates the **Canonical Article Document** (or the HTML overrides layer for structural HTML edits), and the **Article Renderer** regenerates the affected HTML:

**Chat mode** for structural and creative changes:

> "The opening is great but the section on traditional Bhutanese attitudes toward elephants feels thin. Can you expand it with more cultural context?"
>
> *[Claude updates the relevant section in the Canonical Article Document with expanded prose. The renderer regenerates the section's HTML. The preview updates — new prose appears with the correct styling.]*

> "That Jancis Robinson external link goes to her paywall homepage. Can you find the specific article where she reviewed Ser Kem?"
>
> *[Engine runs a web search, finds the specific article URL, updates the link object in the canonical document, the renderer regenerates the affected anchor tag, and the preview updates with the corrected href.]*

**Canvas Edit mode** for direct text changes:

> *[User clicks into the third paragraph, changes "2,200 meters" to "2,250 meters" — the edit maps via `data-cad-path` to the paragraph's text field in the canonical document, the renderer regenerates the fragment, and the correction appears instantly in the styled preview.]*

> *[User clicks the H2 heading, changes "Growing Conditions" to "Where Traminette Thrives" — types it directly, the section heading field updates in the canonical document, no waiting for the engine.]*

> *[User fixes a typo in a caption, adjusts a value in the key-facts box, rephrases a sentence in the conclusion — all done by clicking and typing, all mapped to structured fields.]*

**HTML mode** for edge cases:

> *[User switches to rendered HTML source, adds a `class="bwc-featured"` attribute to a pull quote for special styling — the system stores this as a controlled HTML override, switches back to preview to verify the override is applied.]*

The user toggles between mobile and desktop preview to check responsive layout. All edits — from Chat, Canvas, and HTML modes — are tracked in a unified undo/redo stack that operates on the Canonical Article Document state (plus HTML overrides). The iteration loop continues until the user is satisfied.

### Step 8: Finalize and Commit

When satisfied, the user clicks **"Finalize Article."** The system automatically:

1. **Runs the Article Scorecard** (Section 3L) — a deterministic QA pass that grades the article against every measurable rule in the Master SOP. The scorecard runs against both the **Canonical Article Document** (validating metadata fields, link targets, image data, and schema completeness directly from the structured source) and the **rendered HTML** (validating heading hierarchy, word count, alt attributes, and visual structure in the final output). The scorecard overlay appears on the preview canvas showing pass/fail/warn for each check.
   - If any checks score as ❌ **FAIL**, finalization is **blocked.** The user sees exactly what needs fixing — they can click any failed item to highlight the issue in the preview, fix it via Chat/Canvas/HTML mode, and re-run the check.
   - If all checks pass (or only have ⚠️ warnings), finalization proceeds.
2. Uploads any new photos to Cloudinary (if not already on CDN) and updates the Canonical Article Document's photo references with permanent CDN URLs
3. Runs final link verification — internal links against the Blog Registry, external links via HEAD requests (this is also part of the scorecard, but runs again here against live URLs)
4. Runs the **Article Renderer** one final time against the current Canonical Article Document to produce the definitive HTML artifact with all CDN URLs in place
5. **Commits both the Canonical Article Document and the rendered HTML to the database:**
   - Writes a new row to the `article_documents` table with the complete Canonical Article Document (structured JSON), any HTML overrides, version number, timestamp, and the user's identity
   - Writes a corresponding row to the `article_html` table with the rendered HTML, meta title, meta description, extracted schema JSON (all produced by the renderer from the canonical doc), QA score, version number, and a reference to the document version
6. Updates the `content_map` row: status → "finalized," sets `word_count`, `qa_score`, and `updated_at`
7. Presents the final HTML with **"Copy HTML to Clipboard"** and **"Download .html"** buttons

The article now appears as 📦 (Finalized) in the Content Map dashboard. Both the Canonical Article Document and the rendered HTML are permanently stored — the user can return to the dashboard at any time, click the article row, and immediately view the rendered preview, copy the HTML, or download it. They don't need to regenerate anything.

**Publishing:** The user opens Wix, creates a new blog post, switches to HTML/embed mode, and pastes the entire block. The formatting, images (served from Cloudinary's global CDN), links, and schema are all in place. This workflow is unchanged.

**Updating a published article:** If the user needs to revise a published article (new pricing, new vintage data, additional section), they click "Edit in Chat" from the Article Detail Panel. This re-opens the article in the Chat Interface with the most recent **Canonical Article Document** loaded into the editor state. The Article Renderer produces the preview HTML from it, and any previously approved HTML overrides are preserved. They iterate in conversation (which updates the canonical document), then re-finalize — which creates **new versions** (v2, v3, etc.) in both `article_documents` and `article_html` while preserving all previous versions. The user copies the updated HTML into Wix, replacing the old embed.

### Step 9: Publication Detection

The user has two paths to register the published article:

**Option A — Manual (instant).** Back in the Content Engine, the user clicks **"Mark as Published"** and enters the live URL. The system immediately:

1. Updates the `content_map` table: status → "published," stores the URL and date
2. Activates all `internal_links` entries involving this article
3. **Generates a backfill report:** "These 3 existing articles should now link to your new post. Here are the suggested anchor texts and the sections where they should be inserted. Would you like me to generate the updated HTML for those sections?"

**Option B — Automatic (within 24 hours).** If the user forgets to mark it, the Wix site crawler (Section 3I) picks it up on its next daily run. It reads the Wix sitemap, discovers the new blog URL, matches it to the `content_map` entry by slug, and auto-updates the status. The backfill report is queued for the user's next session.

Either way, the Blog Registry stays current and future articles can link to the new post immediately.

---

## 5. How the System Recommends New Content

The engine doesn't just execute — it advises. It can proactively identify content opportunities by analyzing:

### Gap Analysis (from the Content Map)

- Which hubs have the fewest published spokes? These are topical authority weaknesses.
- Which planned articles have the highest-value Main Entities (based on search volume data in the Content Map)?
- Which hubs are "complete" (all spokes published) and could benefit from an additional spoke targeting a newly discovered supporting entity?

### Internal Link Density

- Which published articles have the fewest inbound links from other BWC content? These are "orphan" articles that need more connections.
- Which core BWC pages (Grapes & Vineyards, Our Wine, Visit Us) are underlinked from blog content?

### Knowledge Base Changes

- New documents added to the Drive (a new winemaker report, a new press mention) that could fuel a new article or update an existing one.
- "Matt uploaded 2025 harvest notes yesterday. You could write a 'First Look: 2025 Vintage' news post — want me to draft it?"

### Seasonal Opportunities

- The engine knows the current date and can suggest timely content: harvest season articles in autumn, travel guides in spring (Bhutan's peak tourism season), vintage preview pieces when new wines are approaching release.

---

## 6. Technology Stack Summary

| Component | Technology | Cost | Purpose |
|---|---|---|---|
| **Frontend** | Next.js 14+ (App Router) | Free (Vercel Hobby) or $20/mo (Pro) | Chat UI with split-pane live preview, Content Map dashboard, Photo Manager |
| **Backend / API** | Next.js API Routes (Vercel Serverless) | Included with Vercel | Orchestration layer — context gathering, Claude API calls, Article Renderer, schema validation, Cloudinary uploads, link verification |
| **Knowledge Base** | Onyx CE (Docker) on VPS | $12–24/mo (DigitalOcean/Railway) | Indexes Google Drive, provides RAG search API |
| **Document Storage** | Google Drive (BWC account) | Free (existing) | KB documents, photo library (team-facing), system documents |
| **Image CDN** | Cloudinary | Free tier (25GB storage/bandwidth) | Auto WebP/AVIF, compression, responsive sizing, global edge delivery |
| **Database** | Neon Serverless Postgres | Free tier (sufficient) or $19/mo | Content Map, Blog Registry, Link Graph, Photo registry, Lead capture & events |
| **AI Generation** | Claude API (Sonnet 4) with web search | ~$15–30/mo at BWC content volume | Canonical Article Document generation (structured JSON), external link research, photo alt text, editorial assistance |
| **Hosting** | Vercel | Free or $20/mo | Frontend + API deployment, edge caching |
| **Site Crawler** | Vercel Cron Jobs | Included with Vercel | Daily Wix sitemap crawl for auto-publication detection |
| **Authentication** | NextAuth.js + bcryptjs + Neon | Free (included in existing stack) | Email/password login for BWC team, JWT sessions, role-based access |

**Total estimated monthly cost: $27–94/mo** depending on tier selections. Cloudinary, web search, and the site crawler are all free at BWC's current content volume.

---

## 7. Build Phases

### Phase 0: Immediate (No infrastructure needed)

**Use Claude Projects as the interim system.**

- Create a Claude Project at claude.ai
- Upload the Master SOP, the Brand Style Guide, the Compiled Blog Template, and the Site Architecture doc as project knowledge
- Upload the Content Map CSV
- Use the project chat to generate articles manually, pasting in KB context as needed

This gets content production started today while the full system is being built. It won't have dynamic KB access, photo management, or the Blog Registry — but it produces articles.

### Phase 1: Foundation (Weeks 1–3)

**Deploy the database and Onyx.**

- Set up Neon Postgres with the schema above
- Import the Content Map CSV into the `content_map` table
- Deploy Onyx CE on a small VPS
- Connect Onyx to the BWC Google Drive
- Verify that Onyx correctly indexes and retrieves KB documents
- Set up the Google Drive folder structure for photos

**Deliverable:** A working knowledge base that can be queried programmatically.

### Phase 2: Core Engine (Weeks 3–6)

**Build the Next.js app with chat interface and live preview.**

- Scaffold the Next.js project on Vercel
- Set up Prisma with Neon connection, add `users` table to schema
- Implement NextAuth.js with CredentialsProvider, bcryptjs password hashing, JWT sessions, and role-based middleware
- Seed the initial admin user (Russell) via database migration
- Build the orchestration layer (API routes that query Onyx, Postgres, and call Claude)
- Implement the 7-layer system prompt assembly (SOP + Brand Style Guide + Compiled Template + Article Brief + KB Context + Link Graph + Photo Manifest)
- Compile the Brand Style Guide into the Compiled Blog Template (Document 2) — consolidate all CSS into a single stylesheet, build the component library with locked HTML patterns
- **Define the Canonical Article Document schema** — typed JSON structure covering all content node types (title, executive summary, sections, paragraphs, images, pull-quotes, key-facts, FAQ items, links, schema metadata, capture component selections). Implement JSON Schema validation for the document.
- **Build the Article Renderer** — deterministic rendering pipeline that reads the Compiled Template's component library and stylesheet, walks the Canonical Article Document's content tree, and produces trusted Wix-ready HTML. The renderer handles: component selection, Cloudinary URL construction with transformation parameters, JSON-LD schema assembly from metadata fields, capture form JavaScript injection, `data-nosnippet` attribute placement, and HTML override application.
- Configure Claude API calls to return Canonical Article Documents (structured JSON) instead of raw HTML, with `web_search` enabled for external link discovery and verification
- Build the split-pane UI: conversation pane (left) + sandboxed iframe live preview canvas (right)
- Implement real-time structured-to-HTML streaming: as Claude generates the Canonical Article Document, the Article Renderer incrementally produces HTML fragments that are injected into the preview iframe — the user watches the styled article appear in real time
- Implement Canvas Edit mode: `contenteditable` injection on text elements in iframe, `data-cad-path` attribute mapping from rendered elements to canonical document fields, `input` event listeners with debounced sync back to the Canonical Article Document, element highlight borders, locked-element overlays for non-text content
- Implement HTML mode with bidirectional sync: safe text patches map back to canonical document fields, structural overrides stored in an HTML overrides layer and re-applied by the renderer
- Implement unified undo/redo stack across Chat, Canvas Edit, and HTML editing modes — operates on Canonical Article Document states (plus HTML override states)
- Build mobile/desktop/raw-HTML toggle for the preview pane
- Integrate CodeMirror or Monaco editor for the rendered HTML editing mode (HTML mode)
- Build post-generation validation: structured document schema validation, internal link check against Blog Registry, external link HEAD-request verification, new-source flagging
- Build the Article Scorecard QA module — validates both the Canonical Article Document (metadata fields, link counts, schema completeness) and the rendered HTML (heading hierarchy, word count, alt attributes, DOM structure), scorecard overlay UI, click-to-highlight for failed/warned items, FAIL-gate on finalization
- Implement the "Mark as Published" flow that updates the Blog Registry

**Deliverable:** A working split-pane interface that generates structured article documents, renders them into trusted Wix-ready HTML, provides dynamic KB context, correct internal links, live external links found via web search, and a visual preview that updates in real time. The internal architecture separates content generation (Claude) from HTML rendering (application code), ensuring brand consistency and structural validity by construction.

### Phase 3: Photo Pipeline, Dashboard & Data Capture (Weeks 6–8)

- Set up Cloudinary account and configure upload presets (folder structure: `blog/{category}/{filename}`, auto-format enabled)
- Build the Photo Manager view (catalog Drive photos, add descriptions, generate alt text)
- Build the automated upload pipeline: Drive → system → Cloudinary (triggered on article finalization)
- Integrate photo selection into the chat workflow
- Embed selected photos into rendered HTML (via the Article Renderer) with Cloudinary CDN URLs and transformation parameters
- Build the Content Map Dashboard view
- Build the backfill link report ("these existing articles should now link to your new post")
- Upload any existing blog images to Cloudinary and backfill CDN URLs in the photo registry
- Create `leads` and `lead_events` tables in Neon
- Build the `/api/capture` endpoint (validates, enriches with article context, writes to Neon)
- Add capture form components (newsletter, allocation, tour, waitlist, content upgrade) to the Compiled Template with brand-matched styling
- Integrate capture component placement into the article generation flow — engine selects forms based on article type and content
- Build a basic lead capture dashboard (total captures, by article, by type, by hub) for visibility while the full ESP integration is deferred

**Deliverable:** The complete content system — photos served from global CDN, strategy dashboard, link management, and first-party lead capture all operational. Leads accumulate in Neon with full article context, ready for future ESP sync.

### Phase 4: Intelligence Layer & ESP Integration (Weeks 8–10)

- Deploy the Wix site crawler (Vercel Cron Job) — daily sitemap fetch, auto-reconciliation with Blog Registry, slug matching, external-post discovery
- Implement weekly deep crawl: extract titles, internal links, and meta descriptions from published pages to keep the link graph accurate even when posts are edited manually in Wix
- Implement proactive content recommendations (gap analysis, seasonal suggestions, KB change detection)
- Add the post-publish Lighthouse audit reminder with guidance
- Build a simple analytics integration (Google Search Console API) to show which published articles are ranking and for what queries
- **Build ESP sync job:** Scheduled Vercel Cron that pushes new leads from Neon to Klaviyo or Mailchimp with full context tags (capture type, hub topic, wine interest, article source, UTM data). Supports both Klaviyo and Mailchimp APIs — connect whichever ESP BWC selects.
- **Build lead reporting dashboard:** Capture volume over time, conversion rates by article and hub, top-performing capture types, geographic distribution. This data directly informs content strategy — articles that capture more leads get more spokes.
- Refine the UX based on team feedback from real usage

**Deliverable:** A system that automatically knows what's published, actively guides the content strategy, captures and enriches leads with content context, and syncs them to the ESP for automated nurture — never loses track of the site's actual state or its audience.

---

## 8. Key Design Decisions & Rationale

### Why Next.js + Vercel and not a standalone Python backend?

Russell's production stack. He builds and deploys on Vercel already (Savvy Dashboard runs there). No new infrastructure to learn. Vercel's serverless functions handle the API orchestration cleanly, and the frontend is a natural React/Next.js application. Python would add a second deployment environment for no benefit.

### Why Onyx and not a custom vector database (Pinecone, pgvector)?

Non-technical users need to update the knowledge base by dropping files into a Google Drive folder — not by running embedding scripts. Onyx handles the entire RAG pipeline: ingestion, chunking, embedding, retrieval, and re-indexing. It also provides a built-in chat interface for debugging ("ask the KB a question and see what it returns"). Building this from scratch with pgvector would take weeks and produce a worse retrieval system.

### Why Neon Postgres and not just Google Sheets for the Content Map?

The Content Map needs to be queried relationally: "all unpublished spokes in hub X," "all published articles that mention vineyard Y," "which articles link to this URL." Google Sheets API is rate-limited, slow, and can't do joins. The Blog Registry — tracking what's published, what links where, what needs backfill — is fundamentally a relational data problem. Neon's serverless Postgres has zero cold-start on Vercel and a free tier that covers BWC's needs.

### Why structured-first generation instead of direct HTML output?

The most important architectural decision in this system is that Claude generates a **Canonical Article Document** (structured JSON) rather than raw HTML as its primary output. The application's Article Renderer then produces the final HTML from that structured representation using the Compiled Template.

This is counterintuitive — Claude is fully capable of generating HTML, and direct HTML generation feels simpler. But it creates compounding problems at scale:

1. **HTML drift is real and cumulative.** Even with the Compiled Template, a language model generating HTML across hundreds of articles will produce subtle inconsistencies — slightly different attribute ordering, occasional class name variations, structural deviations in edge cases. These are individually minor but collectively make the output unpredictable and hard to QA.

2. **The model shouldn't own visual rendering.** HTML is a presentation format. The model's job is to understand BWC's content, the Knowledge Base, the SEO rules, and the editorial strategy — then express that as structured content. The application's job is to render that content using a locked visual system. Mixing these responsibilities means neither is done as well as it could be.

3. **Structured data enables controlled editing.** When Canvas Edit modifies a heading, it changes a `sections[2].heading` field — not a string inside an HTML tag. When Chat mode adds a section, Claude appends a structured section object — not an HTML fragment that has to be spliced into an existing DOM. Every edit is a schema-valid mutation, which means the system can never enter an inconsistent state.

4. **Redesigns become free.** If BWC updates the blog template in 2027, every previously stored Canonical Article Document can be re-rendered with the new template. No regeneration needed. The content (structured) is independent of the presentation (rendered).

5. **QA becomes more powerful.** The Article Scorecard can validate structured metadata directly (meta title from `metaTitle` field, link count from `internalLinks.length`) instead of parsing HTML strings with fragile heuristics. Schema validation catches issues before they reach the rendered output.

6. **The user experience is unchanged.** The user still sees a fully styled article appear in real time. They still use Chat, Canvas Edit, and HTML modes. They still copy final HTML and paste it into Wix. The structured-first architecture is entirely internal — it makes the system safer and more maintainable without changing what the user sees or does.

### Why two style documents instead of one?

The Brand Style Guide is written for human designers and editors — it explains the *why* behind every visual decision. Claude needs this for editorial intelligence — deciding when a pull-quote is appropriate, when to use a key-facts box, when cream backgrounds are warranted. But Claude doesn't generate HTML directly anymore; it generates a **Canonical Article Document** with structured content nodes. The Compiled Template tells Claude which content types exist (so it generates valid structured nodes) and is consumed by the **Article Renderer** (which produces the actual HTML).

Splitting into a "thinking" document (Brand Style Guide, Layer 2a — Claude reads for editorial decisions) and a "doing" document (Compiled Template, Layer 2b — Claude references for content types, renderer uses for HTML production) gives the system editorial intelligence at the model level and mechanical precision at the rendering level. The compiled template is the single source of truth for HTML/CSS, consumed by deterministic application code rather than a language model.

### Why Cloudinary for image delivery instead of Google Drive or Wix Media?

Google Drive is designed for storage and collaboration, not for serving images on production websites. Drive URLs get rate-limited, lack CDN caching, can't auto-convert to WebP, and occasionally throw interstitial "virus scan" pages that break image embeds. For a luxury brand where page speed directly affects SEO (LCP) and visitor experience, Drive URLs are a production liability.

Wix Media Manager would be the natural choice since the site runs on Wix, but Wix's media upload API requires Velo (developer mode) and introduces fragile dependencies on Wix's internal infrastructure. It also locks images inside Wix — if BWC ever migrates platforms, the images would need to be re-hosted.

Cloudinary gives BWC a **platform-independent image CDN** with automatic format conversion (WebP/AVIF), quality optimization, responsive sizing via URL parameters, and global edge caching — all on a free tier that covers years of content at BWC's volume. The user never touches Cloudinary directly; they upload to Google Drive, describe photos in the app, and the system handles the rest. The architecture keeps Google Drive as the team's working library and Cloudinary as the delivery layer — clean separation of concerns.

### Why Claude Sonnet 4 and not Opus?

For generating Canonical Article Documents, Sonnet 4 produces output quality indistinguishable from Opus at roughly 1/5th the cost. The structured-first architecture actually reduces the demands on the model — Claude no longer needs to manage HTML syntax, CSS class names, or component structure; it focuses purely on content quality, research synthesis, and editorial decisions. At BWC's content volume (4–8 articles per month), the cost difference is modest in absolute terms — but Sonnet is also faster (lower latency for streaming responses in the chat UI), which matters for the conversational workflow. If a specific article requires deeper reasoning (complex competitive analysis, multi-source synthesis), the system could offer an "enhanced generation" option that routes to Opus.

### Why not auto-publish to Wix?

Three reasons. First, Wix's blog API has limitations — custom HTML embeds, schema injection, and image handling don't all work cleanly through the API. Second, the human review step (pasting into Wix and previewing) catches errors that automated publishing would miss. Third, the team is small enough that the 2-minute copy-paste step is not a bottleneck. If BWC scales to dozens of articles per month, Phase 4 could revisit with Wix Velo integration.

---

## 9. What Success Looks Like

**For the content team:** A non-technical user produces a publication-ready blog post in 20–30 minutes instead of 3–4 hours. They never need to remember SEO rules, internal linking structures, or schema markup requirements. The system handles it.

**For SEO performance:** Every article published through the engine is structurally flawless — correct heading hierarchy, comprehensive entity coverage, strategic internal and external links, proper schema, accessible images, and AI-citable paragraphs. The content gap between "best practices" and "what actually gets published" drops to zero.

**For the knowledge base:** The system gets smarter with every document added to the Drive and every article marked as published. The internal link graph deepens. The entity coverage broadens. The topical authority compounds.

**For Bhutan Wine Company:** The content engine becomes the operational backbone of BWC's digital presence — not just a blog tool, but the system through which the world's newest wine country builds its authority, one meticulously crafted article at a time.

---

*This document defines the system. The Master SOP defines the standard. The Content Map defines the strategy. The Canonical Article Document captures the content. The Article Renderer guarantees the output. Together, they are the BWC Content Engine.*
