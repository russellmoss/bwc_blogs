# Implementation Guide: Writing Style Manager

## Objective

Add a **Writing Style Manager** to the BWC Content Engine that lets users create, edit, select, and delete named writing styles. A selected style injects a new prompt layer into the generation pipeline, steering Claude's prose voice without altering the brand's visual system, SEO structure, or QA requirements.

The current SOP hardcodes one voice: "luxury, authoritative, and visionary." That's the right default, but different articles benefit from different registers -- a harvest journal shouldn't read like an academic terroir analysis, and a Jancis Robinson profile piece shouldn't sound like a travel brochure.

---

## Scope

### In Scope

- Database table for writing styles (`writing_styles`)
- CRUD API routes for styles
- A new prompt assembly layer: **Layer 8: Writing Voice**
- UI: style selector dropdown in the article generation toolbar
- UI: Style Manager panel (create, edit, delete, preview styles)
- Session persistence: selected style sticks until the user changes it
- A set of 3-4 seed styles shipped with the app

### Out of Scope

- Per-section style switching within a single article
- Style-aware QA checks (Flesch-Kincaid already covers readability; voice is subjective)
- Automatic style recommendation based on article type
- File upload of `.md` files via drag-and-drop (users paste content into a textarea; file import is a future enhancement)

### Existing Behavior Preserved

- The SOP (Layer 1) remains the authority on structure, links, entities, and SEO rules
- The Brand Style Guide (Layer 2a) remains the authority on visual/CSS decisions
- The Template Reference (Layer 3) remains the authority on content node types
- QA scorecard checks are unchanged -- style affects prose tone, not structural compliance
- All three editing modes (Chat, Canvas, HTML) work identically regardless of style
- If no style is selected, the system uses the SOP's default voice direction (luxury, authoritative, visionary)

---

## Architecture

### Where This Fits in the Prompt Assembly

Current layers (from `src/lib/prompt-assembly/assembler.ts`):

```
Layer 1: Master SOP (static)
Layer 2a: Brand Style Guide (static)
Layer 3: Template Reference (static)
Layer 4: Article Brief (dynamic per article)
Layer 5: KB Context from Onyx (dynamic per article)
Layer 6: Internal Link Graph (dynamic per article)
Layer 7: Photo Manifest (dynamic per article)
```

New layer inserted between the static and dynamic layers:

```
Layer 1: Master SOP (static)
Layer 2a: Brand Style Guide (static)
Layer 3: Template Reference (static)
Layer 8: Writing Voice (dynamic per session)    <-- NEW
Layer 4: Article Brief (dynamic per article)
Layer 5: KB Context from Onyx (dynamic per article)
Layer 6: Internal Link Graph (dynamic per article)
Layer 7: Photo Manifest (dynamic per article)
```

**Why Layer 8 sits here:** It's session-scoped (changes less often than per-article layers) but more specific than the static brand/SOP layers. Placing it after the template reference but before the article brief means Claude reads the structural rules first, then the voice guidance, then the specific article context. This prevents the voice layer from being "forgotten" under the weight of article-specific data.

### Token Budget

Writing style documents should be capped at **2,000 tokens** (~8,000 characters). This keeps the total prompt assembly within budget. The layer includes a preamble instruction (~100 tokens) plus the user's style content. The assembler truncates if exceeded and logs a warning.

---

## Data Model

### New Table: `writing_styles`

