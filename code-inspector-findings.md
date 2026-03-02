# Code Inspector Findings -- Guide 6

Inspection date: 2026-03-02
Purpose: Pre-implementation audit for Guide 6 (Split-Pane UI + Chat Mode)

---

## 1. TypeScript Types State

All 11 type files exist in src/types/ and are re-exported from src/types/index.ts.

src/types/api.ts          - ApiSuccess, ApiError, ApiResponse, ErrorCode, ValidationResult
src/types/article.ts      - CanonicalArticleDocument (22 fields) and all sub-types
src/types/auth.ts         - User, UserRole
src/types/claude.ts       - ConversationMessage, GenerateArticleRequest, GenerateArticleResponse,
                            StreamEvent, StreamEventType
src/types/content-map.ts  - ContentMapEntry (25 fields), ArticleType, ArticleStatus
src/types/index.ts        - re-exports all type files
src/types/next-auth.d.ts  - augments Session.user and JWT with id:string and role:string
src/types/onyx.ts         - Onyx RAG types
src/types/photo.ts        - Photo, PhotoManifest, CloudinaryTransform
src/types/qa.ts           - QACheck, QAResult, QAScore, CheckSeverity
src/types/renderer.ts     - HtmlOverride, RendererInput, RendererOutput

### IMPORTANT FINDING: GenerateArticleRequest and GenerateArticleResponse
These API-critical types are NOT in src/types/api.ts -- they are in src/types/claude.ts.

### src/types/claude.ts (lines 1-74) -- CRITICAL FOR GUIDE 6

ConversationMessage:
  role: user | assistant
  content: string
  timestamp: string

GenerateArticleRequest (API route request body):
  articleId: number
  userMessage: string
  conversationHistory: ConversationMessage[]
  currentDocument: CanonicalArticleDocument | null
  photoManifest: PhotoManifest | null

GenerateArticleResponse (shape of data in the complete SSE event):
  document: CanonicalArticleDocument
  html: string
  validationResult: ValidationResult
  conversationReply: string
  tokensUsed: { input: number; output: number }
  webSearchResults: WebSearchResult[]

StreamEventType union: status | text_delta | web_search | document | validation | complete | error
StreamEvent: { type: StreamEventType; data: unknown }

### src/types/article.ts (lines 1-169)

CanonicalArticleDocument -- 22 top-level fields:
  version: string                     // schema version e.g. 1.0
  articleId: number                   // FK to content_map.id
  slug: string
  articleType: hub | spoke | news
  hubId: number | null
  title: string
  metaTitle: string
  metaDescription: string
  canonicalUrl: string
  publishDate: string                 // ISO 8601
  modifiedDate: string                // ISO 8601
  author: AuthorInfo { name, credentials, bio, linkedinUrl }
  executiveSummary: string
  heroImage: ImagePlacement | null
  sections: ArticleSection[]          // { id, heading, headingLevel:2|3, content:ContentNode[] }
  faq: FAQItem[]                      // { question, answer }
  internalLinks: InternalLinkRef[]
  externalLinks: ExternalLinkRef[]
  ctaType: CaptureType
  captureComponents: CaptureType[]
  schema: SchemaFlags                 // { blogPosting, faqPage, product }
  dataNosnippetSections: string[]

ContentNode union (7 variants): paragraph | image | pullQuote | keyFacts | table | list | callout

### src/types/renderer.ts (lines 1-21)

RendererInput:  { document: CanonicalArticleDocument; htmlOverrides: HtmlOverride[]|null; templateVersion: string }
RendererOutput: { html: string; metaTitle; metaDescription; schemaJson; wordCount: number }
HtmlOverride:   { path: string; html: string; reason: string }

### src/types/content-map.ts (lines 1-47)

ContentMapEntry -- 25 fields: id, hubName, articleType, title, slug, mainEntity,
supportingEntities[], targetKeywords[], searchVolumeEst, keywordDifficulty, targetAudience,
status, scheduledDate, publishedDate, publishedUrl, parentHubId, contentNotes,
suggestedExternalLinks[], internalLinksTo[], wordCount, qaScore, authorName, source, createdAt, updatedAt

DATE FIELDS ISSUE: scheduledDate and publishedDate are typed as Date|null in TypeScript,
but the API returns them as ISO strings (JSON serialization).
ArticleSelector component must treat them as string|null, not Date|null.

### src/types/auth.ts (lines 1-11)

