---
name: next-guide
description: "Prepare for the next BWC Content Engine implementation guide. Use after a guide completes and passes its gates. Spawns an agent team to inspect the codebase state, verify integrations, and find established patterns — then synthesizes findings into an exploration report that feeds the build-guide skill."
---

# Next Guide Preparation — Parallel Codebase Inspection

You are preparing the exploration needed to build the next BWC Content Engine implementation guide. The previous guide has been executed by a Claude Code agent and (ideally) passed its gate checks. Your job is to inspect the ACTUAL codebase state and produce a comprehensive report.

## Step 1: Identify Which Guide Is Next

Read the Master Orchestration Doc at `BWC-Master-Orchestration-Doc.md` in the project root.

Check §4 (Build Order — dependency graph) and §7 (Guide Specifications) to identify:
- Which guide was just completed? (Check `code-inspector-findings.md` from last run if it exists, or ask the user)
- Which guide(s) are next according to the dependency graph?
- What does the next guide need to produce? (files, routes, types, components — from §7)
- What shared contracts does it reference? (from §5)
- What files does it own? (from §5E)

Also read the full system architecture doc at `BWC-Content-Engine-System-Architecture.md` — find the sections relevant to the next guide's subsystem.

## Step 2: Create Agent Team

Spawn an agent team with 3 teammates:

### Teammate 1: Code Inspector (use code-inspector agent)

Investigate:
- What TypeScript types currently exist in `src/types/`? List every interface with its fields.
- What API routes exist? List every `route.ts` with its HTTP methods.
- What Prisma models exist and what are their current fields?
- What library modules exist in `src/lib/`? What do they export?
- What components exist in `src/components/`?
- Cross-reference against orchestration doc §5C (API routes) and §5E (file ownership): what files does the NEXT guide need to create? Which of its dependencies already exist?
- Are there type mismatches between Prisma models and TypeScript interfaces?
- Are there imports that reference modules or types that don't exist yet? (These are integration points the next guide must fulfill.)
- Save findings to `code-inspector-findings.md` in the project root.

### Teammate 2: Integration Verifier (use integration-verifier agent)

Investigate:
- Run Tier 1 checks: Neon connection, `npm run build`, `npm run dev` starts, health endpoint.
- Run Tier 2 checks relevant to the next guide's dependencies:
  - If next guide needs Onyx (Guide 3, 5): verify Onyx is reachable and returning KB results
  - If next guide needs Claude API (Guide 5): verify API key, streaming, web search tool
  - If next guide needs Cloudinary (Guide 9): verify upload and CDN delivery
- Check database state: how many rows in each table? Is seeded data correct?
- If the last guide introduced new API routes, hit them and verify they respond correctly.
- Save findings to `integration-verifier-findings.md` in the project root.

### Teammate 3: Pattern Finder (use pattern-finder agent)

Investigate:
- What implementation patterns have been established by previous guides?
- Specifically look at patterns relevant to the NEXT guide:
  - If next guide creates API routes → find the existing route handler pattern
  - If next guide creates lib modules → find the existing module structure pattern
  - If next guide creates components → find the existing component pattern
  - If next guide calls external services → find the existing service call pattern
- Are there any inconsistencies between files that should follow the same pattern?
- What patterns should the next guide follow for consistency?
- Save findings to `pattern-finder-findings.md` in the project root.

## Step 3: Synthesize Results

Once all teammates complete, read all three findings files and produce `exploration-results.md` containing:

### Sections:

1. **Current Build State**
   - Which guides are complete (infer from what exists)
   - Summary inventory: N tables, M routes, K types, J components, L lib modules
   - Integration health: which services are connected and verified working

2. **Next Guide Target**
   - Guide number and title (from orchestration doc §7)
   - What the orchestration doc says it should produce (files, routes, types)
   - Relevant architecture doc sections to reference during guide construction

3. **Dependencies Satisfied**
   - Shared contracts the next guide needs — and whether they exist (with field-level detail)
   - Library modules the next guide will import — and whether they exist
   - Database tables the next guide will query — and whether they have data
   - External services the next guide needs — and their verified status

4. **Dependencies Missing or Mismatched**
   - Types that need extending (new fields needed on existing interfaces)
   - Modules that the next guide expects but don't exist
   - Any deviation between the orchestration doc's predictions and the actual codebase

5. **Established Patterns to Follow**
   - API route handler template (exact code snippet from an existing working route)
   - Error handling pattern (exact format)
   - Validation pattern (Zod usage)
   - Any service-specific patterns relevant to the next guide
   - Import conventions (exact examples)

6. **Integration Readiness**
   - Which external services the next guide touches
   - Their current status: ✅ verified / ⚠️ needs config / ❌ unavailable
   - Known quirks (Onyx response time, Claude streaming format, Cloudinary signed uploads, etc.)

7. **Risks and Blockers**
   - Services that are down or misconfigured
   - Type mismatches that need resolving first
   - Pattern inconsistencies that should be fixed before adding more code
   - Missing environment variables

8. **Deviations from Plan**
   - Specific ways the actual codebase differs from the orchestration doc's predictions
   - The build-guide skill MUST know about these to produce an accurate guide

## Step 4: Present to User

Tell the user:
- "Exploration complete for Guide [N]: [Title]."
- "[X types, Y routes, Z services verified. Current state: Guides 1-[M] complete.]"
- "[Any blockers: list them]"
- "Run `/build-guide` to generate the implementation guide from these results, or investigate further."
