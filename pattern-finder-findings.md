# Pattern Finder Findings -- Guide 2 Reference

Generated: 2026-03-01
Scope: All Guide 1 implementation patterns for consistent reuse in Guide 2.

---

## 1. API Route Handler Pattern

### Files Analyzed
- `src/app/api/health/route.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`

### Import Pattern (canonical)
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";
```

- `NextRequest` imported only when handler reads request body or params.
- `NextResponse` always imported.
- `prisma` always from `@/lib/db` -- never from `@prisma/client` directly.
- Auth helpers from `@/lib/auth/session`.
- Zod as `z` from `zod`; schemas inline in route file, NOT in a separate file.

### Auth Check Pattern
```ts
// Admin only:
await requireRole("admin");
// Any authenticated user:
await requireAuth();
// Multiple roles:
await requireRole("admin", "editor");
```

- Called at the TOP of the try block, before any other logic.
- `requireRole()` accepts variadic roles.
- Auth throws `new Error("AUTH_REQUIRED")` or `new Error("AUTH_FORBIDDEN")` -- caught in catch.

### Request Body Parsing Pattern
```ts
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
```

- Always `.safeParse()` not `.parse()`.
- Validation failure: HTTP 400 with `VALIDATION_ERROR` and `details: parsed.error.flatten()`.
- Destructure from `parsed.data` after the guard.

### URL Parameter Extraction Pattern (for [id] routes)
```ts
// Source: src/app/api/users/[id]/route.ts lines 15-21
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin");
    const { id } = await params;
```

- Second arg typed as `{ params: Promise<{ id: string }> }`.
- `params` is a Promise in Next.js 15 -- must be awaited.
- Prefix unused request arg with `_` when body is not read.

### Response Format (strict)
```ts
// Success GET/PATCH/DELETE -- HTTP 200
return NextResponse.json({ success: true, data: result });

// Success POST create -- HTTP 201
return NextResponse.json({ success: true, data: result }, { status: 201 });

// Validation error -- HTTP 400
return NextResponse.json(
  { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
  { status: 400 }
);

// Not found -- HTTP 404
return NextResponse.json(
  { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
  { status: 404 }
);

// Duplicate/conflict -- HTTP 409 (uses VALIDATION_ERROR, NOT a separate code)
return NextResponse.json(
  { success: false, error: { code: "VALIDATION_ERROR", message: "Email already registered" } },
  { status: 409 }
);
```

### Error Handling Pattern (catch block -- copy-identical across all routes)
```ts
// Source: src/app/api/users/route.ts lines 32-50
// IDENTICAL block in users/[id]/route.ts (lines 44-62, 105-123, 143-161)
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

- Copy-identical in `users/route.ts` and all handlers in `users/[id]/route.ts`.
- Auth errors detected by `error.message` string comparison -- NOT instanceof.
- No custom error classes -- plain `new Error("ERROR_CODE_STRING")`.

### Consistency Rating: HIGH

---

## 2. Prisma Usage Pattern

### Client Import
```ts
import { prisma } from "@/lib/db";
```

Always from `@/lib/db`. Exception: `prisma/seed.ts` uses local `new PrismaClient()` for seed only.

### Singleton Setup (`src/lib/db/index.ts`)
```ts
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

### Query Patterns
```ts
// findMany with select and orderBy
const users = await prisma.user.findMany({
  select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  orderBy: { createdAt: "desc" },
});

// findUnique
const user = await prisma.user.findUnique({
  where: { id: parseInt(id, 10) },
  select: { id: true, email: true, name: true, role: true, isActive: true, updatedAt: true },
});

// create with select
const user = await prisma.user.create({
  data: { email, name, passwordHash, role },
  select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
});

// update with select
const user = await prisma.user.update({
  where: { id: parseInt(id, 10) },
  data,
  select: { id: true, email: true, name: true, role: true, isActive: true, updatedAt: true },
});
```

- Always use `select` -- never return the full record.
- Integer IDs parsed with `parseInt(id, 10)`.
- Strings normalized with `.toLowerCase()` where appropriate.

### Retry Logic (`src/lib/db/retry.ts`)
```ts
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T>

// Usage (src/lib/auth/config.ts):
const user = await retryDatabaseOperation(() =>
  prisma.user.findUnique({ where: { email } })
);
```

- Used in `src/lib/auth/config.ts` for login query ONLY.
- NOT used in CRUD route handlers. Guide 2 CRUD routes should NOT use retry.
- Exponential backoff: `baseDelay * 2^attempt` (500ms, 1000ms, 2000ms).

### Prisma Error Handling
- Prisma errors fall through to generic `INTERNAL_ERROR` catch -- NOT separately caught.
- No `PrismaClientKnownRequestError` type checking in existing routes.
- Guide 2 may need to handle P2002 (unique constraint) for slug uniqueness explicitly.

### Consistency Rating: HIGH

---

## 3. Zod Validation Pattern

### Schema Definition Location
Schemas defined **inline in the route file** at the top, before handler functions. NOT in separate files.

```ts
// Naming: [Action][Resource]Schema (PascalCase)
// Source: src/app/api/users/route.ts lines 7-12
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

// Source: src/app/api/users/[id]/route.ts lines 7-12
const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});
```

### Validation Usage
```ts
const body = await request.json();
const parsed = CreateUserSchema.safeParse(body);