UserRole: admin | editor | viewer
User: { id: number; email; name; role: UserRole; isActive; createdAt; updatedAt }
SessionUser (src/lib/auth/session.ts): { id: string; email; name; role: UserRole }
  IMPORTANT: User.id is number (DB), SessionUser.id is string (JWT token).

### MISSING: No UI state types defined anywhere for Guide 6

No AppState, PreviewMode, or Zustand store interface types exist.
Guide 6 should create src/types/ui.ts with these types.

---

## 2. API Routes State

13 route files in src/app/api/:

Route                      | Methods            | Purpose
---------------------------|--------------------|-----------------------------------------
/api/health                | GET                | Health check (public, exempt from auth)
/api/auth/[...nextauth]    | GET, POST          | NextAuth v4 handler
/api/users                 | GET, POST          | User list and create
/api/users/[id]            | GET, PATCH, DELETE | User CRUD
/api/content-map           | GET, POST          | Content map list and create
/api/content-map/[id]      | GET, PATCH, DELETE | Single entry CRUD
/api/content-map/import    | POST               | CSV import
/api/onyx/health           | GET                | Onyx RAG health check
/api/onyx/search           | POST               | Onyx semantic search
/api/articles/render       | POST               | Render CanonicalArticleDocument to HTML
/api/articles/validate     | POST               | Validate and optionally repair doc
/api/articles/generate     | POST (SSE)         | Generate article with real-time streaming
/api/links/verify          | POST               | Link verification

### /api/articles/generate -- SSE Format (CRITICAL FOR GUIDE 6)

File: src/app/api/articles/generate/route.ts
Method: POST
Auth: requireRole(admin, editor)

Request body (Zod-validated, lines 7-23):
  articleId: number (positive int, required)
  userMessage: string (1-10000 chars, required)
  conversationHistory: ConversationMessage[] (default [])
  currentDocument: record|null (default null)
  photoManifest: {photos,heroPhotoId,totalAvailable}|null (default null)

Response headers:
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive
  X-Accel-Buffering: no

SSE wire format (encodeSSE at line 25):
  event: {type}

  data: {JSON.stringify(event.data)}



SSE event sequence during generation:
  1.  status     { message: Assembling system prompt... }
  2.  status     { message: System prompt assembled (N layers, ~N tokens) }
  3.  status     { message: Calling Claude API... }
  4.  text_delta { text: partial text }    [MANY events, real-time Claude output]
  5.  web_search { query: search query }  [0 or more if ENABLE_WEB_SEARCH=true]
  6.  status     { message: Claude response complete (N input, N output tokens) }
  7.  status     { message: Parsing response... }
  8.  document   { ...CanonicalArticleDocument }   [raw parsed doc before repair]
  9.  status     { message: Running validation and rendering... }
  10. validation { valid: bool, errors: [...], warnings: [...] }
  11. complete   { document, html, validationResult, conversationReply, tokensUsed, webSearchResults }

Error event (any time): { code: GENERATION_FAILED|INTERNAL_ERROR, message: string }

Pre-stream auth failures (before stream opens, returned as JSON):
  401: { success: false, error: { code: AUTH_REQUIRED, message: Authentication required } }
  403: { success: false, error: { code: AUTH_FORBIDDEN, message: Admin access required } }
  Client must check response.ok before consuming SSE stream.

### /api/articles/render

POST { document, htmlOverrides: HtmlOverride[]|null, templateVersion: string }
200: { success: true, data: { html, metaTitle, metaDescription, schemaJson, wordCount } }

### /api/articles/validate

POST { document, repair: boolean }
Without repair: { success: true, data: ValidationResult }
With repair:    { success: true, data: { ...ValidationResult, repaired, changes, validBeforeRepair } }

### /api/content-map GET

{ success: true, data: ContentMapEntry[] }  ordered by createdAt desc
All 25 ContentMapEntry fields returned.
Used by ArticleSelector dropdown -- fetch on component mount.

### MISSING Routes

No /api/articles/[id]/save route exists.
Articles stay in client state only during Guide 6 draft mode.
Persistence to ArticleDocument+ArticleHtml tables is Guide 7+ scope.

---

## 3. Library Modules State

### src/lib/orchestration/

Entry: generateArticle(request: GenerateArticleRequest, onEvent?: StreamCallback)
  File: src/lib/orchestration/orchestrator.ts (lines 1-86)
  Returns: Promise<GenerateArticleResponse>
  Called by: /api/articles/generate/route.ts

