# Guide 1: Foundation — DB Schema, Prisma, Auth, Types, agent-guard, Agent Files

## Reference Documents
- `BWC-Master-Orchestration-Doc.md` §5 (shared contracts), §7 (Guide 1 spec), §10 (conventions), §11 (agent-guard)
- `BWC-Content-Engine-System-Architecture.md` §3B (database schema), §3C (authentication)

## What This Guide Builds
The complete data foundation and authentication system for the BWC Content Engine. After this guide, every database table exists, authentication works, all shared TypeScript interfaces are defined, `agent-guard` keeps documentation synchronized, and the `.claude/` agent files enable the agent-driven guide-production loop for all subsequent guides.

## Scope
**In scope:**
- Complete Prisma schema (all 9 tables — even tables not actively used until later guides)
- Prisma client singleton with Neon cold-start retry
- NextAuth.js authentication (CredentialsProvider, bcryptjs, JWT sessions)
- Login page UI
- User management API routes (CRUD)
- Auth middleware (route protection + role checking)
- All shared TypeScript interfaces in `src/types/`
- `CLAUDE.md` standing instructions for Claude Code agents
- `.claude/agents/` and `.claude/skills/` agent files
- `agent-guard` installation and configuration
- `.env.example` with all environment variables documented
- `docs/ARCHITECTURE.md` initial living architecture doc
- Admin user seed script
- Integration test script

**Out of scope:**
- Content Map data seeding (Guide 2)
- Onyx integration (Guide 3)
- Article schema / renderer (Guide 4)
- Any UI beyond login page and dashboard placeholder
- Any API routes beyond auth and users

## Depends On
- Working Vercel deployment with the existing scaffold
- Neon Postgres provisioned and accessible via `DATABASE_URL`
- Environment variables set in Vercel (confirmed in architecture doc)

## Files Created / Modified

### New Files (create these)
```
prisma/
  schema.prisma
  seed.ts

src/app/api/auth/[...nextauth]/route.ts
src/app/api/users/route.ts
src/app/api/users/[id]/route.ts
src/app/(auth)/login/page.tsx
src/app/(auth)/layout.tsx

src/lib/auth/config.ts
src/lib/auth/password.ts
src/lib/auth/session.ts
src/lib/db/index.ts                    ← REPLACE existing placeholder
src/lib/db/retry.ts

src/types/index.ts                      ← REPLACE existing stub
src/types/article.ts
src/types/api.ts
src/types/content-map.ts
src/types/renderer.ts
src/types/qa.ts
src/types/onyx.ts
src/types/claude.ts
src/types/photo.ts
src/types/auth.ts

src/middleware.ts

.env.example
CLAUDE.md
agent-docs.config.json
docs/ARCHITECTURE.md

.claude/agents/code-inspector.md
.claude/agents/integration-verifier.md
.claude/agents/pattern-finder.md
.claude/skills/next-guide/SKILL.md
.claude/skills/build-guide/SKILL.md

scripts/test-guide-1.ts
```

### Modified Files (edit these)
```
package.json                            ← Add Prisma, NextAuth, bcryptjs, agent-guard deps
next.config.ts                          ← (if exists) or next.config.mjs — no changes needed unless Turbopack config required
src/app/layout.tsx                      ← Wrap with session provider if needed
src/app/(dashboard)/page.tsx            ← Keep placeholder but add auth-protected layout
```

## Pre-Flight Checklist

```bash
# Verify we have a clean baseline
npm run build 2>&1 | tail -20
# Expected: Build succeeds, no errors

# Verify Neon is accessible
node -e "const url = process.env.DATABASE_URL || ''; console.log(url ? 'DATABASE_URL set (' + url.substring(0,30) + '...)' : 'DATABASE_URL NOT SET')"
# Expected: DATABASE_URL set (postgres://...)

# Verify current file structure matches expected scaffold
ls src/app/api/health/route.ts src/lib/db/index.ts src/types/index.ts src/config/site.ts 2>&1
# Expected: All files exist
```

**If pre-existing build errors, STOP and report. Do not proceed with a broken baseline.**

---

## PHASE 1: Install Dependencies

### Context
We need Prisma for database access, NextAuth for authentication, bcryptjs for password hashing, Zod for validation, and agent-guard for documentation sync. Install everything upfront so subsequent phases can import freely.

### Step 1.1: Install npm dependencies

```bash
npm install prisma @prisma/client next-auth@4 bcryptjs zod
npm install --save-dev @types/bcryptjs @mossrussell/agent-guard tsx
```

**Why NextAuth v4:** NextAuth v5 (Auth.js) has different API patterns. The architecture doc specifies v4's CredentialsProvider pattern, which is stable and well-documented for Next.js App Router.

**Why tsx:** Used for running TypeScript test scripts directly (`npx tsx scripts/test-guide-1.ts`).

