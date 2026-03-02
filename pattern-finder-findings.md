# Pattern Finder Findings - Guide 6: Split-Pane UI + Chat Mode

**Generated:** 2026-03-02  
**Scope:** Guides 1-5 (Foundation through Orchestration Layer)  
**Purpose:** Implementation reference for Guide 6 builders

---

## Pattern 1: API Route Handler Pattern

### Files Examined
- src/app/api/content-map/route.ts (GET + POST - canonical standard route)
- src/app/api/onyx/search/route.ts (POST - external service route)
- src/app/api/articles/generate/route.ts (POST - SSE streaming, special case)
- src/app/api/articles/render/route.ts (POST - library call route)

### Flow
HTTP request -> requireRole(...) -> request.json() -> Schema.safeParse(body) -> business logic -> NextResponse.json response

### Key Code Pattern (from content-map/route.ts lines 88-173)

    import { NextRequest, NextResponse } from "next/server";
    import { requireRole } from "@/lib/auth/session";
    import { z } from "zod";

    const CreateContentMapSchema = z.object({ hubName: z.string().min(1) });

    export async function POST(request: NextRequest) {
      try {
        await requireRole("admin", "editor");      // 1. Auth FIRST
        const body = await request.json();         // 2. Parse body
        const parsed = CreateContentMapSchema.safeParse(body); // 3. safeParse (never .parse)

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: { code: "VALIDATION_ERROR",
              message: "Invalid input", details: parsed.error.flatten() } },
            { status: 400 }
          );
        }

        const entry = await prisma.contentMap.create({ data: parsed.data });
        return NextResponse.json({ success: true, data: entry }, { status: 201 });

      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "AUTH_REQUIRED") {
          return NextResponse.json(
            { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
            { status: 401 });
        }
        if (message === "AUTH_FORBIDDEN") {
          return NextResponse.json(
            { success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required" } },
            { status: 403 });
        }
        return NextResponse.json(
          { success: false, error: { code: "INTERNAL_ERROR", message } },
          { status: 500 }
        );
      }
    }

### Rules (confirmed across all non-streaming routes)
1. requireRole() is ALWAYS the first statement inside try
2. Input: Schema.safeParse(body) - never .parse()
3. Validation failure: status 400, code VALIDATION_ERROR, details: parsed.error.flatten()
4. Auth errors caught by string comparison: AUTH_REQUIRED -> 401, AUTH_FORBIDDEN -> 403
5. Success: { success: true, data: ... }
6. Error: { success: false, error: { code, message } }
7. NextResponse.json() for all JSON (SSE route is the ONLY exception)
8. onyx/search adds ONYX_UNAVAILABLE catch (503) - not drift, correct for that service

### Consistency Rating: HIGH

---

## Pattern 2: SSE Streaming Pattern (CRITICAL for Guide 6)

### Files Examined
- src/app/api/articles/generate/route.ts - SSE server
- src/lib/orchestration/orchestrator.ts - event emission source
- src/types/claude.ts - SSE event type definitions

### SSE Wire Format
Every event sent as two lines followed by a blank line:
    event: <type>
    data: <JSON>
    [blank line]

Encoding function (generate/route.ts lines 25-27):
    function encodeSSE(event: StreamEvent): string {
      return "event: " + event.type + "
data: " + JSON.stringify(event.data) + "

";
    }

### Event Types and Data Shapes (src/types/claude.ts lines 61-73)

    type StreamEventType =
      | "status"      // data: { message: string }
      | "text_delta"  // data: { text: string } - raw Claude output delta
      | "web_search"  // data: { query: string }
      | "document"    // data: CanonicalArticleDocument (parsed, pre-validation)
      | "validation"  // data: ValidationResult { valid, errors, warnings }
      | "complete"    // data: GenerateArticleResponse (full result)
      | "error";      // data: { code: ErrorCode, message: string }