```sql
CREATE TABLE writing_styles (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    content         TEXT NOT NULL,
    is_default      BOOLEAN DEFAULT false,
    is_seed         BOOLEAN DEFAULT false,
    created_by      TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

**Prisma model:**

```prisma
model WritingStyle {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  slug        String   @unique
  description String?
  content     String
  isDefault   Boolean  @default(false) @map("is_default")
  isSeed      Boolean  @default(false) @map("is_seed")
  createdBy   String?  @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at")

  @@map("writing_styles")
}
```

### Session Persistence

The selected style ID is stored in the article store (Zustand). It persists for the browser session:

```typescript
// In src/lib/store/article-store.ts
selectedStyleId: number | null;      // null = use SOP default voice
setSelectedStyleId: (id: number | null) => void;
```

This is NOT persisted to the database per-article. The style is a session preference, not an article attribute. If we later want to record which style was used for a given article version, we add a `style_id` column to `article_documents` -- but that's a future enhancement.

---

## API Routes

### `GET /api/styles`

Returns all writing styles, ordered by `is_default DESC, name ASC`.

```typescript
// Response
{
  success: true,
  data: WritingStyle[]
}
```

### `POST /api/styles`

Creates a new writing style.

```typescript
// Request body
{
  name: string;          // required, unique
  description?: string;
  content: string;       // required, the style markdown
}

// Validation:
// - name: 1-100 characters, unique
// - content: 1-8,000 characters (enforces ~2,000 token cap)
// - slug: auto-generated from name (lowercase, hyphenated)
```

### `PUT /api/styles/[id]`

Updates an existing style. Seed styles can be edited (the `is_seed` flag is informational, not a lock).

### `DELETE /api/styles/[id]`

Deletes a style. If the deleted style is currently selected in any active session, the frontend falls back to `null` (default voice).

### `POST /api/styles/[id]/set-default`

Sets this style as the default. Clears `is_default` on all other styles first.

---

## Prompt Assembly Layer

### New file: `src/lib/prompt-assembly/layer-writing-voice.ts`

```typescript
import { prisma } from "@/lib/db";
import type { PromptLayer } from "@/types/claude";

const MAX_CONTENT_TOKENS = 2000;
const CHARS_PER_TOKEN = 4;
const MAX_CONTENT_CHARS = MAX_CONTENT_TOKENS * CHARS_PER_TOKEN;

const VOICE_PREAMBLE = `=== WRITING VOICE DIRECTIVE ===
The following style guide governs the TONE, VOICE, and PROSE STYLE
of this article. Follow these directions for sentence structure,
vocabulary, rhythm, perspective, and emotional register.

IMPORTANT: This voice directive does NOT override:
- The SOP's structural requirements (word count, links, entities, headings)
- The Brand Style Guide's visual rules (CSS, components, formatting)
- The Template Reference's content node types
- Any QA scorecard check

The voice directive shapes HOW you write, not WHAT you write or
how the output is structured. All SOP and SEO rules remain in force.

--- BEGIN STYLE ---
`;

const VOICE_POSTAMBLE = `
--- END STYLE ---`;

export async function buildLayerWritingVoice(
  styleId: number | null
): Promise<PromptLayer | null> {
  if (styleId === null) {
    return null; // No style selected -- SOP default voice applies
  }

  const style = await prisma.writingStyle.findUnique({
    where: { id: styleId },
    select: { name: true, content: true },
  });

  if (!style) {
    return null; // Style not found -- fall back to default
  }

  let content = style.content;
  if (content.length > MAX_CONTENT_CHARS) {
    content = content.slice(0, MAX_CONTENT_CHARS);
    console.warn(
      `[layer-writing-voice] Style "${style.name}" truncated to ${MAX_CONTENT_TOKENS} tokens`
    );
  }

  const fullContent = VOICE_PREAMBLE + content + VOICE_POSTAMBLE;

  return {
    name: `Writing Voice: ${style.name}`,
    content: fullContent,
    tokenEstimate: Math.ceil(fullContent.length / CHARS_PER_TOKEN),
  };
}
```

### Assembler Integration

In `src/lib/prompt-assembly/assembler.ts`, the function signature gains a `styleId` parameter:

```typescript
export async function assembleSystemPrompt(
  articleId: number,
  photoManifest: PhotoManifest | null,
  styleId: number | null = null         // <-- NEW
): Promise<AssembledPrompt> {
  // ... existing layer assembly ...

  const layerWritingVoice = await buildLayerWritingVoice(styleId);

  const layers: PromptLayer[] = [
    layerSop,
    layerStyleGuide,
    layerTemplateRef,
    ...(layerWritingVoice ? [layerWritingVoice] : []),  // conditional
    layerBrief,
    layerKbContext,
    layerLinkGraph,
    layerPhotoManifest,
  ];

  // ... rest unchanged ...
}
```

The `styleId` flows from the frontend store -> the generation API route -> the assembler. When `null`, no voice layer is injected and the SOP's default voice section governs tone.

---

## Seed Styles

Ship with 4 pre-built styles. These are inserted via a Prisma seed script.

### 1. BWC Default -- Luxury Editorial (is_default: true)

```markdown
# Luxury Editorial Voice