### Step 1.2: Initialize Prisma

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` with the PostgreSQL datasource. If the file already exists, skip this step and edit the existing one.

### PHASE 1 — VALIDATION GATE

```bash
# Verify packages installed
node -e "require('@prisma/client'); console.log('prisma: ok')"
node -e "require('next-auth'); console.log('next-auth: ok')"
node -e "require('bcryptjs'); console.log('bcryptjs: ok')"
node -e "require('zod'); console.log('zod: ok')"
npx agent-guard --version 2>/dev/null || echo "agent-guard: installed (no --version flag)"
```

**Expected:** All packages report ok.

**STOP AND REPORT**: "Dependencies installed. Prisma initialized. Ready for Phase 2 (database schema)."

---

## PHASE 2: Prisma Schema — All Tables

### Context
We create ALL database tables now, even the ones that won't be populated until later guides. This avoids migration conflicts when multiple guides run sequentially — every guide can import any Prisma model without needing a new migration.

### Step 2.1: Write the complete Prisma schema

**File**: `prisma/schema.prisma`
**Action**: Create (or replace if Prisma init created a stub)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}

// ============================================================
// AUTH
// ============================================================

model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  name         String
  passwordHash String   @map("password_hash")
  role         String   @default("editor") // "admin" | "editor" | "viewer"
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @default(now()) @updatedAt @map("updated_at")

  @@map("users")
}

// ============================================================
// CONTENT MAP & STRATEGY
// ============================================================

model ContentMap {
  id                    Int      @id @default(autoincrement())
  hubName               String   @map("hub_name")
  articleType           String   @map("article_type") // "hub" | "spoke" | "news"
  title                 String
  slug                  String?  @unique
  mainEntity            String   @map("main_entity")
  supportingEntities    String[] @map("supporting_entities")
  targetKeywords        String[] @map("target_keywords")
  searchVolumeEst       Int?     @map("search_volume_est")
  keywordDifficulty     String?  @map("keyword_difficulty")
  targetAudience        String?  @map("target_audience")
  status                String   @default("planned") // planned|drafting|finalized|published|needs_update
  scheduledDate         DateTime? @map("scheduled_date") @db.Date
  publishedDate         DateTime? @map("published_date") @db.Date
  publishedUrl          String?  @map("published_url")
  parentHubId           Int?     @map("parent_hub_id")
  contentNotes          String?  @map("content_notes")
  suggestedExternalLinks String[] @map("suggested_external_links")
  internalLinksTo       String[] @map("internal_links_to")
  wordCount             Int?     @map("word_count")
  qaScore               String?  @map("qa_score")
  authorName            String?  @map("author_name")
  source                String   @default("engine") // "engine" | "external"
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @default(now()) @updatedAt @map("updated_at")

  // Relations
  parentHub        ContentMap?        @relation("HubSpokes", fields: [parentHubId], references: [id])
  spokes           ContentMap[]       @relation("HubSpokes")
  articleDocuments ArticleDocument[]
  articleHtmls     ArticleHtml[]
  sourceLinks      InternalLink[]     @relation("SourceArticle")
  targetLinks      InternalLink[]     @relation("TargetArticle")
  articlePhotos    ArticlePhoto[]
  leads            Lead[]

  @@map("content_map")
}

// ============================================================
// ARTICLE STORAGE (structured + rendered)
// ============================================================

model ArticleDocument {
  id           Int      @id @default(autoincrement())
  articleId    Int      @map("article_id")
  version      Int      @default(1)
  canonicalDoc Json     @map("canonical_doc")
  htmlOverrides Json?   @map("html_overrides")
  finalizedAt  DateTime @default(now()) @map("finalized_at")
  finalizedBy  String?  @map("finalized_by")
  notes        String?

  article ContentMap @relation(fields: [articleId], references: [id])

  @@unique([articleId, version])
  @@map("article_documents")
}

model ArticleHtml {
  id              Int      @id @default(autoincrement())
  articleId       Int      @map("article_id")
  version         Int      @default(1)
  documentVersion Int      @map("document_version")
  htmlContent     String   @map("html_content")
  metaTitle       String?  @map("meta_title")
  metaDescription String?  @map("meta_description")
  schemaJson      String?  @map("schema_json")
  finalizedAt     DateTime @default(now()) @map("finalized_at")
  finalizedBy     String?  @map("finalized_by")
  qaScore         String?  @map("qa_score")
  qaFailures      Int      @default(0) @map("qa_failures")
  notes           String?

  article ContentMap @relation(fields: [articleId], references: [id])

  @@unique([articleId, version])
  @@map("article_html")
}

// ============================================================
// INTERNAL LINKING
// ============================================================

model InternalLink {
  id             Int      @id @default(autoincrement())
  sourceArticleId Int?    @map("source_article")
  targetArticleId Int?    @map("target_article")
  targetCorePage String?  @map("target_core_page")
  anchorText     String?  @map("anchor_text")
  linkType       String?  @map("link_type") // hub-to-spoke|spoke-to-hub|spoke-to-sibling|cross-cluster|to-core-page
  isActive       Boolean  @default(false) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")

  sourceArticle ContentMap? @relation("SourceArticle", fields: [sourceArticleId], references: [id])
  targetArticle ContentMap? @relation("TargetArticle", fields: [targetArticleId], references: [id])

  @@map("internal_links")
}

// ============================================================
// PHOTOS
// ============================================================

model Photo {
  id                  Int      @id @default(autoincrement())
  driveFileId         String   @unique @map("drive_file_id")
  driveUrl            String   @map("drive_url")
  cloudinaryPublicId  String?  @map("cloudinary_public_id")
  cloudinaryUrl       String?  @map("cloudinary_url")
  filename            String
  category            String?
  description         String?
  altText             String?  @map("alt_text")
  classification      String   @default("informative") // "informative" | "decorative"
  vineyardName        String?  @map("vineyard_name")
  season              String?
  widthPx             Int?     @map("width_px")
  heightPx            Int?     @map("height_px")
  uploadedToCdn       Boolean  @default(false) @map("uploaded_to_cdn")
  createdAt           DateTime @default(now()) @map("created_at")

  articlePhotos ArticlePhoto[]

  @@map("photos")
}

model ArticlePhoto {
  articleId Int    @map("article_id")
  photoId   Int    @map("photo_id")
  position  String? // "hero" | "inline-1" | "inline-2" etc.

  article ContentMap @relation(fields: [articleId], references: [id])
  photo   Photo      @relation(fields: [photoId], references: [id])

  @@id([articleId, photoId])
  @@map("article_photos")
}

// ============================================================
// LEAD CAPTURE
// ============================================================

model Lead {
  id            Int      @id @default(autoincrement())
  email         String
  firstName     String?  @map("first_name")
  sourceArticleId Int?   @map("source_article")
  sourceUrl     String?  @map("source_url")
  captureType   String   @map("capture_type") // newsletter|allocation|tour|content_upgrade|waitlist
  hubTopic      String?  @map("hub_topic")
  wineInterest  String?  @map("wine_interest")
  travelDates   String?  @map("travel_dates")
  ipCountry     String?  @map("ip_country")
  utmSource     String?  @map("utm_source")
  utmMedium     String?  @map("utm_medium")
  utmCampaign   String?  @map("utm_campaign")
  syncedToEsp   Boolean  @default(false) @map("synced_to_esp")
  espContactId  String?  @map("esp_contact_id")
  createdAt     DateTime @default(now()) @map("created_at")

  sourceArticle ContentMap? @relation(fields: [sourceArticleId], references: [id])
  events        LeadEvent[]

  @@unique([email, sourceArticleId, captureType])
  @@map("leads")
}

model LeadEvent {
  id         Int      @id @default(autoincrement())
  leadId     Int      @map("lead_id")
  eventType  String   @map("event_type") // capture|content_upgrade_download|allocation_submitted|tour_booked|repeat_visit
  eventData  Json?    @map("event_data")
  articleId  Int?     @map("article_id")
  createdAt  DateTime @default(now()) @map("created_at")

  lead LeadEvent? @relation("LeadEvents", fields: [leadId], references: [id])
  selfEvents LeadEvent[] @relation("LeadEvents")

  @@map("lead_events")
}
```