5-step pipeline:
  1. assembleSystemPrompt(articleId, photoManifest) -- 7-layer prompt
  2. buildMessages(request) -- conversation history + optional currentDocument context
  3. streamGeneration(systemPrompt, messages, callbacks) -- Claude API real-time stream
  4. parseGenerationResponse(rawText) -- extract JSON (3 fallback strategies)
  5. runPostProcessing(doc) -- repair + validate + renderArticle

StreamCallback type: (event: StreamEvent) => void

Exports (src/lib/orchestration/index.ts):
  generateArticle, StreamCallback
  buildMessages
  parseGenerationResponse, ParseResult
  runPostProcessing, PostProcessingResult

### src/lib/renderer/

renderArticle(input: RendererInput): RendererOutput
  File: src/lib/renderer/renderer.ts (lines 1-128)
  PURE FUNCTION -- no DB, no API, no side effects.
  Called by runPostProcessing and /api/articles/render.

Output is a COMPLETE standalone HTML document:
  <!DOCTYPE html><html lang=en><head>
    {GOOGLE_FONTS_HTML} -- preconnect + 4 font family links
    {STYLE_BLOCK}       -- full BWC_STYLESHEET (363 lines) embedded in <style>
    {JSON-LD schema blocks}
  </head><body><article class=bwc-article>...</article></body></html>

TEMPLATE_VERSION: 2026.1

CSS scope: article, .bwc-article, .blog-content, bwc-* BEM classes.
These are scoped to the article element and WILL NOT leak into the dashboard
Tailwind UI when rendered inside an iframe.

Exports (src/lib/renderer/index.ts):
  renderArticle, buildCloudinaryUrl, buildSchemaJson
  BWC_STYLESHEET, GOOGLE_FONTS_HTML, STYLE_BLOCK, TEMPLATE_VERSION

### src/lib/claude/

streamGeneration(systemPrompt, messages, callbacks): Promise<ClaudeStreamResult>
  File: src/lib/claude/streaming.ts
  Uses Anthropic SDK messages.stream().
  Real-time callbacks: onTextDelta(text), onWebSearch(query), onError(error)

getModelId(): returns env.ANTHROPIC_MODEL  (default: claude-sonnet-4-5-20250929)
getMaxOutputTokens(): returns parsed ANTHROPIC_MAX_OUTPUT_TOKENS  (default: 16384)

Exports (src/lib/claude/index.ts):
  getClaudeClient, getModelId, getMaxOutputTokens
  getGenerationTools
  streamGeneration, ClaudeStreamCallbacks, ClaudeStreamResult

### src/lib/auth/session.ts -- SERVER-SIDE ONLY

All functions call next-auth/next getServerSession.

getSession()                          -- returns raw NextAuth session
getCurrentUser(): Promise<SessionUser|null>
requireAuth(): Promise<SessionUser>        -- throws AUTH_REQUIRED if no session
requireRole(...roles): Promise<SessionUser> -- throws AUTH_FORBIDDEN if wrong role

SessionUser: { id: string; email: string; name: string; role: UserRole }
  id is STRING (from JWT), not number (from DB).

For server components/layouts: use getSession()
For client components needing session: use useSession() from next-auth/react

### src/lib/article-schema/

validateCanonicalDocument(doc) -- returns ValidationResult
repairCanonicalDocument(doc)   -- returns { repaired, changes, valid }
All Zod schemas exported from index.ts for potential reuse.

---

## 4. Dashboard Layout State

### src/app/(dashboard)/page.tsx -- PLACEHOLDER ONLY

Current content is a 10-line placeholder with centered Coming soon text.
Guide 6 REPLACES this entirely with the split-pane chat interface.

### src/app/(dashboard)/layout.tsx -- DOES NOT EXIST (CRITICAL GAP)

The (dashboard) route group has NO layout file. Only page.tsx exists.
Guide 6 must CREATE this file.

This layout must:
  1. Call getSession() and redirect to /login if no session (belt-and-suspenders)
  2. Wrap children with SessionProvider from next-auth/react if any client
     components need useSession()
  3. Set page metadata (title: BWC Content Engine)

### src/app/layout.tsx -- Root Layout

Uses Geist Sans + Geist Mono from next/font/google.
Imports globals.css. Applies antialiased class to body.
Metadata: Create Next App title -- should be updated in Guide 6.

---

## 5. Components State