### Full Event Sequence (from orchestrator.ts generateArticle)
1.  status     - "Assembling system prompt..."
2.  status     - "System prompt assembled (N layers, ~N tokens)"
3.  status     - "Calling Claude API..."
4.  text_delta - streaming Claude output chunks (many deltas)
5.  web_search - if Claude triggers web search (zero or more)
6.  status     - "Claude response complete (N input, N output tokens)"
7.  status     - "Parsing response..."
8.  document   - parsed CanonicalArticleDocument (BEFORE repair/validation)
9.  status     - "Running validation and rendering..."
10. validation - ValidationResult with errors and warnings arrays
11. complete   - GenerateArticleResponse { document, html, validationResult, conversationReply, tokensUsed, webSearchResults }

On any error: single "error" event with { code, message }, then stream closes.

### Server-Side Stream Construction (generate/route.ts lines 62-90)

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          await generateArticle(generateRequest, (event: StreamEvent) => {
            controller.enqueue(encoder.encode(encodeSSE(event)));
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          const errorEvent: StreamEvent = {
            type: "error",
            data: { code: message === "GENERATION_FAILED" ? "GENERATION_FAILED" : "INTERNAL_ERROR", message },
          };
          controller.enqueue(encoder.encode(encodeSSE(errorEvent)));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",   // Required for Vercel/nginx buffering bypass
      },
    });

IMPORTANT: Must use new Response() NOT NextResponse. NextResponse.json() buffers responses and breaks SSE.
Pre-stream auth/validation errors use: new Response(JSON.stringify({...}), { headers: { "Content-Type": "application/json" } })

### Client-Side Consumption Pattern
Do NOT use EventSource - it only supports GET and cannot send POST with JSON body.

    const response = await fetch("/api/articles/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorData = await response.json(); // { success: false, error: { code, message } }
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("
");
      buffer = lines.pop() || "";  // Keep incomplete last line in buffer
      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) { eventType = line.slice(7); }
        else if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          handleEvent(eventType, data);
          eventType = "";
        }
      }
    }

    function handleEvent(type, data) {
      switch (type) {
        case "status":     // Show progress message in chat panel
        case "text_delta": // Optionally stream to debug view
        case "web_search": // Show searching indicator
        case "document":   // Update live preview - call renderArticle(data)
        case "validation": // Show validation errors
        case "complete":   // Final state - save doc and html, unlock UI
        case "error":      // Show error, unlock UI
      }
    }

### Consistency Rating: HIGH (single implementation, no drift possible)

---

## Pattern 3: Renderer Pipeline Pattern

### Files Examined
- src/lib/renderer/renderer.ts - main public function
- src/lib/renderer/index.ts - exports
- src/lib/renderer/components.ts - HTML component functions
- src/lib/renderer/cloudinary.ts - Cloudinary URL builder
- src/lib/renderer/css.ts - BWC_STYLESHEET constant
- src/lib/renderer/compiled-template.ts - STYLE_BLOCK, GOOGLE_FONTS_HTML, TEMPLATE_VERSION
- src/types/renderer.ts - RendererInput, RendererOutput, HtmlOverride

### Public API (from src/types/renderer.ts)

    // Types
    interface RendererInput {
      document: CanonicalArticleDocument;
      htmlOverrides: HtmlOverride[] | null;  // Canvas Edit overrides; null for normal render
      templateVersion: string;               // Always pass TEMPLATE_VERSION constant
    }

    interface RendererOutput {
      html: string;           // Complete self-contained <!DOCTYPE html> document
      metaTitle: string;
      metaDescription: string;
      schemaJson: string;     // JSON-LD markup blocks
      wordCount: number;      // Body word count (HTML tags stripped)
    }

    // Usage
    import { renderArticle, TEMPLATE_VERSION } from "@/lib/renderer";
    const result = renderArticle({
      document: canonicalDoc,
      htmlOverrides: null,
      templateVersion: TEMPLATE_VERSION,   // "2026.1"
    });
    // result.html = complete self-contained HTML ready for iframe srcDoc

