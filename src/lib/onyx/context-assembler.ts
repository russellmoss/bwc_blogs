import type { OnyxContext, OnyxSearchResult } from "@/types/onyx";

const MAX_CONTEXT_CHARS = 8000;
const SIMILARITY_THRESHOLD = 0.45;

const EMPTY_CONTEXT = `=== Knowledge Base Context ===
[No relevant knowledge base content found. Generate article using general knowledge and provided instructions.]`;

function buildTrigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const trigrams = new Set<string>();
  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.slice(i, i + 3));
  }
  return trigrams;
}

function trigramSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const trigram of a) {
    if (b.has(trigram)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function isTooSimilar(
  candidate: Set<string>,
  included: Set<string>[]
): boolean {
  for (const existing of included) {
    if (trigramSimilarity(candidate, existing) > SIMILARITY_THRESHOLD) {
      return true;
    }
  }
  return false;
}

export function assembleOnyxContext(contexts: OnyxContext[]): string {
  // Flatten all results from all contexts
  const allResults: OnyxSearchResult[] = [];
  for (const ctx of contexts) {
    allResults.push(...ctx.results);
  }

  // Deduplicate by documentId + content, keeping highest score
  const dedupMap = new Map<string, OnyxSearchResult>();
  for (const result of allResults) {
    const key = `${result.documentId}::${result.content}`;
    const existing = dedupMap.get(key);
    if (!existing || result.score > existing.score) {
      dedupMap.set(key, result);
    }
  }

  const dedupedResults = Array.from(dedupMap.values());

  if (dedupedResults.length === 0) {
    return EMPTY_CONTEXT;
  }

  // Sort by score descending
  dedupedResults.sort((a, b) => b.score - a.score);

  // Build output with character cap and content diversity filtering
  const header =
    "=== Knowledge Base Context ===\n[Retrieved from BWC internal knowledge base. Use these facts to ground the article.]\n";

  let output = header;
  let passagesIncluded = 0;
  let nearDuplicatesFiltered = 0;
  const sourcesIncluded = new Set<string>();
  const includedTrigrams: Set<string>[] = [];

  for (const result of dedupedResults) {
    const candidateTrigrams = buildTrigrams(result.content);

    if (isTooSimilar(candidateTrigrams, includedTrigrams)) {
      nearDuplicatesFiltered++;
      continue;
    }

    const block = `\n--- Source: ${result.sourceDocument} (Relevance: ${result.score.toFixed(2)}) ---\n${result.content}\n`;

    if (output.length + block.length > MAX_CONTEXT_CHARS) {
      break;
    }

    output += block;
    passagesIncluded++;
    sourcesIncluded.add(result.sourceDocument);
    includedTrigrams.push(candidateTrigrams);
  }

  const footer = `\n[${sourcesIncluded.size} unique sources retrieved, ${passagesIncluded} total passages, ${nearDuplicatesFiltered} near-duplicates filtered]`;
  output += footer;

  return output;
}