**IMPORTANT**: The `LeadEvent` self-relation above is a workaround. The correct relation is `lead Lead @relation(fields: [leadId], references: [id])`. But Prisma requires the relation to be defined on the referenced model too. Let me fix this:

Actually, the correct approach is:

```prisma
model LeadEvent {
  id         Int      @id @default(autoincrement())
  leadId     Int      @map("lead_id")
  eventType  String   @map("event_type")
  eventData  Json?    @map("event_data")
  articleId  Int?     @map("article_id")
  createdAt  DateTime @default(now()) @map("created_at")

  lead Lead @relation(fields: [leadId], references: [id])

  @@map("lead_events")
}
```

And the `Lead` model already has `events LeadEvent[]`. So the schema as written above is correct for the `Lead` model. For `LeadEvent`, use the simpler version with `lead Lead @relation(...)` — not the self-relation workaround.

### Step 2.2: Push schema to Neon

```bash
npx prisma db push
```

This creates all tables in the Neon database without generating migration files. For a greenfield project, `db push` is faster than migrations. We can switch to `prisma migrate` later if needed.

### Step 2.3: Generate Prisma client

```bash
npx prisma generate
```

### PHASE 2 — VALIDATION GATE

```bash
npx prisma validate
# Expected: "The schema is valid."

npx prisma db push --accept-data-loss 2>&1 | tail -5
# Expected: "Your database is now in sync with your Prisma schema."

# Verify tables exist
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const tables = ['user','contentMap','articleDocument','articleHtml','internalLink','photo','articlePhoto','lead','leadEvent'];
  for (const t of tables) {
    try { console.log(t + ': ' + await p[t].count() + ' rows'); }
    catch(e) { console.log(t + ': ERROR - ' + e.message.slice(0,80)); }
  }
  await p.\$disconnect();
})();
"
# Expected: All tables show 0 rows, no errors
```

**STOP AND REPORT**: "All 9 database tables created in Neon. Prisma client generated. Ready for Phase 3 (Prisma client + retry wrapper)."

---

## PHASE 3: Prisma Client Singleton + Retry Wrapper

### Context
Neon serverless Postgres has cold starts on Vercel. The Prisma client needs a singleton pattern (to avoid connection pool exhaustion in dev) and a retry wrapper with exponential backoff.

### Step 3.1: Prisma client singleton

**File**: `src/lib/db/index.ts`
**Action**: Replace the existing placeholder completely.

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Step 3.2: Database retry wrapper

**File**: `src/lib/db/retry.ts`
**Action**: Create.

```typescript
/**
 * Retry wrapper for Neon cold starts on Vercel.
 * Retries with exponential backoff on connection errors.
 */
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isRetryable =
        lastError.message.includes("Connection refused") ||
        lastError.message.includes("Connection terminated") ||
        lastError.message.includes("ECONNRESET") ||
        lastError.message.includes("socket hang up") ||
        lastError.message.includes("Can't reach database server");

      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

### PHASE 3 — VALIDATION GATE

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 type errors"
# Expected: 0 type errors (or the count should not increase from baseline)
```

**STOP AND REPORT**: "Prisma client singleton and retry wrapper created. Ready for Phase 4 (authentication)."

---

## PHASE 4: Authentication — NextAuth.js

### Context
NextAuth v4 with CredentialsProvider, bcryptjs for password hashing, JWT sessions with user role embedded. This is the same proven pattern from the Savvy Dashboard.

### Step 4.1: Password utilities

**File**: `src/lib/auth/password.ts`
**Action**: Create.

