# BWC Content Engine — Architecture

> Auto-updated by agent-guard. Do not edit manually.

## Stack
- **Framework**: Next.js 15 (App Router, React 19, Turbopack)
- **Database**: Neon Postgres via Prisma ORM
- **Auth**: NextAuth v4 (CredentialsProvider, JWT sessions)
- **AI**: Claude API (article generation)
- **RAG**: Onyx CE (knowledge base retrieval)
- **CDN**: Cloudinary (image hosting and transforms)
- **Hosting**: Vercel

## Database Tables
See `docs/_generated/prisma-models.md` for auto-generated model inventory.

## API Routes
See `docs/_generated/api-routes.md` for auto-generated route inventory.

## Page Routes
| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Root redirect to dashboard |
| `/login` | `src/app/(auth)/login/page.tsx` | Login page (NextAuth credentials) |
| `/dashboard` | `src/app/dashboard/page.tsx` | Main editor dashboard (AppShell, ChatPanel, PreviewPanel) |

## Environment Variables
See `docs/_generated/env-vars.md` for auto-generated variable inventory.
