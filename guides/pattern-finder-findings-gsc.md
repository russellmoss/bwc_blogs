# Pattern Finder Findings - GSC / SEO Intelligence Layer

**Investigation Date:** 2026-03-05
**Purpose:** Pattern reference for building the SEO Intelligence Layer guide.
Covers API route handler, dashboard navigation, Claude non-streaming calls,
Composer pre-loading, cron auth, Zustand store, and lib module patterns.

---

## 1. API Route Handler Pattern

### Key Files

- src/app/api/links/verify/route.ts (canonical template, most complete)
- src/app/api/articles/qa/fix/route.ts (non-streaming Claude call example)
- src/app/api/content-map/route.ts (GET + POST CRUD example)
- src/app/api/articles/[id]/route.ts (dynamic params, Next.js 15)
- src/app/api/photos/describe/route.ts (Claude JSON extraction pattern)

### Flow

HTTP request -> requireRole(...) -> request.json() -> Schema.safeParse(body)
-> business logic -> NextResponse.json({ success: true, data }) or error

### Auth Pattern (src/lib/auth/session.ts)

Auth is inline in every route handler — no middleware. requireRole throws a
string-message error that the catch block detects by string comparison.

```typescript
// src/lib/auth/session.ts
export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (\!roles.includes(user.role)) { throw new Error("AUTH_FORBIDDEN"); }
  return user;
}
```

Catch block pattern (identical across all routes):

```typescript
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

### Zod Validation Pattern

Always .safeParse(), never .parse(). On failure, return 400 with VALIDATION_ERROR
and parsed.error.flatten() as details.

```typescript
const RequestSchema = z.object({ urls: z.array(z.string().url()).min(1).max(50) });

const parsed = RequestSchema.safeParse(body);
if (\!parsed.success) {
  return NextResponse.json(
    { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
    { status: 400 }
  );
}
```

### Response Format (src/types/api.ts)

```typescript
export interface ApiSuccess<T> { success: true; data: T; }
export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown; };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type ErrorCode =
  | "AUTH_REQUIRED" | "AUTH_FORBIDDEN" | "VALIDATION_ERROR" | "NOT_FOUND"
  | "GENERATION_FAILED" | "ONYX_UNAVAILABLE" | "RENDER_ERROR" | "QA_GATE_FAILED"
  | "CLOUDINARY_ERROR" | "LINK_VERIFICATION_FAILED" | "FINALIZATION_FAILED"
  | "INTERNAL_ERROR";
```

### Prisma Pattern

Direct await prisma.model.method() is the default. withRetry wrapper from
src/lib/db/index.ts exists for Neon cold-start resilience but is not yet
consistently used. For cron routes use withRetry.

```typescript
// Direct (most common in existing routes)
const entries = await prisma.contentMap.findMany({
  select: contentMapSelect, orderBy: { createdAt: "desc" }
});

// With retry (recommended for new cron routes)
import { withRetry } from "@/lib/db";
const entries = await withRetry(() => prisma.contentMap.findMany(...));
```

### Dynamic Route Params (Next.js 15)

In Next.js 15 App Router, params is a Promise. Always await it:

```typescript
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const articleId = parseInt(id, 10);
```

### Complete Working Template (src/app/api/links/verify/route.ts)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const RequestSchema = z.object({ /* fields */ });

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (\!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    const result = {}; // business logic
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, { status: 401 });
    if (message === "AUTH_FORBIDDEN") return NextResponse.json({ success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required" } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
```

**Consistency Rating: HIGH.** All routes follow this exact structure.