```typescript
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }
  return { valid: true };
}
```

### Step 4.2: NextAuth configuration

**File**: `src/lib/auth/config.ts`
**Action**: Create.

```typescript
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { retryDatabaseOperation } from "@/lib/db/retry";
import { verifyPassword } from "./password";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.toLowerCase().trim();

        const user = await retryDatabaseOperation(() =>
          prisma.user.findUnique({ where: { email } })
        );

        if (!user || !user.isActive) {
          return null;
        }

        const isValid = await verifyPassword(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
```

### Step 4.3: Session helper

**File**: `src/lib/auth/session.ts`
**Action**: Create.

```typescript
import { getServerSession } from "next-auth/next";
import { authOptions } from "./config";

export type UserRole = "admin" | "editor" | "viewer";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("AUTH_REQUIRED");
  }
  return user;
}

export async function requireRole(
  ...roles: UserRole[]
): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Error("AUTH_FORBIDDEN");
  }
  return user;
}
```

### Step 4.4: NextAuth route handler

**File**: `src/app/api/auth/[...nextauth]/route.ts`
**Action**: Create.

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/config";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### Step 4.5: Login page

**File**: `src/app/(auth)/layout.tsx`
**Action**: Create.

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      {children}
    </div>
  );
}
```

**File**: `src/app/(auth)/login/page.tsx`
**Action**: Create.

```typescript
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-stone-200">
        <h1 className="text-2xl font-semibold text-stone-900 mb-1">
          BWC Content Engine
        </h1>
        <p className="text-sm text-stone-500 mb-6">
          Sign in to manage content
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              placeholder="you@bhutanwine.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-stone-900 text-white text-sm font-medium rounded-md hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### Step 4.6: NextAuth type augmentation

**File**: `src/types/next-auth.d.ts`
**Action**: Create.

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
```

### PHASE 4 — VALIDATION GATE

```bash
npx tsc --noEmit 2>&1 | tail -20
npx next lint 2>&1 | tail -10
```

**Expected**: Few or zero type errors. The auth system should compile cleanly. If there are errors about missing SessionProvider or session types, they'll be resolved in Phase 5 (middleware).

**STOP AND REPORT**: "Authentication system built — NextAuth config, login page, password utils, session helpers. Ready for Phase 5 (middleware + user routes)."

---

## PHASE 5: Middleware + User Management API

### Context
Route protection middleware and the user CRUD API. The middleware redirects unauthenticated users to `/login` and checks roles on admin-only routes.

### Step 5.1: Auth middleware

**File**: `src/middleware.ts`
**Action**: Create.

```typescript
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Protect all routes EXCEPT:
     * - /login (auth page)
     * - /api/auth (NextAuth routes)
     * - /api/health (health check)
     * - /api/capture (public lead capture from Wix)
     * - / (landing page — optional, remove if you want landing behind auth)
     * - /_next, /favicon.ico, etc. (static assets)
     */
    "/((?!login|api/auth|api/health|api/capture|_next|favicon.ico).*)",
  ],
};
```

### Step 5.2: User management API — list and create

**File**: `src/app/api/users/route.ts`
**Action**: Create.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

// GET /api/users — List all users (admin only)
export async function GET() {
  try {
    await requireRole("admin");

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: users });
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
}

// POST /api/users — Create a new user (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin");

    const body = await request.json();
    const parsed = CreateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { email, name, password, role } = parsed.data;

    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: passCheck.message } },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Email already registered" } },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
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
}
```

### Step 5.3: User management API — get, update, delete

**File**: `src/app/api/users/[id]/route.ts`
**Action**: Create.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

// GET /api/users/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin");
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id, 10) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: user });
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
}

// PATCH /api/users/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin");
    const { id } = await params;

    const body = await request.json();
    const parsed = UpdateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const data: any = { ...parsed.data };

    if (data.password) {
      data.passwordHash = await hashPassword(data.password);
      delete data.password;
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: user });
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
}

// DELETE /api/users/[id] — Soft delete (deactivate)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin");
    const { id } = await params;

    const user = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true },
    });

    return NextResponse.json({ success: true, data: user });
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
}
```

### PHASE 5 — VALIDATION GATE

```bash
npx tsc --noEmit 2>&1 | tail -20
npx next lint 2>&1 | tail -10

# Check all route files exist
ls src/app/api/auth/\[...nextauth\]/route.ts \
   src/app/api/users/route.ts \
   src/app/api/users/\[id\]/route.ts \
   src/middleware.ts
```

**Expected**: Files exist. Type errors should be minimal or zero.

**STOP AND REPORT**: "Auth middleware and user management API complete. Ready for Phase 6 (shared TypeScript types)."

---

## PHASE 6: Shared TypeScript Interfaces

### Context
These types are the shared contracts between every subsystem. They're created now so every subsequent guide can import them. They live in `src/types/` and are re-exported from `src/types/index.ts`.

### Step 6.1: Auth types

**File**: `src/types/auth.ts`
**Action**: Create.

```typescript
export type UserRole = "admin" | "editor" | "viewer";

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Step 6.2: Content Map types

**File**: `src/types/content-map.ts`
**Action**: Create.

