import type { CanonicalArticleDocument } from "./article";

// === Fix Tier System ===

export type FixTier = 1 | 2;

/** A single mutation to apply to the canonical document via setByPath */
export interface DocMutation {
  cadPath: string;
  value: unknown;
}

/** Result of a deterministic (Tier 1) fix function */
export interface DeterministicFixResult {
  mutations: DocMutation[];
  summary: string; // e.g. "Trimmed meta title to 60 chars"
}

/** A Tier 1 fix function: receives current doc, returns mutations or null if it can't fix */
export type DeterministicFixFn = (
  doc: CanonicalArticleDocument
) => DeterministicFixResult | null;

/** Registry entry for a single QA check */
export interface FixRegistryEntry {
  tier: FixTier;
  fix?: DeterministicFixFn;
  claudePromptTemplate?: string;
}