### Renderer Flow (pure synchronous function - no async, no I/O)
1. repairCanonicalDocument(input.document) - auto-repair before rendering
2. buildSchemaJson(doc) - JSON-LD schema blocks
3. Loop doc.sections[] -> renderContentNode(node, cadPath) per content node
4. Assemble: renderHero(doc), renderHeroImage(doc), sections, renderFaq, renderAuthorBio, renderArticleFooter
5. Build full HTML: GOOGLE_FONTS_HTML + STYLE_BLOCK + schemaJson in <head>
6. Apply htmlOverrides if present (path-based via data-cad-path attribute matching)
7. Count words from body HTML (strips tags)

### Brand CSS Isolation for iframe Preview
Renderer output is a complete self-contained document with BWC CSS embedded via STYLE_BLOCK.
Guide 6 preview panel usage:

    <iframe
      srcDoc={rendererOutput.html}
      className="w-full h-full border-0"
      title="Article preview"
      sandbox="allow-same-origin"
    />

Dashboard Tailwind has ZERO impact on iframe content. No extra style injection needed.

### Compiled Template Constants (src/lib/renderer/compiled-template.ts)
- GOOGLE_FONTS_HTML  : preconnect + Google Fonts link for Cormorant Garamond, Fraunces, Nunito Sans, Trirong
- STYLE_BLOCK        : <style> tag containing the complete BWC_STYLESHEET
- TEMPLATE_VERSION   : "2026.1"

### data-cad-path Injection Pattern (for Canvas Edit mode)
  data-cad-path="title"
  data-cad-path="executiveSummary"
  data-cad-path="sections[0].heading"
  data-cad-path="sections[0].content[0].text"
  data-cad-path="faq[0].question" / "faq[0].answer"

### Cloudinary URL Pattern (src/lib/renderer/cloudinary.ts)
Pattern: https://res.cloudinary.com/{cloudName}/image/upload/w_{width},f_auto,q_auto/{publicId}
buildCloudinaryUrl("blog/{photoId}", { width: 1200 }) -> full CDN URL
Returns empty string if publicId is null or CLOUDINARY_CLOUD_NAME not set.

### Content Node to HTML Mapping (src/lib/renderer/components.ts)
  paragraph -> <p data-cad-path="...">
  image     -> <figure class="bwc-figure"><img ...></figure>
  pullQuote -> <blockquote class="bwc-pullquote">
  keyFacts  -> <aside class="bwc-key-facts">
  table     -> <table>
  list      -> <ul> or <ol>
  callout   -> <aside class="bwc-callout bwc-callout--{variant}">
  unknown   -> <!-- Unknown content node type -->

### Incremental/Partial Rendering
PURE SYNCHRONOUS function. No streaming or partial render API exists.
Requires complete (or auto-repaired) CanonicalArticleDocument.
The "document" SSE event delivers the full doc - call renderArticle() on it for live preview.

### Consistency Rating: HIGH

---

## Pattern 4: Auth Session Pattern

### Files Examined
- src/proxy.ts - middleware (renamed from middleware.ts in commit 45be677)
- src/lib/auth/session.ts - session helpers (requireRole, getCurrentUser)
- src/lib/auth/config.ts - NextAuth v4 configuration
- src/types/next-auth.d.ts - session type augmentation
- src/app/(auth)/login/page.tsx - client component with signIn usage

### Middleware (src/proxy.ts)

    import { withAuth } from "next-auth/middleware";
    export default withAuth({ pages: { signIn: "/login" } });
    export const config = {
      matcher: ["/((?!login|api/auth|api/health|api/capture|_next|favicon.ico).*)"],
    };