src/components/ DIRECTORY DOES NOT EXIST.
Zero component files in the project. All must be created by Guide 6.

Required chat components (create src/components/chat/):
  ChatPanel.tsx         -- left pane container, owns generation state, SSE consumer
  MessageList.tsx       -- scrollable message history, auto-scroll on new messages
  MessageInput.tsx      -- textarea + send button, disabled while isGenerating=true
  StreamingMessage.tsx  -- real-time streaming text with typing cursor indicator

Required preview components (create src/components/preview/):
  PreviewPanel.tsx      -- right pane container, receives html prop
  PreviewIframe.tsx     -- <iframe srcDoc={html}>, full HTML document injection
  PreviewToolbar.tsx    -- toggle preview|html mode, copy HTML button
  HtmlSourceView.tsx    -- pre/code display of raw HTML source

Required layout components (create src/components/layout/):
  SplitPane.tsx         -- react-resizable-panels wrapper, 50/50 default split
  AppShell.tsx          -- header with logo/title + article selector
  ArticleSelector.tsx   -- dropdown populated from GET /api/content-map

---

## 6. Middleware State

LOCATION: src/proxy.ts -- NOT src/middleware.ts

Content (src/proxy.ts, lines 1-21):
  import { withAuth } from next-auth/middleware
  export default withAuth({ pages: { signIn: /login } })
  export const config = {
    matcher: [/((?!login|api/auth|api/health|api/capture|_next|favicon.ico).*)]
  }

CRITICAL: Next.js requires middleware at src/middleware.ts or middleware.ts at project root.
src/proxy.ts WILL NOT be recognized as Next.js middleware by the framework.

Git commit says: chore: rename middleware to proxy and stabilize build
This intentional rename likely means the (dashboard) routes are UNPROTECTED
by Next.js middleware at runtime.

ACTION FOR GUIDE 6:
  - Test unauthenticated browser access to / to confirm whether protection works
  - ALWAYS include getSession() + redirect() in (dashboard)/layout.tsx
    as the primary auth guard regardless of middleware status

---

## 7. Package Dependencies

From package.json at project root:

INSTALLED:
  next: 16.1.6
  react: 19.2.3          React 19, use() hook available, concurrent features
  react-dom: 19.2.3
  next-auth: ^4.24.13    NextAuth v4, NOT v5/Auth.js -- different API
  @anthropic-ai/sdk: ^0.78.0
  @prisma/client: ^6.19.2
  zod: ^4.3.6
  bcryptjs: ^3.0.3
  papaparse: ^5.5.3
  tailwindcss: ^4         Tailwind v4, CSS-based config, no tailwind.config.ts needed
  typescript: ^5
  eslint: ^9

MISSING -- REQUIRED before Guide 6 coding begins:
  react-resizable-panels  -- split pane resize functionality (SplitPane component)
  lucide-react            -- icon library (send, copy, eye, code, undo, check icons)
  zustand                 -- client state (chat history, document, undo stack)

Install command:
  npm install react-resizable-panels lucide-react zustand

---

## 8. CSS Strategy

### Dashboard UI -- Tailwind v4