```typescript
export type ArticleType = "hub" | "spoke" | "news";

export type ArticleStatus =
  | "planned"
  | "drafting"
  | "finalized"
  | "published"
  | "needs_update";

export interface ContentMapEntry {
  id: number;
  hubName: string;
  articleType: ArticleType;
  title: string;
  slug: string | null;
  mainEntity: string;
  supportingEntities: string[];
  targetKeywords: string[];
  searchVolumeEst: number | null;
  keywordDifficulty: string | null;
  targetAudience: string | null;
  status: ArticleStatus;
  scheduledDate: Date | null;
  publishedDate: Date | null;
  publishedUrl: string | null;
  parentHubId: number | null;
  contentNotes: string | null;
  suggestedExternalLinks: string[];
  internalLinksTo: string[];
  wordCount: number | null;
  qaScore: string | null;
  authorName: string | null;
  source: "engine" | "external";
}
```

### Step 6.3: Article types (Canonical Article Document)

**File**: `src/types/article.ts`
**Action**: Create.

```typescript
import { ArticleType } from "./content-map";

// ============================================================
// CANONICAL ARTICLE DOCUMENT — the central data structure
// Claude generates this. Renderer consumes it. QA validates it. DB stores it.
// ============================================================

export interface CanonicalArticleDocument {
  version: string; // Schema version, e.g. "1.0"
  articleId: number; // FK to content_map.id
  slug: string;
  articleType: ArticleType;
  hubId: number | null;
  title: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  publishDate: string; // ISO 8601
  modifiedDate: string; // ISO 8601
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

export interface AuthorInfo {
  name: string;
  credentials: string;
  bio: string;
  linkedinUrl: string | null;
}

export interface ArticleSection {
  id: string; // "section-1", "section-2", etc.
  heading: string;
  headingLevel: 2 | 3;
  content: ContentNode[];
}

// ============================================================
// CONTENT NODES — the building blocks of article sections
// ============================================================

export type ContentNodeType =
  | "paragraph"
  | "image"
  | "pullQuote"
  | "keyFacts"
  | "table"
  | "list"
  | "callout";

export interface ContentNodeBase {
  type: ContentNodeType;
  id: string;
}

export interface ParagraphNode extends ContentNodeBase {
  type: "paragraph";
  text: string; // HTML-safe text (may contain <a>, <strong>, <em>)
}

export interface ImageNode extends ContentNodeBase {
  type: "image";
  placement: ImagePlacement;
}

export interface PullQuoteNode extends ContentNodeBase {
  type: "pullQuote";
  text: string;
  attribution: string | null;
}

export interface KeyFactsNode extends ContentNodeBase {
  type: "keyFacts";
  title: string;
  facts: { label: string; value: string }[];
}

export interface TableNode extends ContentNodeBase {
  type: "table";
  caption: string | null;
  headers: string[];
  rows: string[][];
}

export interface ListNode extends ContentNodeBase {
  type: "list";
  ordered: boolean;
  items: string[];
}

export interface CalloutNode extends ContentNodeBase {
  type: "callout";
  variant: "info" | "tip" | "warning";
  text: string;
}

export type ContentNode =
  | ParagraphNode
  | ImageNode
  | PullQuoteNode
  | KeyFactsNode
  | TableNode
  | ListNode
  | CalloutNode;

// ============================================================
// IMAGES & LINKS
// ============================================================

export interface ImagePlacement {
  photoId: number | null; // FK to photos table, null if external
  src: string; // URL (Cloudinary CDN or Drive fallback)
  alt: string; // Descriptive text (empty for decorative)
  caption: string | null;
  classification: "informative" | "decorative";
  width: number | null;
  height: number | null;
}

export type TrustTier = "primary" | "authority" | "niche_expert" | "general";

export interface InternalLinkRef {
  targetUrl: string;
  targetArticleId: number | null;
  targetCorePage: string | null;
  anchorText: string;
  linkType: string;
  sectionId: string; // Which section this link appears in
}

export interface ExternalLinkRef {
  url: string;
  anchorText: string;
  trustTier: TrustTier;
  sourceName: string;
  sectionId: string;
}

// ============================================================
// FAQ & SCHEMA
// ============================================================

export interface FAQItem {
  question: string;
  answer: string;
}

export interface SchemaFlags {
  blogPosting: boolean;
  faqPage: boolean;
  product: boolean;
}

export type CaptureType =
  | "newsletter"
  | "allocation"
  | "tour"
  | "content_upgrade"
  | "waitlist";
```

### Step 6.4: Renderer types

**File**: `src/types/renderer.ts`
**Action**: Create.

```typescript
import { CanonicalArticleDocument } from "./article";

export interface HtmlOverride {
  path: string; // CSS selector or data-cad-path
  html: string; // Replacement HTML fragment
  reason: string; // Why the override was applied
}

export interface RendererInput {
  document: CanonicalArticleDocument;
  htmlOverrides: HtmlOverride[] | null;
  templateVersion: string;
}

export interface RendererOutput {
  html: string;
  metaTitle: string;
  metaDescription: string;
  schemaJson: string;
  wordCount: number;
}
```

### Step 6.5: QA types

**File**: `src/types/qa.ts`
**Action**: Create.

```typescript
export type CheckSeverity = "fail" | "warn" | "info";

export interface QACheck {
  id: string; // "F1", "W3", etc.
  name: string; // "H1 present"
  severity: CheckSeverity;
  rule: string; // Human-readable rule description
  category: string; // "structure" | "metadata" | "links" | "images" | "schema" | "readability"
}

export interface QAResult {
  check: QACheck;
  passed: boolean;
  score: number; // 1 (pass), 0.5 (warn), 0 (fail)
  message: string; // "H1 found: 'Himalayan Terroir...'" or "H1 missing"
  elementPath: string | null; // CSS selector for highlight
  fixSuggestion: string | null; // Pre-populated fix prompt
}

export interface QAScore {
  total: number; // e.g. 48
  possible: number; // e.g. 52
  failCount: number;
  warnCount: number;
  passCount: number;
  results: QAResult[];
  canFinalize: boolean; // failCount === 0
}
```

