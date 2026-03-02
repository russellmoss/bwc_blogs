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