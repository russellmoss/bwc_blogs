import type { CanonicalArticleDocument } from "@/types/article";
import type { OnyxSearchResult } from "@/types/onyx";
import type { CitationMatch } from "@/types/citation";
import { buildTrigrams, trigramSimilarity } from "@/lib/util/trigram";

const MIN_PARAGRAPH_LENGTH = 40;
const MATCH_THRESHOLD = 0.20;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function computeCitationMatches(
  document: CanonicalArticleDocument,
  onyxSources: OnyxSearchResult[]
): CitationMatch[] {
  if (onyxSources.length === 0) return [];

  // Pre-compute trigrams for all sources
  const sourceTrigrams = onyxSources.map((s) => buildTrigrams(s.content));

  const matches: CitationMatch[] = [];

  for (const section of document.sections) {
    for (let nodeIndex = 0; nodeIndex < section.content.length; nodeIndex++) {
      const node = section.content[nodeIndex];
      if (node.type !== "paragraph") continue;

      const plaintext = stripHtml(node.text);
      if (plaintext.length < MIN_PARAGRAPH_LENGTH) continue;

      const paragraphTrigrams = buildTrigrams(plaintext);

      let bestScore = 0;
      let bestSourceIndex = -1;

      for (let i = 0; i < onyxSources.length; i++) {
        const score = trigramSimilarity(paragraphTrigrams, sourceTrigrams[i]);
        if (score > bestScore) {
          bestScore = score;
          bestSourceIndex = i;
        }
      }

      if (bestScore >= MATCH_THRESHOLD && bestSourceIndex >= 0) {
        matches.push({
          sectionId: section.id,
          nodeIndex,
          paragraphPlaintext: plaintext,
          source: onyxSources[bestSourceIndex],
          confidence: bestScore,
        });
      }
    }
  }

  return matches;
}