Protected: everything except /login, /api/auth/*, /api/health, /api/capture, static assets.

### Server-Side Auth in API Routes (PRIMARY pattern)

    import { requireRole } from "@/lib/auth/session";

    // In route handler - ALWAYS first:
    await requireRole("admin", "editor");   // Throws AUTH_REQUIRED or AUTH_FORBIDDEN

    // All helpers from src/lib/auth/session.ts:
    requireRole(...roles: UserRole[]): Promise<SessionUser>   // throws on failure
    getCurrentUser(): Promise<SessionUser | null>             // null if not authed
    requireAuth(): Promise<SessionUser>                       // throws AUTH_REQUIRED if no session

### Server Component Auth

    import { getCurrentUser } from "@/lib/auth/session";
    const user = await getCurrentUser();  // SessionUser | null

### Client Component Auth (from src/app/(auth)/login/page.tsx)

    "use client";
    import { signIn, signOut, useSession } from "next-auth/react";

    const { data: session } = useSession();
    // session.user: { id: string, email: string, name: string, role: string }

    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) { /* show error */ }

### Session Data Shape (src/lib/auth/session.ts)

    interface SessionUser {
      id: string;     // String(user.id) from DB
      email: string;
      name: string;
      role: "admin" | "editor" | "viewer";
    }

### CRITICAL: Missing SessionProvider in Root Layout
src/app/layout.tsx has NO SessionProvider from next-auth/react.
Client components calling useSession() will fail silently without it.
Guide 6 MUST create src/app/(dashboard)/layout.tsx:

    "use client";
    import { SessionProvider } from "next-auth/react";
    export default function DashboardLayout({ children }: { children: React.ReactNode }) {
      return <SessionProvider>{children}</SessionProvider>;
    }

### Auth Config Summary
- Provider: Credentials (email + bcryptjs password hash)
- Session: JWT strategy, 30-day maxAge
- JWT fields: id, role
- SignIn page: /login
- Secret: process.env.NEXTAUTH_SECRET

### Consistency Rating: HIGH (SessionProvider gap must be closed in Guide 6)

---

## Pattern 5: Type Import Pattern

### Convention
Import from specific module files using import type, NOT the barrel index:

    import type { CanonicalArticleDocument } from "@/types/article";
    import type { StreamEvent, GenerateArticleRequest, ConversationMessage } from "@/types/claude";
    import type { RendererInput, RendererOutput, HtmlOverride } from "@/types/renderer";
    import type { ValidationResult, ApiResponse, ErrorCode } from "@/types/api";
    import type { PhotoManifest } from "@/types/photo";
    import type { ArticleType } from "@/types/content-map";

The import type keyword is used consistently for type-only imports.
The barrel (src/types/index.ts) re-exports everything but is NOT used by implementation files.

### File to Type Mapping
| File | Key Types |
|---|---|
| @/types/article | CanonicalArticleDocument, ContentNode, ArticleSection, ImagePlacement, FAQItem, AuthorInfo, all ContentNode subtypes |
| @/types/claude | StreamEvent, StreamEventType, GenerateArticleRequest, ConversationMessage, GenerateArticleResponse |
| @/types/renderer | RendererInput, RendererOutput, HtmlOverride |
| @/types/api | ApiSuccess, ApiError, ApiResponse<T>, ValidationResult, ErrorCode |
| @/types/content-map | ArticleType, ContentMapEntry, ContentMapStatus |
| @/types/photo | PhotoManifest, CloudinaryTransform |
| @/types/onyx | Onyx search and result types |
| @/types/next-auth.d.ts | NextAuth module augmentation (Session.user.id, .role) |

### Zod Schema vs TypeScript Interface
Zod schemas: src/lib/article-schema/schema.ts
TypeScript interfaces: src/types/article.ts
SEPARATE parallel definitions - NOT derived with z.infer<>.
Zod = stricter validation. TS interfaces = type safety during construction.

### Consistency Rating: HIGH

---

## Pattern 6: Error Handling Pattern

### Typed Error Codes (src/types/api.ts lines 19-30)

    type ErrorCode =
      | "AUTH_REQUIRED"            // 401
      | "AUTH_FORBIDDEN"           // 403
      | "VALIDATION_ERROR"         // 400
      | "NOT_FOUND"               // 404
      | "GENERATION_FAILED"        // 500
      | "ONYX_UNAVAILABLE"         // 503
      | "RENDER_ERROR"             // 500
      | "QA_GATE_FAILED"           // 422
      | "CLOUDINARY_ERROR"         // 500
      | "LINK_VERIFICATION_FAILED" // 422
      | "INTERNAL_ERROR";          // 500 catch-all