src/app/globals.css (27 lines, Create Next App default):
  Line 1:     @import tailwindcss  (Tailwind v4 syntax)
  Lines 3-6:  :root { --background: #ffffff; --foreground: #171717 }
  Lines 8-13: @theme inline { maps CSS vars to Tailwind token system }
  Lines 21-26: body { background, color, font-family: Arial }

No tailwind.config.ts -- Tailwind v4 uses CSS-based configuration.
Guide 6 should update globals.css with dashboard-appropriate base styles.

### Blog Article Preview -- Iframe Isolation

src/lib/renderer/compiled-template.ts:
  GOOGLE_FONTS_HTML  -- preconnect + links for Cormorant Garamond, Fraunces,
                        Nunito Sans, Trirong (4 font families)
  STYLE_BLOCK        -- full BWC_STYLESHEET (363 lines) as <style> tag
  TEMPLATE_VERSION   -- 2026.1

src/lib/renderer/css.ts -- BWC_STYLESHEET includes:
  All --bwc-* CSS custom properties (colors, spacing)
  .bwc-article max-width 980px, .blog-content max-width 760px
  article h1 -- Cormorant Garamond 600, 48px, #bc9b5d (gold)
  article h2 -- Fraunces 400, 36px, #242323
  article h3 -- Cormorant Garamond 600, 28px, #000000
  article p/li -- Nunito Sans 300, 16px/1.7
  BEM: bwc-pullquote, bwc-key-facts, bwc-callout, bwc-faq, bwc-author-bio, bwc-figure
  Mobile @media max-width 768px breakpoint

IFRAME STRATEGY:
  <iframe
    srcDoc={currentHtml}
    sandbox=allow-same-origin allow-scripts
    style={{ width: 100%, height: 100%, border: none }}
    title=Article Preview
  />

allow-same-origin is required for Google Fonts CDN requests to load.
BWC CSS selectors are scoped to article/.bwc-article and CANNOT leak
into the dashboard Tailwind UI because the iframe is a separate document.

---

## 9. External Service Configuration

All 20 env vars defined in src/lib/env.ts with optionalEnv() helper:

Variable                     Default                          Used By
DATABASE_URL                 (empty)                          Prisma pooled connection
DIRECT_URL                   (empty)                          Prisma direct connection
AUTH_SECRET                  (empty)                          NextAuth JWT signing
AUTH_URL                     http://localhost:3000             NextAuth callbacks
ADMIN_EMAIL                  (empty)                          Seed script only
ANTHROPIC_API_KEY            (empty)                          Claude API client
ANTHROPIC_MODEL              claude-sonnet-4-5-20250929       Claude client
ANTHROPIC_MAX_OUTPUT_TOKENS  16384                            Claude client
ANTHROPIC_SMALL_MODEL        claude-sonnet-4-5-20250929       Available, not yet used
ONYX_API_URL                 (empty)                          Onyx client
ONYX_API_KEY                 (empty)                          Onyx client
ONYX_BASE_URL                (empty)                          Onyx client
ONYX_INDEX_NAME              default                          Onyx client
ONYX_SEARCH_TIMEOUT_MS       10000                            Onyx client
CLOUDINARY_URL               (empty)                          Cloudinary client
CLOUDINARY_CLOUD_NAME        (empty)                          Cloudinary client
CLOUDINARY_UPLOAD_PRESET     blog                             Cloudinary client
ENABLE_WEB_SEARCH            true                             Claude tools
BWC_SITE_URL                 https://www.bhutanwine.com       Prompt assembly
NEXTAUTH_SECRET              (empty)                          NextAuth (same as AUTH_SECRET)

Note: prisma/schema.prisma uses DATABASE_URL_UNPOOLED as directUrl.
src/lib/env.ts defines DIRECT_URL (not DATABASE_URL_UNPOOLED).
Prisma reads env vars directly, so .env should set DATABASE_URL_UNPOOLED explicitly.

---

## 10. Prisma Schema Summary

File: prisma/schema.prisma
Provider: postgresql (Neon Postgres)
9 models:

Model             Table               Key Fields
User              users               id, email, name, role, isActive, passwordHash
ContentMap        content_map         id, title, articleType, status, slug, parentHubId
ArticleDocument   article_documents   id, articleId, version, canonicalDoc:Json, htmlOverrides:Json
ArticleHtml       article_html        id, articleId, version, htmlContent, metaTitle, schemaJson, qaScore
InternalLink      internal_links      sourceArticleId, targetArticleId, targetCorePage, anchorText
Photo             photos              id, cloudinaryPublicId, cloudinaryUrl, altText, classification
ArticlePhoto      article_photos      articleId+photoId composite PK, position
Lead              leads               id, email, captureType, sourceArticleId
LeadEvent         lead_events         id, leadId, eventType, eventData:Json

For Guide 6:
  ContentMap -- data source for ArticleSelector dropdown (GET /api/content-map)
  ArticleDocument + ArticleHtml -- finalization targets, Guide 7+ scope

---

## 11. Gaps vs. Guide 6 Requirements

A. FILES TO CREATE (all new -- src/components/ directory is absent)

  src/app/(dashboard)/layout.tsx           MISSING -- must create
  src/components/layout/AppShell.tsx       MISSING
  src/components/layout/SplitPane.tsx      MISSING
  src/components/layout/ArticleSelector.tsx MISSING
  src/components/chat/ChatPanel.tsx        MISSING
  src/components/chat/MessageList.tsx      MISSING
  src/components/chat/MessageInput.tsx     MISSING
  src/components/chat/StreamingMessage.tsx MISSING
  src/components/preview/PreviewPanel.tsx  MISSING
  src/components/preview/PreviewIframe.tsx MISSING
  src/components/preview/PreviewToolbar.tsx MISSING
  src/components/preview/HtmlSourceView.tsx MISSING

B. PACKAGES TO INSTALL BEFORE CODING

  npm install react-resizable-panels lucide-react zustand
  All three are absent from package.json

C. TYPE ADDITIONS NEEDED

  Suggested new file: src/types/ui.ts

  type PreviewMode = preview | html

  interface ArticleStore (Zustand store shape):
    selectedArticleId: number | null
    selectedArticle: ContentMapEntry | null
    conversationHistory: ConversationMessage[]
    isGenerating: boolean
    streamingText: string
    statusMessage: string
    currentDocument: CanonicalArticleDocument | null
    currentHtml: string
    validationResult: ValidationResult | null
    undoStack: CanonicalArticleDocument[]
    previewMode: PreviewMode

D. MIDDLEWARE VERIFICATION NEEDED

  src/proxy.ts is NOT recognized by Next.js as middleware.
  The (dashboard)/layout.tsx MUST include getSession() + redirect() as safety net.
  Do NOT rely on middleware alone for auth protection in Guide 6.

E. DATE FIELD MISMATCH IN ContentMapEntry

  TypeScript type: scheduledDate: Date|null, publishedDate: Date|null
  API returns: ISO strings (JSON serialization)
  ArticleSelector must handle string|null for these fields.

---

## 12. SSE Parsing Pattern for Guide 6

EventSource API CANNOT be used because /api/articles/generate requires POST.
Use fetch() + ReadableStream + TextDecoder instead.

Recommended async generator pattern:

  async function* readSSEStream(response: Response) {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("

");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const lines = part.split("
");
        let eventType = "", data = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) eventType = line.slice(7);
          if (line.startsWith("data: ")) data = line.slice(6);
        }
        if (eventType && data) {
          yield { type: eventType, data: JSON.parse(data) };
        }
      }
    }
  }