Write as if narrating the founding of a wine region that will be studied
for generations. Not breathlessly. Not with false modesty. With the quiet
confidence of someone who knows the significance of what they are building.

## Sentence Rhythm
- Alternate short declaratives with longer, layered constructions
- Average sentence length: 15-20 words
- Use fragments sparingly but deliberately for emphasis

## Vocabulary
- Precise over ornate. "Laterite" not "reddish soil." "Veraison" not "color change."
- Explain technical terms on first use with a brief subordinate clause
- Avoid superlatives unless backed by specific data

## Perspective
- First-person plural ("we," "our") for BWC operations
- Third-person for industry context and external research
- Never use exclamation points in body text

## Emotional Register
- Confident, measured, subtly reverent
- The reader should feel they are being trusted with something significant
- Let specificity carry the emotional weight, not adjectives

## Avoid
- "In this article, we will explore..."
- "It's worth noting that..."
- Filler transitions: "Furthermore," "Additionally," "Moreover"
- Breathless marketing language
```

### 2. Narrative Storyteller

```markdown
# Narrative Storyteller Voice

Write as if telling a story around a table with a glass of wine in hand.
Sensory-rich, human-centered, driven by moments rather than data points.
The reader should feel transported to the vineyard.

## Sentence Rhythm
- Lead with scene-setting: time of day, weather, physical sensation
- Use present tense for immersive moments, past tense for context
- Shorter paragraphs -- 2-3 sentences maximum
- Let single-sentence paragraphs land key moments

## Vocabulary
- Favor sensory language: texture, sound, temperature, color, scent
- Use proper nouns -- name the valley, the river, the person
- Technical terms are fine but always grounded in physical reality:
  "veraison -- the moment the grapes blush from green to violet"

## Perspective
- Second person ("you") is acceptable for immersive passages:
  "You can feel the temperature drop as the sun dips behind the ridge"
- First-person plural for BWC team moments
- Name specific people when recounting events

## Emotional Register
- Warm, vivid, intimate
- The reader is a guest, not a student
- Wonder over analysis -- but always anchored in real detail

## Avoid
- Abstract claims without sensory grounding
- Data dumps without narrative framing
- Passive voice (almost always)
- Explaining what the reader should feel -- show it instead
```

### 3. Wine Critic / Technical Authority

```markdown
# Wine Critic / Technical Authority Voice

Write as a senior wine critic or viticulture researcher would for a
trade publication. Data-dense, analytical, authoritative. The reader is
a professional who values precision over narrative.

## Sentence Rhythm
- Lead with facts, follow with interpretation
- Longer sentences acceptable when building technical arguments
- Use semicolons to connect related technical claims
- Data parentheticals are encouraged: "(12.5% ABV, 3.2 g/L TA, pH 3.38)"

## Vocabulary
- Full technical vocabulary without apology or explanation
- Varietal names, soil classifications, viticultural terms used freely
- Comparative language: "comparable to," "exceeding," "in contrast with"
- Specific over general: elevation in meters, yields in tons/hectare

## Perspective
- Third-person analytical: "The vineyard demonstrates..."
- First-person plural only when citing BWC proprietary data
- Reference published research by author and year when available