if (!parsed.success) {
  return NextResponse.json(
    { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
    { status: 400 }
  );
}
const { email, name } = parsed.data;
```

- `.safeParse()` only -- never `.parse()`.
- `parsed.error.flatten()` for structured field-level errors in `details`.
- `details` is ONLY present in `VALIDATION_ERROR` responses.

### Consistency Rating: HIGH

---

## 4. Type Import Pattern

### Types Directory Structure
```
src/types/
  index.ts          -- barrel re-export of all type files
  api.ts            -- ApiSuccess, ApiError, ApiResponse, ErrorCode
  auth.ts           -- UserRole, User
  content-map.ts    -- ArticleType, ArticleStatus, ContentMapEntry
  article.ts, renderer.ts, qa.ts, onyx.ts, claude.ts, photo.ts
  next-auth.d.ts    -- NextAuth session type augmentation
```

### Barrel Export (`src/types/index.ts`)
```ts
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

Every type file re-exported. New type files added in Guide 2 must be appended here.

### Type Import Pattern
```ts
import type { ContentMapEntry, ArticleStatus } from "@/types";
```

Use `import type` for type-only imports.

### Consistency Rating: MEDIUM
UserRole duplicated between src/types/auth.ts and src/lib/auth/session.ts (see Inconsistencies).

---

## 5. Seed Script Pattern

### File: `prisma/seed.ts`
```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "russell@bhutanwine.com").toLowerCase();
  const name = process.env.ADMIN_NAME || "Russell Moss";
  const password = process.env.ADMIN_PASSWORD || "changeme123";
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "admin", isActive: true },
    create: { email, name, passwordHash, role: "admin", isActive: true },
  });
  console.log("Admin seeded:", admin.email, "id:", admin.id);
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

- `new PrismaClient()` directly -- NOT the singleton from `@/lib/db`.
- Idempotency via `upsert` -- safe to run multiple times.
- Environment variable fallbacks for all seeded values.
- Single `main()` with `.catch().finally()` wrapper.
- `$disconnect()` in `finally` block.
- Guide 2 extends `main()` with ContentMap `upsert` calls after the admin block.

### Consistency Rating: HIGH

---

## 6. Auth Helper Pattern

### File: `src/lib/auth/session.ts` (full source)
```ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "./config";

export type UserRole = "admin" | "editor" | "viewer";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) { throw new Error("AUTH_REQUIRED"); }
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) { throw new Error("AUTH_FORBIDDEN"); }
  return user;
}
```

- `requireAuth()` throws `AUTH_REQUIRED` if not logged in.
- `requireRole(...roles)` calls `requireAuth()` first, then checks role membership.
- Errors are plain `new Error("ERROR_CODE_STRING")` -- the string IS the error code.

### File: `src/lib/auth/password.ts` (exports)
```ts
export async function hashPassword(password: string): Promise<string>
export async function verifyPassword(password: string, hash: string): Promise<boolean>
export function validatePassword(password: string): { valid: boolean; message?: string }
```

### Consistency Rating: HIGH

---

## 7. Middleware Pattern

### File: `src/middleware.ts` (full source)
```ts
import { withAuth } from "next-auth/middleware";

export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  matcher: ["/((?!login|api/auth|api/health|api/capture|_next|favicon.ico).*)"],
};
```

- Protects ALL routes except the explicit exclusion list.
- New `/api/content-map/` routes are automatically protected -- no changes needed.
- Role checking done per route with `requireRole()`, NOT in middleware.

### Consistency Rating: HIGH

---

## 8. Error Code Pattern

### File: `src/types/api.ts` (full source)
```ts
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown; };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

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

