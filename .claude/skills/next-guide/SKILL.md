---
name: build-guide
description: "Build an agentic implementation guide from exploration results. Use after /next-guide exploration completes. Creates a phased, validation-gated guide that a Claude Code agent can execute step-by-step. The guide is specific to the BWC Content Engine architecture."
---

# Build BWC Implementation Guide

You are building an implementation guide from completed exploration results. The guide must be executable by a single Claude Code agent working phase-by-phase with human checkpoints.

## Prerequisites

Before starting, verify that these files exist in the project root:
- `exploration-results.md` (synthesized findings from /next-guide)
- `code-inspector-findings.md`
- `integration-verifier-findings.md`
- `pattern-finder-findings.md`

Read ALL of them. The exploration results are the primary source, but the raw findings files contain exact line numbers, code snippets, and edge cases you'll need.

Also read:
- `BWC-Master-Orchestration-Doc.md` — §7 has the guide spec, §5 has shared contracts, §6 has gate protocol
- `BWC-Content-Engine-System-Architecture.md` — the sections relevant to this guide's subsystem

## Guide Structure

Create the guide as `guide-[N]-[name].md` in the project root (e.g., `guide-4-article-schema-renderer.md`).

### Header Section

```markdown
# Guide [N]: [Subsystem Name]

## Reference Documents
- BWC-Master-Orchestration-Doc.md §7 (Guide [N] spec)
- BWC-Content-Engine-System-Architecture.md §[X] (relevant sections)
- exploration-results.md (codebase state at time of writing)

## What This Guide Builds
[1-2 sentence summary of the subsystem and why it exists]

## Scope
**In scope:** [specific list]
**Out of scope:** [what this guide does NOT touch]

## Depends On
[List of completed guides this one requires, confirmed by exploration results]

## Files Created / Modified
[Explicit list of every file this guide will create or modify, with ownership confirmation from §5E]

## Pre-Flight Checklist
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
If pre-existing errors, STOP and report. Do not proceed with a broken baseline.
```

### Phase Pattern

Every phase follows this template:

```markdown
## PHASE N: [Title]

### Context
[Why this phase exists, what it does, which files are affected]

### Step N.1: [Specific action]
**File**: `[exact path]`
**Action**: Create / Modify

[Exact code to add/change. For new files, show the complete file content.
For modifications, show the specific section with before/after context.]

### Step N.2: [Next action]
...

### PHASE N — VALIDATION GATE
```bash
# Type check
npx tsc --noEmit 2>&1 | tail -20
# Lint
npx next lint 2>&1 | tail -20
# Prisma validation (if schema changed)
npx prisma validate 2>&1
# Pattern-specific checks
grep -r "expectedPattern" src/path/ | head -10
```

**Expected output**: [What the commands should show]

**STOP AND REPORT**: Tell the user:
- "[Summary of what Phase N accomplished]"
- "[Error count: X type errors, Y lint warnings]"
- "[What Phase N+1 will do]"
- "Ready to proceed?"
```

### Standard Phase Order for BWC Guides

The exact phases depend on which guide is being built, but follow this general order:

**Phase 1: Types & Schema (if applicable)**
- Add or extend TypeScript interfaces in `src/types/`
- Update Prisma schema if new models/fields needed (rare after Guide 1 — all tables already exist)
- Run `npx prisma generate` if schema changed
- This phase may intentionally break the build by adding required fields — TypeScript errors become the Phase 2+ checklist

**Phase 2: Core Library Module(s)**
- Create the main business logic in `src/lib/[subsystem]/`
- Follow the established patterns found by pattern-finder (exact code snippets from existing modules)
- Include: exports, error handling, types, validation
- For modules that call external services: include timeout, retry, error classification
- Wire up imports to shared types

**Phase 3: API Route(s)**
- Create route handlers in `src/app/api/[subsystem]/`
- Follow the EXACT pattern from the pattern-finder findings:
  - Auth check (same approach as existing routes)
  - Input validation (Zod, same pattern)
  - Error response format (`{ success: false, error: { code, message } }`)
  - Success response format (`{ success: true, data }`)
- Import from the library module created in Phase 2