## Emotional Register
- Measured, precise, evaluative
- Conclusions are earned through evidence, not asserted
- Skepticism and nuance are strengths -- acknowledge limitations
- The reader trusts you because you don't oversell

## Avoid
- Marketing language of any kind
- "Unique" without qualification
- Sensory descriptions that can't be verified
- Hedging when data supports a clear conclusion
```

### 4. Accessible Wine Enthusiast

```markdown
# Accessible Wine Enthusiast Voice

Write for the curious reader who loves wine but isn't in the industry.
They read Wine Enthusiast, watch sommelier content, and travel to wine
regions -- but they don't have a WSET certification. Make them feel smart,
not talked down to.

## Sentence Rhythm
- Short paragraphs, punchy sentences
- One idea per paragraph
- Use analogies to familiar experiences:
  "Think of diurnal temperature swing like a pressure cooker for flavor"
- Break up technical passages with conversational asides

## Vocabulary
- Use technical terms but always define them naturally on first use
- Prefer concrete comparisons: "the altitude of Denver" not "1,600 meters"
- Food and travel vocabulary welcome -- these readers think in experiences

## Perspective
- Second-person inclusive: "When you taste..." "If you've ever visited..."
- First-person plural for BWC: "Our vineyards sit at..."
- Direct address is fine: "Here's what makes this interesting."

## Emotional Register
- Enthusiastic but grounded
- The energy of a friend who just got back from an incredible trip
- Curious, generous, never condescending
- OK to express excitement through specificity (not exclamation points)

