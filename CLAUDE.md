# BWC Content Engine — Agent Instructions

## Project Overview
Content generation system for Bhutan Wine Company. Produces publication-ready, SEO-optimized blog posts as Wix-ready HTML. Built with Next.js 15 (App Router, React 19, Turbopack) on Vercel, Neon Postgres, Onyx CE RAG, Claude API, and Cloudinary CDN.

## Architecture
- **Structured-first generation**: Claude generates a CanonicalArticleDocument (typed JSON), the Article Renderer produces HTML
- **Three editing modes**: Chat (Claude modifies doc), Canvas Edit (contenteditable with data-cad-path), HTML (direct source)
- **QA Scorecard**: Deterministic checks, FAIL blocks finalization
- **Manual Wix publishing**: User copies HTML to Wix — no auto-publish

## Documentation Structure
- `docs/ARCHITECTURE.md` — Living architecture doc (auto-updated by agent-guard)
- `docs/_generated/` — Auto-generated inventories (DO NOT EDIT MANUALLY)
- `BWC-Master-Orchestration-Doc.md` — Build orchestration plan
- `BWC-Content-Engine-System-Architecture.md` — Full system design (read-only reference)
- `docs/BWC Master Content Engine SOP.md` — Editorial standards, SEO rules, QA checks (Layer 1 of system prompt)
- `docs/Bhutan Wine Company — Brand Style Guide for HTML Blog Posts (3).md` — Visual system, CSS, typography, BEM components (Layer 2a of system prompt)

## When You Change Code, Also Update:
1. `.env.example` if you add new environment variables
2. `src/types/` if you change shared interfaces (add to the appropriate file, re-export from index.ts)
3. Relevant test scripts in `scripts/`
4. `agent-guard` will auto-update `docs/ARCHITECTURE.md` and `docs/_generated/` on commit

## Conventions
- **API routes**: kebab-case paths, consistent response format: `{ success: true, data }` / `{ success: false, error: { code, message } }`
- **TypeScript**: strict mode, Zod for runtime validation, interfaces in `src/types/`
- **Files**: kebab-case filenames, PascalCase components, camelCase functions
- **Database**: Prisma ORM, snake_case columns via `@map()`, PascalCase models
- **Auth**: NextAuth v4, JWT sessions, `requireAuth()` / `requireRole()` helpers
- **Styling**: Tailwind for app UI, BEM with `bwc-` prefix for blog article output
- **Errors**: typed error codes from `src/types/api.ts`, try/catch in all route handlers
- **Commits**: conventional commits format (`feat:`, `fix:`, `chore:`, `test:`)

## Blog Article Output — Brand Style Standards

The Article Renderer (`src/lib/renderer/`) produces Wix-ready HTML governed by the Brand Style Guide. These are non-negotiable:

### CSS Variables (from Brand Style Guide §3)
```
--bwc-gold: #bc9b5d;  --bwc-black: #000000;  --bwc-white: #ffffff;
--bwc-text-primary: #000000;  --bwc-text-secondary: #414141;  --bwc-text-dark-alt: #242323;
--bwc-text-footer: #292929;  --bwc-text-brown: #624c40;
--bwc-bg-cream: #fcf8ed;  --bwc-bg-peach: #f6ebe4;  --bwc-bg-light: #f7f7f7;
--bwc-bg-soft-gray: #e8e6e6;  --bwc-bg-blue: #c8eef5;  --bwc-bg-green: #316142;
--bwc-border-light: #cccccc;
```

### Font Stack (from Brand Style Guide §4–6)
- **h1**: Cormorant Garamond 600, 48px, `--bwc-gold`
- **h2**: Fraunces 400, 36px, `--bwc-text-dark-alt`
- **h3**: Cormorant Garamond 600, 28px, `--bwc-text-primary`
- **Body (p, li)**: Nunito Sans 300, 16px/1.7, `--bwc-text-primary`
- **Blockquote**: Cormorant Garamond 300, 24px, `--bwc-text-brown`, gold left border
- **Figcaption**: Trirong 400, 13px, `--bwc-text-secondary`
- **Lead/intro**: Fraunces 400, 21px, `--bwc-text-secondary`
- Google Fonts import: Cormorant Garamond, Fraunces, Nunito Sans, Trirong

### Renderer FAIL-Level Constraints (from SOP §2–3, §12)
These checks MUST pass in `src/lib/article-schema/` Zod validation:
- Exactly one H1 (the title) — no more, no less
- Heading hierarchy: H1 > H2 > H3 only, never skip levels, never H4–H6
- Executive Summary: 25–40 words, present on every article
- Meta title: 50–60 characters
- Meta description: 150–160 characters
- Word count minimums: Hub ≥ 2500, Spoke ≥ 1200, News ≥ 600
- H2 count: Hub 5–8, Spoke 3–5, News 2–3
- Internal links minimum: Hub ≥ 8, Spoke ≥ 5, News ≥ 3
- External links minimum: Hub ≥ 5, Spoke ≥ 3, News ≥ 2
- All informative images require alt text (10–25 words); decorative images require `alt=""`
- Hero image: `loading="eager"` + `fetchpriority="high"`; all others `loading="lazy"`
- All images require explicit `width` and `height` attributes
- BlogPosting schema required on every article
- FAQPage schema required if and only if FAQ section is present
- Author byline with credentials required
- Publication date and last-updated date required

## File Ownership
Each implementation guide owns specific directories. Check BWC-Master-Orchestration-Doc.md S5E before modifying files outside your guide's scope.


## Documentation Maintenance — Standing Instructions

### Rule: Update Docs When You Change Code

When you add, rename, remove, or significantly modify any of the following, you MUST update the relevant documentation **in the same session** — do not defer to a later task:

| If You Changed… | Update This | And Run… |
|---|---|---|
| `prisma/schema.prisma` | Database Models section in `docs\ARCHITECTURE.md` | Run `npm run gen:models` |
| `.env.example` | Environment Variables section in `docs\ARCHITECTURE.md` | Run `npm run gen:env` |
| Files matching `^src/app/api/.+/route\.ts$` | API Routes section in `docs\ARCHITECTURE.md` | Run `npm run gen:api-routes` |
| Files matching `^src/app/.+/page\.tsx$` | Page Routes section in `docs\ARCHITECTURE.md` | — |

### Generated Inventories

Auto-generated inventory files exist at `docs\_generated\`:
- `npm run gen:models`
- `npm run gen:env`
- `npm run gen:api-routes`
- Run all: `npm run gen:all`

These are committed to the repo. Always regenerate after changing routes, models, or env vars.

### What NOT to Do
- Do NOT edit files in `docs\_generated\` manually — they are overwritten by scripts
- Do NOT skip documentation updates because "it's a small change" — small changes accumulate into drift
- Do NOT update `docs\ARCHITECTURE.md` without reading the existing section first — match the format