**Phase 4: UI Components (if applicable)**
- Create React components in `src/components/[subsystem]/`
- Follow existing component conventions (Tailwind for app UI, NOT for blog article output)
- Wire up to API routes via fetch/SWR/React Query (match existing pattern)
- Handle loading and error states consistently

**Phase 5: Integration Wiring**
- Connect the new subsystem to existing subsystems
- Update any parent components that need to render or route to the new components
- Wire up navigation if applicable
- Ensure the new code is reachable from the app shell

**Phase 6: Agent-Guard Sync**
```bash
npx agent-guard sync
```
Review changes to `docs/ARCHITECTURE.md` and generated inventories. Stage if correct.

**Phase 7: Integration Test Script**
- Create `scripts/test-guide-[N].ts` with automated checks
- Test the subsystem's API routes with sample requests
- Verify database state if applicable
- This is the Gate 2 check from the orchestration doc §6C

**Phase 8: Human Gate (Requires User)**
- Present specific test instructions from orchestration doc §6C (Gate 3 for this guide)
- List exactly what the user should check in the browser
- Include curl commands for API-only guides

### Critical Rules for Guide Quality

1. **Use the ACTUAL codebase state, not the orchestration doc's predictions.** The exploration results show what really exists. If the orchestration doc says "Guide 2 produces `src/lib/content-map/slug.ts`" but exploration shows it's actually at `src/lib/content-map/utils.ts`, use the real path.

2. **Match existing patterns exactly.** Copy the code snippets from pattern-finder findings. If existing routes use `getServerSession(authOptions)`, don't switch to `auth()`. If existing modules use `try/catch` with specific error codes, follow that exact pattern.

3. **Import merges, not additions.** Always say "add X to the EXISTING import from Y" — never add a second import from the same module.

4. **Show complete file contents for new files.** For files being created from scratch, include the ENTIRE file — not pseudocode or "implement the logic here" placeholders. The executing agent should be able to copy-paste.

5. **Show surgical diffs for modified files.** For files being changed, show the exact code being replaced and the replacement. Include enough surrounding context (3-5 lines before and after) that the edit location is unambiguous.

6. **Validation gates must have concrete commands.** Not "verify the changes" — actual bash commands (tsc, grep, curl) that produce checkable output with expected results stated.

7. **Account for deviations.** The exploration results may reveal that previous guides produced code slightly different from what the orchestration doc predicted. The guide must work with the ACTUAL code, not the planned code.

8. **Agent-guard sync before human validation.** Always include `npx agent-guard sync` as a phase before the human gate.

9. **Include a Troubleshooting section.** Common failure modes for this specific guide — drawn from the integration-verifier's findings (service timeouts, auth issues) and the pattern-finder's inconsistency notes.

### Guide-Specific Sections

Depending on which guide is being built, include these additional sections:

**For Guide 4 (Article Schema + Renderer):**
- Include the complete Zod schema for CanonicalArticleDocument
- Include a sample fixture JSON that passes validation
- Include the complete Compiled Template CSS and component HTML patterns
- Include renderer output examples for each content node type

**For Guide 5 (Orchestration + Claude API):**
- Include the complete system prompt assembly for each of the 7 layers
- Include the Claude API request format with streaming and web search tool config
- Include the response parsing logic for structured JSON extraction
- Include the post-generation validation pipeline steps

**For Guide 6 (Split-Pane UI):**
- Include wireframe descriptions of each UI panel
- Include the state management setup (Context/Zustand) with all state fields
- Include the streaming render pipeline (how chunks flow from API to iframe)
- Include the iframe communication protocol

**For Guide 8 (QA Scorecard):**
- Include every check from orchestration doc Appendix D with its implementation logic
- Include the scoring algorithm
- Include the overlay UI behavior spec

## Output

Save the guide as `guide-[N]-[name].md` in the project root.

**STOP AND REPORT**: Tell the user:
- "Implementation guide complete: `guide-[N]-[name].md`"
- "[N] phases, [M] files to create, [K] files to modify"
- "**Pre-execution recommendation**: Review the guide, especially Phases 1-3 which define types and core logic. Spot-check that the patterns match your existing code."
- "When ready, open a new Claude Code session and run:"
- "`Read guide-[N]-[name].md top to bottom. Execute each phase sequentially. Stop and report at every VALIDATION GATE. Start with Pre-Flight.`"