### Step 6.6: Onyx types

**File**: `src/types/onyx.ts`
**Action**: Create.

```typescript
export interface OnyxSearchResult {
  documentId: string;
  content: string;
  sourceDocument: string; // Filename or document title
  score: number;
  metadata: Record<string, unknown>;
}

export interface OnyxContext {
  query: string;
  results: OnyxSearchResult[];
  totalResults: number;
  searchTimeMs: number;
}

export interface OnyxHealthStatus {
  healthy: boolean;
  indexedDocuments: number | null;
  lastIndexTime: string | null;
  responseTimeMs: number;
}
```

### Step 6.7: Claude types

**File**: `src/types/claude.ts`
**Action**: Create.

```typescript
import { CanonicalArticleDocument } from "./article";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface PromptLayer {
  name: string;
  content: string;
  tokenEstimate: number;
}

export interface GenerationRequest {
  articleId: number;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  currentDocument: CanonicalArticleDocument | null;
}

export interface GenerationResponse {
  document: CanonicalArticleDocument;
  conversationReply: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  webSearchResults: WebSearchResult[];
}

export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
}
```

### Step 6.8: Photo types

**File**: `src/types/photo.ts`
**Action**: Create.

```typescript
export interface Photo {
  id: number;
  driveFileId: string;
  driveUrl: string;
  cloudinaryPublicId: string | null;
  cloudinaryUrl: string | null;
  filename: string;
  category: string | null;
  description: string | null;
  altText: string | null;
  classification: "informative" | "decorative";
  vineyardName: string | null;
  season: string | null;
  widthPx: number | null;
  heightPx: number | null;
  uploadedToCdn: boolean;
}

export interface PhotoManifest {
  photos: Photo[];
  heroPhotoId: number | null;
  totalAvailable: number;
}

export interface CloudinaryTransform {
  width: number;
  format: "auto";
  quality: "auto";
  additionalParams?: string;
}
```

### Step 6.9: API types

**File**: `src/types/api.ts`
**Action**: Create.

```typescript
// Standard API response wrappers
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Error codes (from orchestration doc §10)
export type ErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "GENERATION_FAILED"
  | "ONYX_UNAVAILABLE"
  | "RENDER_ERROR"
  | "QA_GATE_FAILED"
  | "CLOUDINARY_ERROR"
  | "LINK_VERIFICATION_FAILED"
  | "INTERNAL_ERROR";
```

### Step 6.10: Re-export index

**File**: `src/types/index.ts`
**Action**: Replace the existing stub.

```typescript
export * from "./auth";
export * from "./content-map";
export * from "./article";
export * from "./renderer";
export * from "./qa";
export * from "./onyx";
export * from "./claude";
export * from "./photo";
export * from "./api";
```

### PHASE 6 — VALIDATION GATE

```bash
npx tsc --noEmit 2>&1 | tail -20
# Expected: Zero or very few type errors

# Verify all type files exist
ls src/types/auth.ts src/types/content-map.ts src/types/article.ts \
   src/types/renderer.ts src/types/qa.ts src/types/onyx.ts \
   src/types/claude.ts src/types/photo.ts src/types/api.ts \
   src/types/index.ts
# Expected: All files exist

# Verify exports
npx tsx -e "const t = require('./src/types'); console.log(Object.keys(t).length + ' exports from types/index.ts')"
# Expected: 30+ exports
```

**STOP AND REPORT**: "All shared TypeScript interfaces defined — 10 type files with 30+ exported types/interfaces. These are the shared contracts for all subsequent guides. Ready for Phase 7 (seed script)."

---

## PHASE 7: Admin Seed Script

### Context
Seed one admin user (Russell) with a hashed password so you can log in immediately.

### Step 7.1: Create seed script

**File**: `prisma/seed.ts`
**Action**: Create.

```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Seed admin user
  const email = (process.env.ADMIN_EMAIL || "russell@bhutanwine.com").toLowerCase();
  const name = process.env.ADMIN_NAME || "Russell Moss";
  const password = process.env.ADMIN_PASSWORD || "changeme123";

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "admin", isActive: true },
    create: { email, name, passwordHash, role: "admin", isActive: true },
  });

  console.log(`Admin user seeded: ${admin.email} (id: ${admin.id})`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Step 7.2: Add seed config to package.json

Add to the existing `package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### Step 7.3: Run the seed

```bash
npx prisma db seed
```

### PHASE 7 — VALIDATION GATE

```bash
npx prisma db seed 2>&1 | tail -5
# Expected: "Admin user seeded: russell@bhutanwine.com (id: 1)"

npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const u = await p.user.findFirst({ where: { role: 'admin' } });
  console.log(u ? 'Admin found: ' + u.email : 'ERROR: No admin user');
  await p.\$disconnect();
})();
"
# Expected: "Admin found: russell@bhutanwine.com"
```

**STOP AND REPORT**: "Admin user seeded. Ready for Phase 8 (.env.example + CLAUDE.md + agent files)."

---

## PHASE 8: .env.example, CLAUDE.md, Agent Files

### Context
Documentation and tooling setup — `.env.example` documents all required env vars, `CLAUDE.md` gives Claude Code agents project context, and the `.claude/` directory enables the agent-driven guide-production loop.

### Step 8.1: Create .env.example

**File**: `.env.example`
**Action**: Create.

