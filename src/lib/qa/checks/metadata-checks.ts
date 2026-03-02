import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import { CHECK_REGISTRY, createResult } from "../engine";

export function runMetadataChecks(
  doc: CanonicalArticleDocument
): QAResult[] {
  const results: QAResult[] = [];

  // W04: Meta title should differ from H1
  const titleNorm = doc.title.toLowerCase().trim();
  const metaNorm = doc.metaTitle.toLowerCase().trim();
  const w04Passed = titleNorm !== metaNorm;
  results.push(
    createResult(
      CHECK_REGISTRY.W04,
      w04Passed,
      w04Passed
        ? "Meta title differs from H1"
        : "Meta title is identical to H1 — should be similar but not identical",
      '[data-cad-path="metaTitle"]',
      !w04Passed
        ? "Rewrite the meta title to be a variation of the H1, not an exact copy."
        : null
    )
  );

  // W05: Slug length 3–6 words
  const slugWords = doc.slug
    .split("-")
    .filter((w) => w.length > 0).length;
  const w05Passed = slugWords >= 3 && slugWords <= 6;
  results.push(
    createResult(
      CHECK_REGISTRY.W05,
      w05Passed,
      w05Passed
        ? `Slug has ${slugWords} words (target: 3–6)`
        : `Slug has ${slugWords} words (target: 3–6)`,
      null,
      !w05Passed
        ? `Adjust the URL slug to be 3–6 hyphenated words. Currently ${slugWords} words.`
        : null
    )
  );

  return results;
}
