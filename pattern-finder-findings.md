# Pattern Finder Findings -- Guide 3 Reference

Generated: 2026-03-01
Scope: All Guide 1 and Guide 2 patterns for consistent reuse in Guide 3 (Onyx RAG Integration).

---

## 1. API Route Handler Pattern

### Files Analyzed
- src/app/api/health/route.ts
- src/app/api/auth/[...nextauth]/route.ts
- src/app/api/users/route.ts and users/[id]/route.ts
- src/app/api/content-map/route.ts and content-map/[id]/route.ts
- src/app/api/content-map/import/route.ts

### Entry Point to Data Flow

```
HTTP request arrives
  -> middleware (withAuth) blocks unauthenticated requests at the edge
  -> route handler: try { ... } catch (error) { ... }
  -> await requireRole(...) -- FIRST statement in try
  -> await request.json() -- read raw body
  -> SomeSchema.safeParse(body) -- Zod, never .parse()
  -> if (!parsed.success) return 400 VALIDATION_ERROR
  -> business logic (Prisma queries, lib function calls)
  -> return NextResponse.json({ success: true, data: ... })
  -> catch: classify error string -> 401 / 403 / 500
```

### Canonical Import Block

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";
```

Rules:
- NextRequest: only when handler reads request.json(). Unused request is prefixed _request.
- NextResponse: ALWAYS imported in every route file.
- prisma: always from @/lib/db -- never new PrismaClient() inside a route.
- requireRole: always from @/lib/auth/session.
- Zod schemas: INLINE at top of route file, NOT in a separate schema file.

### Zod Validation -- always .safeParse(), never .parse()

```ts
const parsed = SomeSchema.safeParse(body);
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
```

The details field ALWAYS carries parsed.error.flatten() on validation failures.

### Success Response Format

```ts
return NextResponse.json({ success: true, data: entries });                 // GET list
return NextResponse.json({ success: true, data: entry });                   // GET one, PATCH, DELETE
return NextResponse.json({ success: true, data: entry }, { status: 201 });  // POST create
```

Data is ALWAYS under the data key. Status 201 only for POST creates.

### Try/Catch Structure -- canonical, copy this exactly

```ts
export async function GET() {
  try {
    await requireRole("admin", "editor", "viewer");
    // ... business logic
    return NextResponse.json({ success: true, data: result });
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

Rules:
- Entire handler body is inside one try/catch.
- requireRole() is FIRST in try -- before reading body or running any logic.
- Catch order: AUTH_REQUIRED (401) -> AUTH_FORBIDDEN (403) -> INTERNAL_ERROR (500).
- Error extraction: const message = error instanceof Error ? error.message : "Unknown error"
  This EXACT line appears verbatim in every catch block across all 7 route files.
- No re-throwing. The catch block always returns a NextResponse.

### Dynamic Route Params (Next.js 15)

```ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // Promise required in Next.js 15
) {
  try {
    await requireRole("admin", "editor", "viewer");
    const { id } = await params;  // always await params before destructuring
  }
}
```

### Prisma Select Pattern

```ts
// Define at module scope -- reused by all handlers in the file:
const myModelSelect = {
  id: true, fieldA: true, createdAt: true, updatedAt: true,
};

const entries = await prisma.myModel.findMany({
  select: myModelSelect,
  orderBy: { createdAt: "desc" },
}); 
```

No findMany() or findUnique() without explicit select. Consistent across all 7 route files.
Route handlers call prisma.* DIRECTLY without retryDatabaseOperation.
retryDatabaseOperation is ONLY used in src/lib/auth/config.ts (the login flow).

---

## 2. Lib Module Pattern

### Directory Layout

```
src/lib/
  auth/config.ts       -- NextAuth authOptions config object
  auth/session.ts      -- requireAuth, requireRole, getCurrentUser, SessionUser type
  auth/password.ts     -- hashPassword, verifyPassword, validatePassword
  db/index.ts          -- Prisma singleton (globalForPrisma pattern)
  db/retry.ts          -- retryDatabaseOperation<T> with exponential backoff
  env.ts               -- central env accessor (optionalEnv pattern)
  onyx/client.ts       -- config stub -> Guide 3 replaces with real async client
  claude/client.ts     -- config stub
  cloudinary/client.ts -- config stub
  content-map/index.ts  -- barrel re-export (multi-file module example)
  content-map/import.ts -- parseCSV, mapCSVRow, importToDatabase, seedCorePages
  content-map/slug.ts   -- generateSlug, ensureUniqueSlug
```

### Service Config Stub Pattern (verbatim -- all three stubs share the same shape)

```ts
// src/lib/onyx/client.ts (current stub)
export const onyxConfig = {
  apiUrl: process.env.ONYX_API_URL || "",
  apiKey: process.env.ONYX_API_KEY || "",
};

// src/lib/claude/client.ts
export const claudeConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY || "",
  model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
};

// src/lib/cloudinary/client.ts
export const cloudinaryConfig = {
  url: process.env.CLOUDINARY_URL || "",
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "blog",
};
```

Guide 3 REPLACES src/lib/onyx/client.ts with a real module exporting async functions.
The config object shape can be kept as an internal const or folded into the new module.

### Prisma Singleton (verbatim)

```ts
// src/lib/db/index.ts
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query","error","warn"] : ["error"],
}); 
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Import in routes: import { prisma } from "@/lib/db"

### Retry Wrapper (verbatim -- model Guide 3 HTTP retry on this pattern)

```ts
// src/lib/db/retry.ts
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await operation(); }
    catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = lastError.message.includes("Connection refused") ||
        lastError.message.includes("Connection terminated") ||
        lastError.message.includes("ECONNRESET") ||
        lastError.message.includes("socket hang up") ||
        lastError.message.includes("Can't reach database server");
      if (!isRetryable || attempt === maxRetries) throw lastError;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
```

Create a similar HTTP fetch retry wrapper for Onyx calls in src/lib/onyx/client.ts.
Detect: ECONNRESET, ETIMEDOUT, ECONNREFUSED, and network fetch failures.

### Barrel Index Pattern

```ts
// src/lib/content-map/index.ts
export { generateSlug, ensureUniqueSlug } from "./slug";
export { parseCSV, mapCSVRow, importToDatabase, seedCorePages, CORE_PAGES } from "./import";
export type { ContentMapRow } from "./import";
```

Create src/lib/onyx/index.ts with the same barrel pattern once module has 2+ files.

---

## 3. Types Pattern

### Files Analyzed
- src/types/index.ts
- src/types/api.ts
- src/types/onyx.ts
- src/types/auth.ts, content-map.ts, article.ts, renderer.ts, qa.ts, claude.ts, photo.ts

### Index Re-Export Pattern (verbatim)

```ts
// src/types/index.ts -- wildcard re-export from every type file
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

Rule: every new type file must be added here with export *.
Do NOT add a named re-export here -- use wildcard only.

### ApiResponse and ErrorCode (verbatim from src/types/api.ts)

```ts
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

// Error codes (from orchestration doc S10)
export type ErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "GENERATION_FAILED"
  | "ONYX_UNAVAILABLE"   // already registered -- Guide 3 uses this code
  | "RENDER_ERROR"
  | "QA_GATE_FAILED"
  | "CLOUDINARY_ERROR"
  | "LINK_VERIFICATION_FAILED"
  | "INTERNAL_ERROR";
```

### Pre-Defined Onyx Types (verbatim from src/types/onyx.ts)

```ts
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

Rule: src/types/onyx.ts ALREADY EXISTS and defines the contracts Guide 3 must satisfy.
Do NOT redefine OnyxSearchResult, OnyxContext, or OnyxHealthStatus -- import from @/types.

---

## 4. Test Script Pattern

### Files Analyzed
- scripts/test-guide-1.ts
- scripts/test-guide-2.ts

### Canonical Structure

```ts
/**
 * Integration test for Guide N: <Name>
 *
 * Run with: npx tsx scripts/test-guide-N.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();  // direct instantiation -- NOT the singleton from @/lib/db

async function test() {
  let passed = 0;
  let failed = 0;

  function check(name: string, result: boolean, detail?: string) {
    if (result) {
      console.log('  PASS ' + name);
      passed++;
    } else {
      console.log('  FAIL ' + name + (detail ? ' -- ' + detail : '"'));
      failed++;
    }
  }
  console.log(NL + "=== Guide N Integration Tests ===" + NL);

  // --- Test 1: <Category> ------------------------------------------
  console.log("1. <test group label>");
  try {
    // ... DB or logic assertions ...
    check('<description>', <boolean expression>, '<detail>');
  } catch (e) {
    check('<description>', false, (e as Error).message);
  }

  // --- Test N: API endpoints (SKIP if server not running) -----------
  console.log("N. API endpoints");
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(appUrl + "/api/some-route");
    check("GET /api/some-route responds", res.status === 200 || res.status === 401);
  } catch {
    console.log("  SKIP API tests -- dev server not running");
  }

  // --- Summary -------------------------------------------------------
  console.log(NL + "=== Results: " + passed + " passed, " + failed + " failed ===" + NL);
  await prisma."$disconnect"();
  process.exit(failed > 0 ? 1 : 0);
}

test();
```

### Test Script Rules

1. Run via: npx tsx scripts/test-guide-N.ts
2. Direct PrismaClient instantiation -- never import the singleton from @/lib/db.
3. check() signature has THREE params since Guide 2: (name, result, detail?).
   Guide 1 used TWO params (no detail). Guide 3 must use the 3-param form.
4. API tests wrapped in try/catch with SKIP output (not FAIL) if server not running.
5. Accept 401 as valid for authenticated endpoints: res.status === 200 || res.status === 401.
6. Always call prisma."$disconnect"() at the end.
7. process.exit(failed > 0 ? 1 : 0) -- non-zero on any failure.
8. Group tests with numbered console.log headings.

### Guide 3 Test Script Must Cover

1. Onyx health endpoint reachable (GET /api/onyx/health returns 200)
2. Onyx search endpoint accepts a query (POST /api/onyx/search)
3. OnyxContext shape has correct fields (query, results[], totalResults, searchTimeMs)
4. Error handling: ONYX_UNAVAILABLE returned when Onyx is down

---

## 5. Error Handling Pattern

### Auth Error Flow

requireRole() throws plain Error objects with magic string messages.
These are NOT custom error classes -- just new Error("AUTH_REQUIRED").

```ts
// src/lib/auth/session.ts
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) throw new Error("AUTH_FORBIDDEN");
  return user;
}
```

### Error Catch Block (verbatim -- identical in all 7 route files)

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

### Guide 3 Error Codes

ONYX_UNAVAILABLE is pre-registered in src/types/api.ts ErrorCode union.
Use it when the Onyx service is unreachable or returns a non-2xx status.

```ts
// For Onyx-specific failures in /api/onyx/* routes:
return NextResponse.json(
  { success: false, error: { code: "ONYX_UNAVAILABLE", message } },
  { status: 503 }
);
```

Status mapping:
- 400: VALIDATION_ERROR
- 401: AUTH_REQUIRED
- 403: AUTH_FORBIDDEN
- 404: NOT_FOUND
- 503: ONYX_UNAVAILABLE (service dependency down)
- 500: INTERNAL_ERROR (all other errors)

### No Custom Error Classes

No custom error class hierarchy exists. All errors are plain Error objects.
Do NOT introduce custom error classes in Guide 3 -- throw new Error(string) only.

---

## 6. Environment Variables Pattern

### Onyx Variables (.env.example)

```
ONYX_BASE_URL=https://rmoss-onyx.xyz
ONYX_API_URL=https://rmoss-onyx.xyz/api
ONYX_API_KEY=your-onyx-api-key
ONYX_INDEX_NAME=default
ONYX_SEARCH_TIMEOUT_MS=10000
```

### Current Onyx Stub (src/lib/onyx/client.ts)

```ts
export const onyxConfig = {
  apiUrl: process.env.ONYX_API_URL || "",
  apiKey: process.env.ONYX_API_KEY || "",
};
```

The stub only reads ONYX_API_URL and ONYX_API_KEY.
Guide 3 must add ONYX_BASE_URL, ONYX_INDEX_NAME, ONYX_SEARCH_TIMEOUT_MS to the module.

### How to Read Env Vars

Two styles exist in the codebase:
- Direct: process.env.VARIABLE_NAME (used in service config stubs)
- Central: import { env } from "@/lib/env"; env.VARIABLE_NAME

env.ts ALREADY includes ONYX_API_URL and ONYX_API_KEY.
env.ts is MISSING: ONYX_BASE_URL, ONYX_INDEX_NAME, ONYX_SEARCH_TIMEOUT_MS.
Guide 3 should add these missing vars to env.ts.

### env.ts Current State (verbatim)

```ts
// src/lib/env.ts
function optionalEnv(name: string, defaultValue: string = ""): string {
  return process.env[name] || defaultValue;
}

export const env = {
  DATABASE_URL: optionalEnv('DATABASE_URL'),
  ANTHROPIC_API_KEY: optionalEnv('ANTHROPIC_API_KEY'),
  ANTHROPIC_MODEL: optionalEnv('ANTHROPIC_MODEL', 'claude-sonnet-4-5-20250929'),
  ONYX_API_URL: optionalEnv('ONYX_API_URL'),
  ONYX_API_KEY: optionalEnv('ONYX_API_KEY'),
  // TO ADD: ONYX_BASE_URL, ONYX_INDEX_NAME, ONYX_SEARCH_TIMEOUT_MS
  BWC_SITE_URL: optionalEnv('BWC_SITE_URL', 'https://www.bhutanwine.com'),
};
```

---

## 7. Middleware and Auth Pattern

### Middleware (verbatim from src/middleware.ts)

```ts
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    '/((?!login|api/auth|api/health|api/capture|_next|favicon.ico).*)',
  ],
};
```

Routes excluded from auth middleware:
- /login
- /api/auth/* (NextAuth internal)
- /api/health (public health check)
- /api/capture (public lead capture from Wix)
- /_next, /favicon.ico (static assets)

Guide 3 NEW ROUTES: /api/onyx/health and /api/onyx/search are AUTHENTICATED.
Do NOT add them to the middleware exclusion list.

### UserRole Type and Valid Roles

```ts
// src/lib/auth/session.ts
export type UserRole = "admin" | "editor" | "viewer";
```

Three roles exist: admin, editor, viewer.
Onyx search: allow all roles -> requireRole("admin", "editor", "viewer")
Onyx health: allow all roles -> requireRole("admin", "editor", "viewer")

### requireRole Usage Survey (all 7 existing routes)

- GET /api/health: NO auth (public)
- GET /api/users: requireRole("admin")
- POST /api/users: requireRole("admin")
- GET /api/users/[id]: requireRole("admin")
- PATCH /api/users/[id]: requireRole("admin")
- DELETE /api/users/[id]: requireRole("admin")
- GET /api/content-map: requireRole("admin", "editor", "viewer")
- POST /api/content-map: requireRole("admin", "editor")
- GET /api/content-map/[id]: requireRole("admin", "editor", "viewer")
- PATCH /api/content-map/[id]: requireRole("admin", "editor")  [note: leading empty-string arg bug]
- DELETE /api/content-map/[id]: requireRole("admin")
- POST /api/content-map/import: requireRole("admin")

---

## 8. Consistency Ratings

| Pattern | Rating | Notes |
|---------|--------|-------|
| API route import block | CONSISTENT | Identical across all 7 route files |
| Zod safeParse + VALIDATION_ERROR | CONSISTENT | Every route with a body uses this |
| Success response shape | CONSISTENT | No deviations found |
| Error catch block structure | CONSISTENT | Verbatim copy in all 7 files |
| requireRole as first try statement | CONSISTENT | Without exception |
| Prisma select (no bare findMany) | CONSISTENT | All queries use explicit select |
| Dynamic params as Promise (Next.js 15) | CONSISTENT | Both [id] routes await params |
| Barrel index for multi-file lib modules | CONSISTENT | content-map module follows it |
| check() 3-param signature in test scripts | DRIFT | Guide 1: 2 params, Guide 2: 3 params |
| env.ts as central accessor | DRIFT | Stubs use process.env directly |
| retryDatabaseOperation in routes | DRIFT | Only auth/config.ts uses it |

---

## 9. Inconsistencies Found

### 1. check() Signature Drift

test-guide-1.ts: check(name: string, result: boolean)
test-guide-2.ts: check(name: string, result: boolean, detail?: string)
Guide 3 MUST use the 3-param form.

### 2. env.ts Underused

src/lib/env.ts defines optionalEnv but service stubs read process.env directly.
Guide 3 should add missing Onyx vars to env.ts and import from there.

### 3. CLOUDINARY_UPLOAD_PRESET Missing from .env.example

src/lib/cloudinary/client.ts references this var but it is absent from .env.example.
Pre-existing bug. Do not fix in Guide 3.

### 4. retryDatabaseOperation Not Used in Routes

The retry wrapper is only used in auth/config.ts, not in any route handler.
Build a SEPARATE retryFetch wrapper for Onyx HTTP calls in src/lib/onyx/client.ts.
Model it on retryDatabaseOperation but target network error strings.

### 5. Extra Comma Bug in PATCH /api/content-map/[id]

requireRole call has a leading empty string: requireRole("", "admin", "editor")
Likely a typo. Does not break runtime. Do not replicate.

---

## 10. Anti-Patterns to Avoid in Guide 3

1. new PrismaClient() inside a route handler
   Always use: import { prisma } from "@/lib/db"

2. Zod .parse() instead of .safeParse()
   Bad: MySchema.parse(body) -- throws uncaught ZodError
   Good: MySchema.safeParse(body) then check parsed.success

3. requireRole() called after reading the request body
   Auth check MUST be the first statement in every try block

4. Re-throwing errors from catch blocks
   Catch always returns a NextResponse, never throws

5. Returning data without the success/data envelope
   Always: { success: true, data: ... }

6. status 200 for POST creates
   POST creates must return status 201

7. Skipping await on params in Next.js 15 dynamic routes
   const { id } = await params  (not: const { id } = params)

8. Importing types from specific type files instead of @/types
   Use: import { OnyxContext } from "@/types"

9. Introducing custom error classes
   Use plain: throw new Error("message")

---

## 11. Recommendations for Guide 3

### New Files to Create

| File | Purpose |
|------|---------|
| src/lib/onyx/client.ts | Replace stub with real async Onyx client |
| src/lib/onyx/index.ts | Barrel re-export (barrel pattern) |
| src/app/api/onyx/health/route.ts | Proxy Onyx health to frontend |
| src/app/api/onyx/search/route.ts | Accept query, call Onyx, return OnyxContext |
| scripts/test-guide-3.ts | Integration test for Guide 3 |

### Files to Modify

| File | Change |
|------|--------|
| src/lib/env.ts | Add ONYX_BASE_URL, ONYX_INDEX_NAME, ONYX_SEARCH_TIMEOUT_MS |

### Files to Leave Unchanged

- src/types/onyx.ts (OnyxSearchResult, OnyxContext, OnyxHealthStatus already defined)
- src/types/api.ts (ONYX_UNAVAILABLE already in ErrorCode union)
- src/middleware.ts (Onyx routes are authenticated -- no change needed)
- src/lib/auth/session.ts (requireRole pattern stays as-is)

### Canonical Onyx Route Template (follows all established patterns)

```ts
// src/app/api/onyx/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";
import { searchOnyx } from "@/lib/onyx";  // barrel index

const SearchSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(20).optional().default(5),
}); 

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor", "viewer");  // FIRST
    const body = await request.json();
    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    const context = await searchOnyx(parsed.data.query, parsed.data.maxResults);
    return NextResponse.json({ success: true, data: context });
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
    if (message === "ONYX_UNAVAILABLE") {
      return NextResponse.json(
        { success: false, error: { code: "ONYX_UNAVAILABLE", message } },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
```

---

## 12. File Reference Map

All files examined during this analysis:

### API Routes
- src/app/api/health/route.ts
- src/app/api/auth/[...nextauth]/route.ts
- src/app/api/users/route.ts
- src/app/api/users/[id]/route.ts
- src/app/api/content-map/route.ts
- src/app/api/content-map/[id]/route.ts
- src/app/api/content-map/import/route.ts

### Lib Modules
- src/lib/auth/config.ts
- src/lib/auth/session.ts
- src/lib/auth/password.ts
- src/lib/db/index.ts
- src/lib/db/retry.ts
- src/lib/env.ts
- src/lib/onyx/client.ts
- src/lib/claude/client.ts
- src/lib/cloudinary/client.ts
- src/lib/content-map/index.ts
- src/lib/content-map/import.ts
- src/lib/content-map/slug.ts

### Types
- src/types/index.ts
- src/types/api.ts
- src/types/onyx.ts
- src/types/auth.ts

### Infrastructure
- src/middleware.ts
- prisma/schema.prisma
- .env.example

### Test Scripts
- scripts/test-guide-1.ts
- scripts/test-guide-2.ts

### Generated Docs
- docs/_generated/api-routes.md
- docs/_generated/env-vars.md
- docs/_generated/prisma-models.md