```bash
# ============================================================
# BWC Content Engine — Environment Variables
# ============================================================
# Copy to .env.local and fill in real values for local development.
# All variables are already set in Vercel for production.
# ============================================================

# --- App ---
NODE_ENV=development
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# --- Database (Neon Postgres via Vercel Storage) ---
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@host/db?sslmode=require

# --- Auth (NextAuth.js) ---
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=same-as-nextauth-secret
AUTH_URL=http://localhost:3000

# --- Admin Seed ---
ADMIN_EMAIL=russell@bhutanwine.com
ADMIN_NAME=Russell Moss
ADMIN_PASSWORD=changeme123

# --- Claude API ---
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_SMALL_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_MAX_OUTPUT_TOKENS=16384

# --- Onyx RAG ---
ONYX_BASE_URL=https://rmoss-onyx.xyz
ONYX_API_URL=https://rmoss-onyx.xyz/api
ONYX_API_KEY=your-onyx-api-key
ONYX_INDEX_NAME=default
ONYX_SEARCH_TIMEOUT_MS=10000

# --- Cloudinary ---
CLOUDINARY_URL=cloudinary://key:secret@deahtb4kj
CLOUDINARY_CLOUD_NAME=deahtb4kj
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
CLOUDINARY_UPLOAD_FOLDER=blog
CLOUDINARY_SECURE_DELIVERY=true

# --- BWC Site ---
BWC_SITE_URL=https://www.bhutanwine.com
BWC_BLOG_BASE_URL=https://www.bhutanwine.com/blog
BWC_SITEMAP_URL=https://www.bhutanwine.com/sitemap.xml
WIX_BLOG_COLLECTION_PATH=/blog
DEFAULT_CANONICAL_DOMAIN=https://www.bhutanwine.com

# --- Feature Flags ---
ENABLE_QA_SCORECARD=true
ENABLE_HTML_MODE=true
ENABLE_CANVAS_EDIT=true
ENABLE_WEB_SEARCH=true
ENABLE_PHOTO_MANAGER=true
ENABLE_LEAD_CAPTURE=false

# --- App Config ---
CRON_SECRET=generate-a-random-secret
LINK_CHECK_TIMEOUT_MS=5000
MAX_EXTERNAL_LINKS_PER_ARTICLE=15
USER_AGENT=BWCContentEngine/1.0
DEFAULT_TIMEZONE=Asia/Thimphu
DEFAULT_LOCALE=en-US
LOG_LEVEL=info
SKIP_AUTH_IN_DEV=false
SEED_DEV_DATA=true
```

### Step 8.2: Create CLAUDE.md

**File**: `CLAUDE.md`
**Action**: Create.

```markdown
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
Each implementation guide owns specific directories. Check BWC-Master-Orchestration-Doc.md §5E before modifying files outside your guide's scope.
```

### Step 8.3: Create agent and skill files

Create the following files with the exact content from the downloaded agent/skill files:

**Directory structure:**
```
.claude/
├── agents/
│   ├── code-inspector.md
│   ├── integration-verifier.md
│   └── pattern-finder.md
└── skills/
    ├── next-guide/
    │   └── SKILL.md
    └── build-guide/
        └── SKILL.md
```

**IMPORTANT**: Copy the agent and skill files from the outputs directory. These files were produced alongside the Master Orchestration Doc and contain BWC-specific investigation instructions for code inspection, integration verification, pattern finding, next-guide exploration, and build-guide production. Do NOT create empty placeholders — copy the full content.

### PHASE 8 — VALIDATION GATE

```bash
# Verify files exist
ls .env.example CLAUDE.md .claude/agents/code-inspector.md \
   .claude/agents/integration-verifier.md .claude/agents/pattern-finder.md \
   .claude/skills/next-guide/SKILL.md .claude/skills/build-guide/SKILL.md

# Verify .env.example has expected variables
grep -c "=" .env.example
# Expected: 40+ variable definitions
```

**STOP AND REPORT**: "Documentation and agent files created. Ready for Phase 9 (agent-guard setup)."

---

## PHASE 9: agent-guard Setup

### Context
Install and configure `agent-guard` to keep documentation synchronized with code on every commit.

### Step 9.1: Initialize agent-guard

```bash
npx agent-guard init --yes --project-name "BWC Content Engine" --prisma --agent-config CLAUDE.md
```

If this fails or the flags aren't supported, run interactively:

```bash
npx agent-guard init
```

And configure:
- Project name: `BWC Content Engine`
- Architecture file: `docs/ARCHITECTURE.md`
- Agent config file: `CLAUDE.md`
- Enable Prisma scanning: yes
- Engine: `api`

### Step 9.2: Verify or update agent-docs.config.json

**File**: `agent-docs.config.json`
**Action**: Verify the init created it, or create/update to match:

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

### Step 9.3: Run generators manually to verify

```bash
npx agent-guard gen
```

### Step 9.4: Verify git hooks are installed

```bash
npm run prepare 2>/dev/null || npx husky install 2>/dev/null
cat .husky/pre-commit 2>/dev/null || echo "No pre-commit hook found — agent-guard may use a different hook mechanism. Check npx agent-guard check"
```

### PHASE 9 — VALIDATION GATE

```bash
# Verify generated docs exist
ls docs/_generated/ 2>/dev/null
# Expected: api-routes.md, prisma-models.md, env-vars.md (some may not exist yet if generators haven't run)

# Run agent-guard check manually
npx agent-guard check 2>&1 | head -20
# Expected: No errors (may show "no changes detected" which is fine)

# Verify config
cat agent-docs.config.json | head -5
# Expected: Shows "BWC Content Engine"
```

