/**
 * QA severity adjustments for imported HTML.
 *
 * For imports, the CanonicalArticleDocument is synthetic — it has placeholder
 * content in sections, generic link types, etc. Most QA checks read from the
 * doc and will produce incorrect results.
 *
 * Instead of blocklisting individual checks, we ALLOWLIST the checks that
 * reliably work against the actual HTML via DomAdapter, and downgrade
 * everything else to info.
 */

import type { QAResult, QACheck } from "@/types/qa";

/**
 * Checks that read from the actual HTML (DomAdapter) and remain valid
 * for imported articles. Everything NOT in this set gets downgraded.
 */
const IMPORT_RELIABLE_CHECKS = new Set([
  "F01", // H1 present — reads DOM
  "F02", // Heading hierarchy — reads DOM
  "F10", // BlogPosting schema — reads DOM
  "F14", // Publication date — extracted into synthetic doc correctly
  "F17", // Canonical URL — extracted into synthetic doc correctly
  "W10", // External target=_blank — reads DOM
  "W20", // Hero image perf — reads DOM
  "W21", // Image dimensions — reads DOM
]);

/**
 * Adjust QA results for imported HTML: downgrade all checks NOT in the
 * reliable set from fail/warn to info severity, and mark them as passed.
 */
export function adjustForImport(results: QAResult[]): QAResult[] {
  return results.map((result) => {
    if (IMPORT_RELIABLE_CHECKS.has(result.check.id)) {
      return result;
    }

    // Create an info-severity version of the check
    const adjustedCheck: QACheck = {
      ...result.check,
      severity: "info",
    };

    return {
      ...result,
      check: adjustedCheck,
      passed: true,
      score: 1,
      message: `${result.message} [adjusted for import]`,
    };
  });
}