## Avoid
- Jargon without explanation
- Assuming the reader knows grape varieties by sight
- Dense paragraphs of technical data without breathing room
- Sounding like a textbook or a press release
```

---

## UI Components

### 1. Style Selector (Toolbar Dropdown)

Location: article generation toolbar, next to the article type selector.

```
+-------------------------------------+
|  Writing Style: [v Luxury Editorial] |
+-------------------------------------+
```

Behavior:
- Dropdown shows all styles, with the default style marked with a star
- "No Style (SOP Default)" is always the first option
- Selected style persists in Zustand store across article switches
- Changing style mid-session does NOT retroactively change an already-generated article -- it applies to the next generation or regeneration
- A small "Manage Styles" link at the bottom opens the Style Manager

### 2. Style Manager Panel

Location: accessible from the toolbar dropdown link or from a Settings area.

```
+-----------------------------------------------------------+
|  Writing Styles                                    [+ New] |
+-----------------------------------------------------------+
|                                                            |
|  * Luxury Editorial (default)                   [Edit][...]|
|    Confident, measured, luxury wine register                |
|                                                            |
|    Narrative Storyteller                         [Edit][...]|
|    Sensory-rich, scene-driven, immersive                    |
|                                                            |
|    Wine Critic                                   [Edit][...]|
|    Technical, data-dense, analytical                        |
|                                                            |
|    Accessible Enthusiast                         [Edit][...]|
|    Warm, curious, defines terms naturally                    |
|                                                            |
+-----------------------------------------------------------+
```

The `[...]` overflow menu offers: Set as Default, Duplicate, Delete.

### 3. Style Editor

A modal or panel with:
- **Name** (text input)
- **Description** (text input, 1 line -- shown in dropdown)
- **Style Content** (textarea with character count and token estimate)
- Save / Cancel buttons
- Character limit indicator: `2,847 / 8,000 characters (~712 tokens)`

---

## Implementation Steps (Execution Order)

### Step 1: Database Migration
Add the WritingStyle model to `prisma/schema.prisma` and run migration.

### Step 2: Seed Script
Create `prisma/seeds/writing-styles.ts` with the 4 seed styles. Mark Luxury Editorial as `is_default: true, is_seed: true`.

### Step 3: API Routes
Create:
- `src/app/api/styles/route.ts` -- GET (list all), POST (create)
- `src/app/api/styles/[id]/route.ts` -- GET (single), PUT (update), DELETE
- `src/app/api/styles/[id]/set-default/route.ts` -- POST

Each route uses `requireAuth()` and returns `{ success, data/error }`.

### Step 4: Prompt Layer
Create `src/lib/prompt-assembly/layer-writing-voice.ts` as specified above.

### Step 5: Assembler Update
Update `src/lib/prompt-assembly/assembler.ts` to accept `styleId` and conditionally include the voice layer.

### Step 6: Zustand Store
Add `selectedStyleId` and `setSelectedStyleId` to the article store.

### Step 7: Wire Generation Route
Update the generation API route to pass `styleId` from the request body through to `assembleSystemPrompt`.

### Step 8: UI -- Style Selector
Build the dropdown component for the toolbar. Fetch styles on mount via `GET /api/styles`.

### Step 9: UI -- Style Manager Panel
Build the CRUD panel: list, create, edit, delete. Character counter on editor textarea. Confirm dialog on delete.

### Step 10: Seed Data
Run the seed script to populate default styles.

---

## Acceptance Criteria

1. **Styles CRUD works**: User can create, read, update, and delete writing styles via the UI
2. **Style selection persists**: Selecting a style persists across article switches within the same session
3. **Style affects generation**: Generating the same article brief with different styles produces noticeably different prose tone
4. **No style = SOP default**: When "No Style" is selected, generation behaves identically to the current system
5. **SOP rules survive**: Changing the style never causes a QA scorecard failure that wouldn't have occurred without the style
6. **Token budget respected**: Style content over 8,000 characters is truncated with a console warning; generation still succeeds
7. **Seed styles available**: Fresh deployment has 4 usable styles out of the box
8. **Delete safety**: Deleting a currently-selected style gracefully falls back to "No Style"

---

## Risks and Failure Modes

### Risk: Style overrides SOP structural rules
**Mitigation:** The voice layer preamble explicitly states that SOP, style guide, and template rules take precedence. The QA scorecard catches any structural violations regardless of style.

### Risk: Overly long style documents blow up token budget
**Mitigation:** Hard cap at 8,000 characters enforced at API validation and prompt assembly. The UI shows a live character/token counter.

### Risk: Style causes keyword stuffing or de-optimization
**Mitigation:** Style documents only govern voice and tone. The seed styles model this correctly. UI description guides users: "Style directives shape how the article reads -- they do not change what the article covers or how it's structured for SEO."

### Risk: Users create conflicting styles
**Mitigation:** Not a system risk -- the selected style simply replaces the voice layer. The seed styles serve as structural templates for writing good directives.

---

## Claude Code Execution Prompt

```
You are implementing the Writing Style Manager for the BWC Content Engine.

Read Implementation-Guide-Writing-Style-Manager.md for the full specification.

Execute in this order:

1. Add the WritingStyle model to prisma/schema.prisma and run the migration
2. Create the seed script at prisma/seeds/writing-styles.ts with the 4 seed styles
3. Create src/lib/prompt-assembly/layer-writing-voice.ts
4. Update src/lib/prompt-assembly/assembler.ts to accept styleId and
   conditionally include the voice layer
5. Create API routes:
   - src/app/api/styles/route.ts
   - src/app/api/styles/[id]/route.ts
   - src/app/api/styles/[id]/set-default/route.ts
6. Add selectedStyleId to the Zustand article store
7. Update the generation API route to pass styleId through to assembleSystemPrompt
8. Build the StyleSelector dropdown component
9. Build the StyleManager panel with create/edit/delete
10. Run the seed script

After each step, verify the file compiles. After step 5, test the API
routes with curl. After step 10, verify seed styles appear in the database.
```

---

## What to Build Next

This guide has no dependencies on unbuilt guides -- it's a self-contained feature that plugs into the existing prompt assembly pipeline. The logical next priorities remain the main build sequence.

A future enhancement worth noting: **style analytics** -- after enough articles are generated, surface which styles produce the highest QA scores, best readability ranges, or most natural keyword integration. That requires a `style_id` column on `article_documents`, which is intentionally deferred.