HTTP status mapping:
- 200: success (GET, PATCH, DELETE)
- 201: success (POST create)
- 400: `VALIDATION_ERROR`
- 401: `AUTH_REQUIRED`
- 403: `AUTH_FORBIDDEN`
- 404: `NOT_FOUND`
- 409: `VALIDATION_ERROR` (duplicate -- NOT a separate code)
- 500: `INTERNAL_ERROR`

`details` only set on `VALIDATION_ERROR` responses.

### Consistency Rating: HIGH

---

## 9. Prisma Schema Conventions

From `prisma/schema.prisma`:

```
Model naming:     PascalCase (User, ContentMap, ArticleDocument)
Table names:      snake_case via @@map() (users, content_map, article_documents)
Column names:     camelCase in Prisma, snake_case via @map()
Primary keys:     Int @id @default(autoincrement())
Timestamps:       createdAt DateTime @default(now()) @map("created_at")
                  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")
Soft booleans:    isActive Boolean @default(true) @map("is_active")
String enums:     String + comment // "val1" | "val2" (NO Prisma enum type)
Array fields:     String[] (Postgres array, no join table for string lists)
Self-relations:   Explicit @relation() with named string identifiers
```

---

## Inconsistencies Found

### 1. UserRole Type Duplication
- `src/types/auth.ts` line 1 and `src/lib/auth/session.ts` line 4 both define:
  `export type UserRole = "admin" | "editor" | "viewer";`
Guide 2 should import `UserRole` from `@/types`. Do NOT create new duplicates.

### 2. Retry Logic Inconsistency
- `src/lib/auth/config.ts` uses `retryDatabaseOperation()` for login query.
- `users/route.ts` and `users/[id]/route.ts` do NOT use retry.
Guide 2 CRUD routes should follow the CRUD pattern (no retry wrapper).

### 3. details Field (Intentional)
`ApiError` has `details?: unknown` but only `VALIDATION_ERROR` sets it.
This is intentional -- do not add `details` to other error types.

---

## Anti-Patterns to Avoid

1. Do NOT use `.parse()` -- use `.safeParse()` always.
2. Do NOT import `PrismaClient` in routes -- use `import { prisma } from "@/lib/db"`.
3. Do NOT return raw Prisma records -- always use `select`.
4. Do NOT put Zod schemas in separate files -- co-locate in the route file.
5. Do NOT add error codes without updating `ErrorCode` union in `src/types/api.ts`.
6. Do NOT forget to `await params` -- Next.js 15 route params are a Promise.
7. Do NOT re-throw errors in catch -- format them as API responses.
8. Do NOT use `instanceof` for auth errors -- compare `error.message` string.

---

## Recommendations for Guide 2

### Must Follow (High Confidence)
1. Route file: imports -> Zod schemas -> exported handlers with JSDoc comments.
2. `await requireRole("admin")` as first line inside try block.
3. Copy the exact 3-case catch block from `users/route.ts` -- it is canonical.
4. Response: `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`.
5. `[id]` route: `{ params }: { params: Promise<{ id: string }> }` with `const { id } = await params`.
6. Zod: `[Action][Resource]Schema` naming, `.safeParse()` always.
7. Prisma: `select` on every query.
8. Seed: Add `upsert` blocks after admin user block in `prisma/seed.ts`.

### Content Map Specific
- `ContentMap` model already in `prisma/schema.prisma` -- do NOT modify schema.
- `ContentMapEntry` interface in `src/types/content-map.ts` -- do not redefine.
- Slug field is `String? @unique` -- slug logic in `src/lib/content-map/`.
- `parentHubId` is self-referential FK -- validate parent before creating spokes.
- `status` defaults to `"planned"` -- use `.default("planned")` in Zod schema.
- Array fields (`supportingEntities`, `targetKeywords`) are Postgres arrays -- pass as JS arrays.

### For `import/route.ts` (CSV import)
- Follow the same route handler template as all other routes.
- CSV parsing logic in `src/lib/content-map/`, not inline in route.
- Per-row errors in `details` field with `VALIDATION_ERROR` code.
- Idempotent bulk insert via `createMany()` or loop of `upsert` calls.
- Slug generation from title in the lib module, not the route.

