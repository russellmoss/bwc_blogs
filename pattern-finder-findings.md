test write
### Validation Block (ALWAYS .safeParse(), never .parse())
```typescript
const body = await request.json();
const parsed = CreateContentMapSchema.safeParse(body);

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

### Success Response Format
```typescript
return NextResponse.json({ success: true, data: entry });                    // 200
return NextResponse.json({ success: true, data: entry }, { status: 201 }); // Created
```

### Error Response Format (catch block — identical across all 8 routes)
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

Domain-specific errors are added before INTERNAL_ERROR fallback (example from onyx/search/route.ts):
```typescript
if (message === "ONYX_UNAVAILABLE") {
  return NextResponse.json(
    { success: false, error: { code: "ONYX_UNAVAILABLE", message: "Knowledge base unavailable" } },
    { status: 503 }
  );
}
```

### Dynamic Route Params (Next.js 15 — params is a Promise)
```typescript
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;  // MUST await params in Next.js 15
```

**Consistency Rating: HIGH** — All 8 routes follow identical structure. No deviation found.

---