### Error Response Shape
    { success: false, error: { code: ErrorCode, message: string, details?: unknown } }
    // details only for VALIDATION_ERROR (Zod flatten output)

### Error Throw Pattern in Library Code
Library functions throw new Error("ERROR_CODE_STRING") - NOT custom Error subclasses.
Routes catch and map string messages to HTTP status codes via if-chain.

    throw new Error("AUTH_REQUIRED");    // -> 401
    throw new Error("AUTH_FORBIDDEN");   // -> 403
    throw new Error("GENERATION_FAILED"); // -> 500
    throw new Error("ONYX_UNAVAILABLE");  // -> 503

### Frontend Error Handling

    const data = await response.json(); // ApiResponse<T>
    if (!data.success) {
      showError(data.error.message); // data.error.code is ErrorCode
      return;
    }
    // data.data is typed result

### Consistency Rating: HIGH

---

## Pattern 7: CSS/Styling Pattern

### Tailwind v4 (NOT v3)

    /* src/app/globals.css */
    @import "tailwindcss";   /* v4 syntax - NOT @tailwind base/components/utilities */

No tailwind.config.js exists. Tailwind v4 uses CSS-based config via @theme blocks.
PostCSS plugin: @tailwindcss/postcss (devDependency in package.json).
No component library installed (no shadcn, MUI, Radix, Headless UI).

### Existing Usage in Dashboard Pages
All existing pages use inline Tailwind utility classes with raw hex values for BWC brand colors:

    className="min-h-screen flex items-center justify-center bg-[#fcf8ed]"
    className="text-3xl font-serif text-[#bc9b5d] mb-4"

BWC brand CSS variables exist ONLY in src/lib/renderer/css.ts (BWC_STYLESHEET).
They are NOT in globals.css. Guide 6 can add them to @theme block or continue inline hex.

### Font Loading
Dashboard: Geist, Geist_Mono via next/font/google in src/app/layout.tsx
Preview: Cormorant Garamond, Fraunces, Nunito Sans, Trirong via GOOGLE_FONTS_HTML in renderer output

### iframe CSS Isolation Strategy
Renderer output is self-contained with embedded BWC CSS. Use srcDoc attribute:

    <iframe
      srcDoc={rendererOutput.html}
      className="w-full h-full border-0"
      title="Article preview"
      sandbox="allow-same-origin"
    />

Dashboard Tailwind has ZERO impact on iframe content. No extra style injection needed.

### Consistency Rating: MEDIUM (only stub dashboard pages exist to compare)

---

## Pattern 8: State Management Pattern

### Current State: No State Library Installed
package.json has no zustand, Redux, Jotai, or Recoil.
React 19 + hooks only. The only client component (login page) uses local useState:

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

### State Shape Guide 6 Will Need
All types already defined in @/types/:

    interface ArticleEditorState {
      document: CanonicalArticleDocument | null;    // @/types/article
      html: string;
      conversationHistory: ConversationMessage[];   // @/types/claude
      isStreaming: boolean;
      streamStatus: string;
      validationResult: ValidationResult | null;    // @/types/api
      currentArticleId: number | null;
      activeMode: "chat" | "canvas" | "html";
    }

### Recommended Approach for Guide 6
Zero-dependency: React Context + useReducer (no install needed, React 19 built-in).
Low-boilerplate: install zustand (TypeScript-native, minimal API).
Document the choice in CLAUDE.md under Conventions.

### Consistency Rating: N/A (Guide 6 sets the precedent)

---

## Inconsistencies Found

### 1. SSE Route Uses new Response() vs Standard NextResponse
File: src/app/api/articles/generate/route.ts
NOT a bug - required behavior. NextResponse.json() buffers the response body, breaking SSE.
The SSE route uses new Response(stream, { headers: {...} }).
Pre-stream errors: new Response(JSON.stringify({...}), { headers: { "Content-Type": "application/json" } })
Guide 6 must follow this exact pattern for any new SSE routes.