Event handling in ChatPanel:
  status:     setStatusMessage(data.message)
  text_delta: appendStreamingText(data.text)  -- append into streaming bubble
  web_search: show searching indicator with data.query
  document:   intermediate doc, can ignore or show progress indicator
  validation: store.setValidationResult(data)
  complete:   extract { document, html, conversationReply } from data
              push user + assistant ConversationMessages to history
              call store.setDocument(data.document, data.html)
              clear streamingText, set isGenerating = false
  error:      add error assistant message to history
              set isGenerating = false

---

## 13. Summary -- Exists vs. Missing

Item                                       Status      Location
CanonicalArticleDocument type             EXISTS      src/types/article.ts
ConversationMessage type                  EXISTS      src/types/claude.ts
GenerateArticleRequest type               EXISTS      src/types/claude.ts
GenerateArticleResponse type              EXISTS      src/types/claude.ts
StreamEvent / StreamEventType             EXISTS      src/types/claude.ts
ContentMapEntry type (25 fields)          EXISTS      src/types/content-map.ts
RendererOutput / RendererInput            EXISTS      src/types/renderer.ts
ValidationResult                          EXISTS      src/types/api.ts
QAScore / QAResult                        EXISTS      src/types/qa.ts
/api/articles/generate (SSE, POST)         EXISTS      src/app/api/articles/generate/route.ts
/api/articles/render (POST)                EXISTS      src/app/api/articles/render/route.ts
/api/articles/validate (POST)              EXISTS      src/app/api/articles/validate/route.ts
/api/content-map GET                       EXISTS      src/app/api/content-map/route.ts
renderArticle() pure function             EXISTS      src/lib/renderer/renderer.ts
BWC_STYLESHEET + STYLE_BLOCK              EXISTS      src/lib/renderer/compiled-template.ts
generateArticle() orchestrator            EXISTS      src/lib/orchestration/orchestrator.ts
getSession() / requireRole()              EXISTS      src/lib/auth/session.ts
authOptions config                        EXISTS      src/lib/auth/config.ts
src/app/(dashboard)/layout.tsx            MISSING     Must create
src/components/ directory (all files)     MISSING     Must create entire tree (11 files)
react-resizable-panels                    MISSING     Not in package.json
lucide-react                              MISSING     Not in package.json
zustand                                   MISSING     Not in package.json
AppState / PreviewMode type defs          MISSING     No type definitions yet
/api/articles/[id]/save route             MISSING     Out of Guide 6 scope (Guide 7+)
Middleware at correct path                UNCERTAIN   src/proxy.ts may not be active

---

END OF FINDINGS
