import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import type { DomAdapter } from "../engine";
import { CHECK_REGISTRY, createResult } from "../engine";

export function runStructureChecks(
  doc: CanonicalArticleDocument,
  dom: DomAdapter
): QAResult[] {
  const results: QAResult[] = [];

  // F01: Exactly 1 <h1>
  const h1s = dom.querySelectorAll("h1");
  results.push(
    createResult(
      CHECK_REGISTRY.F01,
      h1s.length === 1,
      h1s.length === 1
        ? `H1 found: "${h1s[0].textContent.slice(0, 50)}..."`
        : `Expected exactly 1 H1, found ${h1s.length}`,
      "h1",
      h1s.length !== 1
        ? "Ensure the article has exactly one H1 element (the title)."
        : null
    )
  );

  // F02: No H4, H5, H6 in the DOM; no heading level skips
  const headings = dom.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const forbiddenHeadings = headings.filter((h) =>
    ["H4", "H5", "H6"].includes(h.tagName.toUpperCase())
  );
  const hasSkip = checkHeadingSkips(headings);
  const hierarchyPassed = forbiddenHeadings.length === 0 && !hasSkip;
  results.push(
    createResult(
      CHECK_REGISTRY.F02,
      hierarchyPassed,
      hierarchyPassed
        ? "Heading hierarchy valid (H1 > H2 > H3 only, no skips)"
        : forbiddenHeadings.length > 0
          ? `Found ${forbiddenHeadings.length} forbidden heading(s): ${forbiddenHeadings.map((h) => h.tagName).join(", ")}`
          : "Heading level skip detected (e.g., H1 directly to H3)",
      forbiddenHeadings.length > 0
        ? forbiddenHeadings[0].tagName.toLowerCase()
        : null,
      !hierarchyPassed
        ? "Fix heading hierarchy: use only H1, H2, H3 in order. Never skip levels."
        : null
    )
  );

  // W01: H1 length 50–65 chars
  if (h1s.length === 1) {
    const h1Text = h1s[0].textContent.trim();
    const h1Len = h1Text.length;
    const w01Passed = h1Len >= 50 && h1Len <= 65;
    results.push(
      createResult(
        CHECK_REGISTRY.W01,
        w01Passed,
        w01Passed
          ? `H1 length: ${h1Len} chars (target: 50–65)`
          : `H1 length: ${h1Len} chars (target: 50–65)`,
        '[data-cad-path="title"]',
        !w01Passed
          ? `Adjust the H1 to be 50–65 characters. Currently ${h1Len} chars.`
          : null
      )
    );
  }

  // W03: Duplicate headings
  const headingTexts = doc.sections.map((s) => s.heading.toLowerCase().trim());
  const duplicates = headingTexts.filter(
    (text, i) => headingTexts.indexOf(text) !== i
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W03,
      duplicates.length === 0,
      duplicates.length === 0
        ? "No duplicate headings"
        : `Duplicate heading(s): "${duplicates[0]}"`,
      null,
      duplicates.length > 0
        ? `Rename the duplicate heading "${duplicates[0]}" to be unique.`
        : null
    )
  );

  return results;
}

function checkHeadingSkips(headings: { tagName: string }[]): boolean {
  let lastLevel = 0;
  for (const h of headings) {
    const level = parseInt(h.tagName.replace(/[^0-9]/g, ""), 10);
    if (lastLevel > 0 && level > lastLevel + 1) return true;
    lastLevel = level;
  }
  return false;
}