### 2. templateVersion Default Value Drift
File: src/app/api/articles/render/route.ts line 18
The Zod schema defaults templateVersion to "1.0".
The actual constant is TEMPLATE_VERSION = "2026.1" from src/lib/renderer/compiled-template.ts.
Any caller not passing templateVersion gets stale "1.0".
Guide 6 must always import and pass TEMPLATE_VERSION explicitly.

### 3. AUTH_FORBIDDEN Error Message Misleading
All routes return "Admin access required" for AUTH_FORBIDDEN even when editors are allowed.
Consistently wrong. Do not introduce a new variation.

---

## Anti-Patterns Found

### 1. Inline Hex Colors Instead of Design Tokens
Files: src/app/page.tsx, src/app/(dashboard)/page.tsx
Example: text-[#bc9b5d] hardcoded instead of CSS variable or Tailwind alias.
BWC brand tokens exist only in renderer CSS, not bridged to globals.css.
Guide 6 should add BWC tokens to globals.css @theme block OR continue inline hex consistently.
Do not mix both approaches in the same file.

### 2. No SessionProvider in Root Layout
File: src/app/layout.tsx
No SessionProvider from next-auth/react. Client components using useSession() will fail silently.
Guide 6 must add SessionProvider to the dashboard layout before any client component uses useSession().

---

## Recommendations for Guide 6

### Must Follow (exact patterns - no variation)
1. API route structure: Copy content-map/route.ts - requireRole first, safeParse, auth error catch blocks, response shape
2. SSE route: new Response() not NextResponse, X-Accel-Buffering: no, ReadableStream + TextEncoder
3. SSE consumption: Fetch API + ReadableStream + manual SSE line parsing. Never use EventSource for POST
4. Renderer: import TEMPLATE_VERSION from @/lib/renderer, always pass it explicitly. Never hardcode "1.0"
5. Type imports: import type { X } from "@/types/specific-file" - not from barrel index
6. Error shape: { success: false, error: { code: ErrorCode, message: string } } - no variation
7. Preview iframe: srcDoc={rendererOutput.html} - renderer output is self-contained
8. Server auth: getCurrentUser() from @/lib/auth/session
9. Client auth: useSession() from next-auth/react after SessionProvider is added

### Must Add (missing infrastructure)
1. SessionProvider: Create src/app/(dashboard)/layout.tsx wrapping children in SessionProvider
2. State management: Choose React Context + useReducer or install zustand. Document in CLAUDE.md
3. BWC tokens: Add --bwc-gold, --bwc-black etc. to globals.css @theme block for dashboard UI

---

## File Reference Summary

| Pattern | File |
|---|---|
| API route template | src/app/api/content-map/route.ts |
| SSE streaming server | src/app/api/articles/generate/route.ts |
| SSE event types | src/types/claude.ts |
| Generation pipeline events | src/lib/orchestration/orchestrator.ts |
| Renderer public API | src/lib/renderer/renderer.ts + index.ts |
| Renderer types | src/types/renderer.ts |
| Brand stylesheet | src/lib/renderer/css.ts (BWC_STYLESHEET) |
| Compiled template | src/lib/renderer/compiled-template.ts (STYLE_BLOCK, GOOGLE_FONTS_HTML, TEMPLATE_VERSION) |
| Auth middleware | src/proxy.ts |
| Auth session helpers | src/lib/auth/session.ts |
| Auth config | src/lib/auth/config.ts |
| Session type augmentation | src/types/next-auth.d.ts |
| Error codes | src/types/api.ts |
| Article document type | src/types/article.ts |
| Zod schemas | src/lib/article-schema/schema.ts |
| Validation logic | src/lib/article-schema/validate.ts |
| DB retry wrapper | src/lib/db/retry.ts |
| Tailwind config | src/app/globals.css + postcss.config.mjs |
| Client auth example | src/app/(auth)/login/page.tsx |