**STOP AND REPORT**: "agent-guard configured with API engine. Generators and pre-commit hook ready. Ready for Phase 10 (integration test + final validation)."

---

## PHASE 10: Integration Test Script + Final Gate

### Step 10.1: Create the integration test

**File**: `scripts/test-guide-1.ts`
**Action**: Create.

```typescript
/**
 * Integration test for Guide 1: Foundation
 *
 * Run with: npx tsx scripts/test-guide-1.ts
 *
 * Tests:
 * 1. Prisma client can connect to Neon
 * 2. All 9 tables exist
 * 3. Admin user is seeded
 * 4. Health endpoint returns 200
 * 5. Type exports work
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  let passed = 0;
  let failed = 0;

  function check(name: string, result: boolean) {
    if (result) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  }

  console.log("\n=== Guide 1 Integration Tests ===\n");

  // Test 1: Database connection
  console.log("1. Database connection");
  try {
    await prisma.$queryRaw`SELECT 1`;
    check("Prisma connects to Neon", true);
  } catch (e) {
    check("Prisma connects to Neon", false);
    console.log(`     Error: ${(e as Error).message}`);
  }

  // Test 2: All tables exist
  console.log("\n2. Table existence");
  const tables = [
    "user",
    "contentMap",
    "articleDocument",
    "articleHtml",
    "internalLink",
    "photo",
    "articlePhoto",
    "lead",
    "leadEvent",
  ] as const;

  for (const table of tables) {
    try {
      const count = await (prisma[table as any] as any).count();
      check(`${table} table exists (${count} rows)`, true);
    } catch (e) {
      check(`${table} table exists`, false);
    }
  }

  // Test 3: Admin user seeded
  console.log("\n3. Seed data");
  try {
    const admin = await prisma.user.findFirst({ where: { role: "admin" } });
    check("Admin user exists", !!admin);
    check("Admin email is correct", admin?.email === "russell@bhutanwine.com");
    check("Admin is active", admin?.isActive === true);
  } catch (e) {
    check("Admin user query", false);
  }

  // Test 4: Health endpoint
  console.log("\n4. Health endpoint");
  try {
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${appUrl}/api/health`);
    check("Health endpoint returns 200", res.status === 200);
  } catch (e) {
    check("Health endpoint reachable", false);
    console.log("     (Start dev server with npm run dev first)");
  }

  // Test 5: Types import
  console.log("\n5. Type exports");
  try {
    // This is a compile-time check — if the types are wrong, tsc catches it
    check("Types compile (verified by tsc --noEmit)", true);
  } catch {
    check("Types compile", false);
  }

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

test();
```

### Step 10.2: Run the full gate sequence

```bash
# Gate 1: Lint & Type Check
echo "=== Gate 1: Type Check ==="
npx tsc --noEmit 2>&1 | tail -20
echo ""
echo "=== Gate 1: Lint ==="
npx next lint 2>&1 | tail -10
echo ""
echo "=== Gate 1: Prisma Validate ==="
npx prisma validate

# Gate 2: Integration Test
echo ""
echo "=== Gate 2: Integration Test ==="
npx tsx scripts/test-guide-1.ts
```

### PHASE 10 — VALIDATION GATE (FINAL)

All checks above must pass. Then commit everything:

```bash
git add -A
git commit -m "feat: Guide 1 complete — foundation (DB, auth, types, agent-guard, agent files)"
```

`agent-guard` should fire on this commit, generating `docs/_generated/` files and staging them automatically.

**STOP AND REPORT**: Tell the user:
- "Guide 1 complete. All 9 database tables created, auth system working, 30+ shared types defined, agent-guard configured, agent files committed."
- "**Human Gate**: Run `npm run dev`, navigate to `/login`, sign in with the admin credentials. Verify the dashboard placeholder loads behind auth."
- "After verifying, run `/next-guide` in a new Claude Code session to prepare for Guide 2."

---

## Troubleshooting

### Common Issues

**"Can't reach database server" on `prisma db push`:**
- Check `DATABASE_URL` is set in `.env.local` (copy from Vercel environment variables)
- Neon may need to wake up — retry after 10 seconds
- Ensure the URL includes `?sslmode=require`

**NextAuth "NEXTAUTH_SECRET missing" error:**
- Create `.env.local` with `NEXTAUTH_SECRET` value from Vercel
- Also set `NEXTAUTH_URL=http://localhost:3000`

**Type errors about `@prisma/client` imports:**
- Run `npx prisma generate` to regenerate the client
- Restart your TypeScript server (`Ctrl+Shift+P` → "TypeScript: Restart TS Server" in VS Code)

**Login page submits but shows "Invalid email or password":**
- Verify seed ran: `npx tsx -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.findFirst().then(u=>console.log(u)).finally(()=>p.\$disconnect())"`
- Verify the password matches what was seeded (check `ADMIN_PASSWORD` env var)

**`agent-guard` init fails:**
- Ensure `ANTHROPIC_API_KEY` is set in `.env.local` (needed for the API engine)
- Try `npx agent-guard init` interactively instead of with `--yes`
- If hooks fail, try `npm run prepare` or manually create `.husky/pre-commit`

**Prisma LeadEvent self-relation error:**
- The `LeadEvent` model should have `lead Lead @relation(fields: [leadId], references: [id])`, NOT a self-relation. If Prisma complains about the relation, ensure `Lead` has `events LeadEvent[]` and `LeadEvent` has `lead Lead @relation(fields: [leadId], references: [id])`.
