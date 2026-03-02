---
name: build-guide
description: "Prepare for the next BWC Content Engine implementation guide. Spawns an agent team to inspect codebase state, verify integrations, and check source editorial docs — then synthesizes findings into a report in the /guides folder."
version: 1.1
---

# Next Guide Preparation — Parallel Codebase Inspection (v1.1)

You are preparing the exploration needed to build the next BWC Content Engine implementation guide. Your job is to inspect the ACTUAL codebase state, verify external services, and ensure editorial source documents are present to produce a comprehensive report.

## Step 1: Identify Which Guide Is Next

Read the Master Orchestration Doc at `BWC-Master-Orchestration-Doc.md` in the project root.

Check §4 (Build Order) and §7 (Guide Specifications) to identify:
- Which guide was just completed?
- Which guide(s) are next according to the dependency graph?
- What does the next guide need to produce? (files, routes, types, components).
- What shared contracts does it reference? (from §5).
- What files does it own? (from §5E).

## Step 2: Create Agent Team & Verify Source Docs

### Source Document Verification (Mandatory)
Before spawning the team, verify the existence and readability of the following in `/docs/`:
1. `BWC Master Content Engine SOP.md`
2. `Bhutan Wine Company — Brand Style Guide for HTML Blog Posts (3).md`
*If missing or unreadable, flag this as a BLOCKER immediately.*

### Spawn Agent Team (3 Teammates)

#### Teammate 1: Code Inspector
**Task:** Read-only investigation of types, API routes, Prisma models, and file dependencies.
**Reporting:** Identify gaps between the Orchestration Doc and actual code. Prioritize identifying "Construction Sites" (where objects are created) to prevent downstream build failures.

#### Teammate 2: Integration Verifier
**Task:** Verify external service connections (Neon, Onyx, Claude, Cloudinary).
**Reporting:** Report exact status codes and response times. Distinguish between credential errors and network/service downtime.

#### Teammate 3: Pattern Finder
**Task:** Trace data flows for existing features (API handlers, Renderer, Prompt Assembly).
**Reporting:** Document snippets for the "Success Pattern" the next guide should copy. Identify any "Pattern Drift" or inconsistencies.

## Step 3: Reporting & Synthesis (Robustness & Organization)

### Organizational Requirement
All findings files (`code-inspector-findings.md`, etc.) and the final `exploration-results.md` MUST be written to the `guides/` directory, not the project root.

### Robustness Clause (Handoff)
If a teammate fails to write their `.md` file due to shell or tool errors, they MUST provide their full structured report as a direct text response to you (the Main Agent). You will then incorporate their data into the final synthesis.

### Synthesis Components
Produce `guides/exploration-results-[Guide#].md` containing:
1. **Current Build State:** Inventory of models, routes, and types.
2. **Source Doc Status:** Confirmation that SOP and Style Guide are present and verified.
3. **Gaps & Deviations:** Specific ways the actual code differs from the Orchestration Doc.
4. **Established Patterns:** The exact "Template" (code snippets) the next guide should follow.
5. **Risks & Blockers:** High-severity items (e.g., service down, missing types, .env mismatches).

## Step 4: Present to User

Tell the user:
- "Exploration complete for Guide [N]: [Title]."
- "Status: [X types, Y routes, Z services verified. Source Docs: ✅ Verified]."
- "Report Location: `guides/exploration-results-[Guide#].md`"
- "Any blockers: [List them clearly]."
- "Run `/build-guide` to generate the implementation guide from these results."