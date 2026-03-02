import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import type { DomAdapter } from "../engine";
import { CHECK_REGISTRY, createResult } from "../engine";

export function runSchemaChecks(
  doc: CanonicalArticleDocument,
  dom: DomAdapter
): QAResult[] {
  const results: QAResult[] = [];

  // W19: data-nosnippet on sensitive content (pricing, legal)
  if (doc.dataNosnippetSections.length > 0) {
    const nosnippetElements = dom.querySelectorAll("[data-nosnippet]");
    const w19Passed = nosnippetElements.length >= doc.dataNosnippetSections.length;
    results.push(
      createResult(
        CHECK_REGISTRY.W19,
        w19Passed,
        w19Passed
          ? `${nosnippetElements.length} data-nosnippet element(s) found for ${doc.dataNosnippetSections.length} marked section(s)`
          : `Expected ${doc.dataNosnippetSections.length} data-nosnippet element(s), found ${nosnippetElements.length}`,
        "[data-nosnippet]",
        !w19Passed
          ? "Add data-nosnippet attribute to sections containing pricing or legal content."
          : null
      )
    );
  }

  return results;
}
