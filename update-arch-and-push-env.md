# Claude Code Prompt — Update Architecture Doc + Push Neon Env Vars to Vercel

You are in `C:\Users\russe\BWC_blogs`.

## Two tasks in this prompt. Do both.

---

## Task 1 — Push new Neon environment variables to Vercel

Our `.env` now has Neon Postgres credentials that were added after the initial Vercel deploy. These need to be pushed to Vercel so production has them.

Read the `.env` file and identify ALL Neon/Postgres-related variables. These include any variable matching:
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `DIRECT_URL`
- `PGHOST`
- `PGHOST_UNPOOLED`
- `PGUSER`
- `PGDATABASE`
- `PGPASSWORD`
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`
- `POSTGRES_URL_NO_SSL`
- `POSTGRES_PRISMA_URL`

For each one that has a real value (not a placeholder), push it to Vercel:

```bash
echo "VALUE" | npx vercel env add VARIABLE_NAME production preview development --force
```

Use `--force` to overwrite any existing placeholder values.

After pushing, verify by running:
```bash
npx vercel env ls
```

Confirm all Neon/Postgres vars are present in the Vercel project.

Also update the `.env.example` file to include all Neon/Postgres variable names (with placeholder values, no real credentials).

---

## Task 2 — Update the Architecture Doc with Current Infrastructure State

Read the file `BWC-Content-Engine-System-Architecture.md` in this directory fully.

Then ADD a new top-level section near the beginning of the document (after any existing intro/overview, before the detailed architecture sections) called:

```markdown
## Current Infrastructure State — As Built
```

This section documents what is actually deployed and working RIGHT NOW. It serves as the source of truth for all future implementation guides. Write it based on what actually exists in this repo and our infrastructure.

### Include these subsections:

#### Deployed Infrastructure

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

#### DigitalOcean Droplet (Onyx Host)

- **IP:** 159.65.45.1
- **OS:** Ubuntu 24.04 LTS
- **RAM:** 4GB + 4GB swap
- **Disk:** 80GB
- **Region:** NYC3
- **Domain:** `rmoss-onyx.xyz` (via Cloudflare, SSL Flexible)
- **Docker containers:** nginx, api_server, web_server, background, inference_model_server, indexing_model_server, relational_db (postgres), minio, cache (redis), index (vespa), code-interpreter
- **Auth:** Google OAuth (`russellmoss87@gmail.com`)
- **Connectors:** Google Drive (OAuth, pointed at BWC knowledge base folder)

#### Vercel Project

- **Name:** `bwc-content-engine`
- **URL:** `https://bwc-content-engine.vercel.app`
- **Team/Scope:** `russell-moss-projects`
- **Region:** `iad1` (US East — Washington DC)
- **Framework:** Next.js (App Router)
- **GitHub:** `russellmoss/bwc_blogs` (auto-deploy on push to `main`)

#### Current App Scaffold

Read the actual `src/` directory and document what files exist. Use `dir` or `ls` to get the real file tree. Then write it out like:

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              ← Landing page (BWC branded)
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

Verify this against the ACTUAL files — don't assume. Read the directory and document what's really there.

#### Environment Variables — Complete Inventory

Read the `.env` file. For EACH variable, document:
- Variable name
- Whether it has a real value or is still a placeholder
- Which service it belongs to
- Whether it's in Vercel (based on Task 1 results)

Format as a table:

```markdown
| Variable | Service | Has Value | In Vercel |
|---|---|---|---|
| DATABASE_URL | Neon | ✅ | ✅ |
| ANTHROPIC_API_KEY | Claude | ✅ | ✅ |
| ... | ... | ... | ... |
```

Do NOT include actual secret values — just ✅/❌ for whether they're set.

#### Verified Endpoints

| Endpoint | URL | Status |
|---|---|---|
| Landing page | `https://bwc-content-engine.vercel.app` | ✅ |
| Health check | `https://bwc-content-engine.vercel.app/api/health` | ✅ |
| Onyx UI | `https://rmoss-onyx.xyz` | ✅ |

#### What's NOT Built Yet

List what the architecture doc describes but does NOT yet exist in the codebase:
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

### Writing rules for this section

- Be factual — document what IS, not what we plan
- Use tables for structured data
- Keep it scannable
- This section will be read by Claude Code in future sessions to understand the starting state
- Do not rewrite or remove any existing sections of the architecture doc — only ADD this new section

### After updating the doc

1. Commit and push:
```bash
git add BWC-Content-Engine-System-Architecture.md .env.example
git commit -m "docs: add current infrastructure state to architecture doc

- Document all deployed services and their status
- Complete env variable inventory
- Current scaffold file tree
- Verified endpoints
- What remains to be built"
git push origin main
```

2. Report back:
- Confirm the architecture doc is updated
- Confirm all Neon env vars are in Vercel
- List any env vars that are still placeholder/missing
- Confirm the push succeeded
