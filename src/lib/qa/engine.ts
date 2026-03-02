import type { CanonicalArticleDocument } from "@/types/article";
import type { QACheck, QAResult, QAScore } from "@/types/qa";
import { validateCanonicalDocument } from "@/lib/article-schema/validate";
import { runStructureChecks } from "./checks/structure-checks";
import { runMetadataChecks } from "./checks/metadata-checks";
import { runLinkChecks } from "./checks/link-checks";
import { runImageChecks } from "./checks/image-checks";
import { runContentChecks } from "./checks/content-checks";
import { runSchemaChecks } from "./checks/schema-checks";
import { fleschKincaidGrade } from "./readability";

// ================================================================
// DOM Adapter interface — abstracts browser DOMParser vs cheerio
// ================================================================

export interface DomElement {
  tagName: string;
  getAttribute(name: string): string | null;
  textContent: string;
}

export interface DomAdapter {
  querySelectorAll(selector: string): DomElement[];
  querySelector(selector: string): DomElement | null;
}

// Browser adapter (for client-side usage)
export class BrowserDomAdapter implements DomAdapter {
  private doc: Document;
  constructor(html: string) {
    this.doc = new DOMParser().parseFromString(html, "text/html");
  }
  querySelectorAll(selector: string): DomElement[] {
    try {
      return Array.from(this.doc.querySelectorAll(selector)).map(
        (el) => ({
          tagName: el.tagName,
          getAttribute: (name: string) => el.getAttribute(name),
          textContent: el.textContent || "",
        })
      );
    } catch {
      return [];
    }
  }
  querySelector(selector: string): DomElement | null {
    try {
      const el = this.doc.querySelector(selector);
      if (!el) return null;
      return {
        tagName: el.tagName,
        getAttribute: (name: string) => el.getAttribute(name),
        textContent: el.textContent || "",
      };
    } catch {
      return null;
    }
  }
}

// ================================================================
// Check Registry — central definition of all checks
// ================================================================

export const CHECK_REGISTRY: Record<string, QACheck> = {
  // FAIL-level (17)
  F01: { id: "F01", name: "H1 present", severity: "fail", rule: "Exactly 1 <h1>", category: "structure" },
  F02: { id: "F02", name: "Heading hierarchy", severity: "fail", rule: "No skips, no H4–H6", category: "structure" },
  F03: { id: "F03", name: "Executive summary", severity: "fail", rule: "Present, 25–40 words", category: "metadata" },
  F04: { id: "F04", name: "Meta title", severity: "fail", rule: "50–60 characters", category: "metadata" },
  F05: { id: "F05", name: "Meta description", severity: "fail", rule: "150–160 characters", category: "metadata" },
  F06: { id: "F06", name: "Word count", severity: "fail", rule: "Hub≥2500, Spoke≥1200, News≥600", category: "content" },
  F07: { id: "F07", name: "Internal links min", severity: "fail", rule: "Hub≥8, Spoke≥5, News≥3", category: "links" },
  F08: { id: "F08", name: "Core page links", severity: "fail", rule: "Hub≥4, Spoke≥3, News≥2", category: "links" },
  F09: { id: "F09", name: "External links min", severity: "fail", rule: "Hub≥5, Spoke≥3, News≥2", category: "links" },
  F10: { id: "F10", name: "BlogPosting schema", severity: "fail", rule: "Required fields present", category: "schema" },
  F11: { id: "F11", name: "Hero image alt", severity: "fail", rule: "Non-empty, descriptive alt text", category: "images" },
  F12: { id: "F12", name: "No blank alt", severity: "fail", rule: "Every <img> has alt", category: "images" },
  F13: { id: "F13", name: "Author byline", severity: "fail", rule: "Name + credentials", category: "schema" },
  F14: { id: "F14", name: "Publication date", severity: "fail", rule: "Valid ISO 8601", category: "schema" },
  F15: { id: "F15", name: "Prohibited anchor text", severity: "fail", rule: "No generic anchors", category: "links" },
  F16: { id: "F16", name: "Internal links valid", severity: "fail", rule: "All in registry (deferred)", category: "links" },
  F17: { id: "F17", name: "Canonical URL", severity: "fail", rule: "bhutanwine.com domain", category: "schema" },

  // WARN-level (26)
  W01: { id: "W01", name: "H1 length", severity: "warn", rule: "50–65 chars", category: "structure" },
  W02: { id: "W02", name: "H2 count range", severity: "warn", rule: "Hub 5–8, Spoke 3–5, News 2–3", category: "structure" },
  W03: { id: "W03", name: "Duplicate headings", severity: "warn", rule: "No identical text", category: "structure" },
  W04: { id: "W04", name: "Meta title ≠ H1", severity: "warn", rule: "Similar but not identical", category: "metadata" },
  W05: { id: "W05", name: "Slug length", severity: "warn", rule: "3–6 words", category: "metadata" },
  W06: { id: "W06", name: "Spoke → parent hub", severity: "warn", rule: "At least 1", category: "links" },
  W07: { id: "W07", name: "Sibling spoke links", severity: "warn", rule: "1–2", category: "links" },
  W08: { id: "W08", name: "Cross-cluster link", severity: "warn", rule: "At least 1", category: "links" },
  W09: { id: "W09", name: "Anchor text length", severity: "warn", rule: "3–8 words", category: "links" },
  W10: { id: "W10", name: "External target=_blank", severity: "warn", rule: "All external links", category: "links" },
  W11: { id: "W11", name: "No competitor links", severity: "warn", rule: "No winery storefronts", category: "links" },
  W12: { id: "W12", name: "External link spread", severity: "warn", rule: "≥3 sections", category: "links" },
  W13: { id: "W13", name: "Source trust tiers", severity: "warn", rule: "≥1 primary source", category: "links" },
  W14: { id: "W14", name: "Image count min", severity: "warn", rule: "Hub≥5, Spoke≥3, News≥1", category: "images" },
  W15: { id: "W15", name: "Visual spacing", severity: "warn", rule: "≤400 words between images", category: "images" },
  W16: { id: "W16", name: "Alt text length", severity: "warn", rule: "10–25 words informative", category: "images" },
  W17: { id: "W17", name: "Captions on locations", severity: "warn", rule: "Informative images", category: "images" },
  W18: { id: "W18", name: "FAQPage schema sync", severity: "warn", rule: "Present iff FAQ exists", category: "schema" },
  W19: { id: "W19", name: "data-nosnippet", severity: "warn", rule: "Pricing/legal content", category: "schema" },
  W20: { id: "W20", name: "Hero image perf", severity: "warn", rule: "eager + high priority", category: "images" },
  W21: { id: "W21", name: "Image dimensions", severity: "warn", rule: "width + height on all", category: "images" },
  W22: { id: "W22", name: "No hardcoded data", severity: "warn", rule: "No $XXX or XX.X%", category: "content" },
  W23: { id: "W23", name: "Banned superlatives", severity: "warn", rule: "No 'best winery' etc.", category: "content" },
  W24: { id: "W24", name: "Main entity placement", severity: "warn", rule: "H1, summary, meta, first 100w", category: "content" },
  W25: { id: "W25", name: "Reading level", severity: "warn", rule: "FK Grade 10–14", category: "readability" },
  W26: { id: "W26", name: "Citable paragraphs", severity: "warn", rule: "≥3 standalone", category: "content" },
};

// ================================================================
// Helper: create a QAResult
// ================================================================

export function createResult(
  check: QACheck,
  passed: boolean,
  message: string,
  elementPath: string | null,
  fixSuggestion: string | null
): QAResult {
  return {
    check,
    passed,
    score: passed ? 1 : check.severity === "fail" ? 0 : 0.5,
    message,
    elementPath,
    fixSuggestion,
  };
}

// ================================================================
// Validation → QAResult mapping
// ================================================================

/** Map a validation error path to a QA check ID */
function mapPathToCheckId(path: string): string {
  if (path === "executiveSummary") return "F03";
  if (path === "metaTitle") return "F04";
  if (path === "metaDescription") return "F05";
  if (path === "sections" && path.includes("H2")) return "W02";
  if (path.includes("headingLevel")) return "F02";
  if (path === "sections") return "F06";
  if (path === "internalLinks") return "F07";
  if (path === "externalLinks") return "F09";
  if (path === "schema.blogPosting") return "F10";
  if (path === "schema.faqPage") return "W18";
  if (path === "author") return "F13";
  if (path === "publishDate") return "F14";
  if (path === "modifiedDate") return "F14";
  if (path === "canonicalUrl") return "F17";
  if (path.includes(".alt")) return "F12";
  if (path.includes("width/height")) return "W21";
  return "F02"; // fallback
}

/** Map a validation error path to an element path for highlighting */
function mapPathToElementPath(path: string): string | null {
  if (path === "executiveSummary") return '[data-cad-path="executiveSummary"]';
  if (path === "metaTitle") return null;
  if (path === "metaDescription") return null;
  if (path.startsWith("sections[")) return `[data-cad-path="${path.replace(/\.headingLevel$/, ".heading")}"]`;
  if (path.startsWith("heroImage")) return "figure:first-of-type";
  return null;
}

/** Generate fix suggestion text for a check */
function generateFixSuggestion(checkId: string, message: string): string | null {
  const suggestions: Record<string, string> = {
    F02: "Fix heading hierarchy: use only H1, H2, H3 in order.",
    F03: "Rewrite the executive summary to be 25–40 words.",
    F04: "Adjust the meta title to be 50–60 characters.",
    F05: "Adjust the meta description to be 150–160 characters.",
    F06: "Add more content to meet the word count minimum.",
    F07: "Add more internal links to meet the minimum.",
    F08: "Add more core page links (bhutanwine.com pages).",
    F09: "Add more external source links.",
    F10: "Enable BlogPosting schema markup.",
    F11: "Add descriptive alt text to the hero image.",
    F12: "Add alt text to all images.",
    F13: "Add author name and credentials.",
    F14: "Add a valid publication date.",
    F17: "Set the canonical URL to start with https://www.bhutanwine.com/.",
    W02: "Adjust the number of H2 sections.",
  };
  return suggestions[checkId] ? `${suggestions[checkId]} ${message}` : null;
}

// ================================================================
// Main QA Engine
// ================================================================

/**
 * Run all QA checks against a canonical document and its rendered HTML.
 * This is the main entry point — call from client (with BrowserDomAdapter)
 * or from server (with CheerioDomAdapter).
 */
export function runQAChecks(
  doc: CanonicalArticleDocument,
  html: string,
  dom: DomAdapter
): QAScore {
  const allResults: QAResult[] = [];
  const coveredCheckIds = new Set<string>();

  // 1. Run existing validateCanonicalDocument and map results
  const validation = validateCanonicalDocument(doc);
  for (const err of validation.errors) {
    const checkId = mapPathToCheckId(err.path);
    if (!coveredCheckIds.has(checkId)) {
      coveredCheckIds.add(checkId);
      const check = CHECK_REGISTRY[checkId];
      if (check) {
        allResults.push(
          createResult(
            check,
            false,
            err.message,
            mapPathToElementPath(err.path),
            generateFixSuggestion(checkId, err.message)
          )
        );
      }
    }
  }
  for (const warn of validation.warnings) {
    allResults.push(
      createResult(
        CHECK_REGISTRY.W09,
        false,
        warn,
        null,
        null
      )
    );
    coveredCheckIds.add("W09");
  }

  // Mark validation-covered checks as passed if no error was found
  const validationCheckIds = [
    "F03", "F04", "F05", "F06", "F07", "F08", "F09",
    "F10", "F11", "F12", "F13", "F14", "F17", "W02", "W09", "W18",
  ];
  for (const id of validationCheckIds) {
    if (!coveredCheckIds.has(id) && CHECK_REGISTRY[id]) {
      coveredCheckIds.add(id);
      allResults.push(
        createResult(CHECK_REGISTRY[id], true, `${CHECK_REGISTRY[id].name}: passed`, null, null)
      );
    }
  }

  // 2. Run additional check modules (skip checks already covered)
  const structureResults = runStructureChecks(doc, dom);
  const metadataResults = runMetadataChecks(doc);
  const linkResults = runLinkChecks(doc, dom);
  const imageResults = runImageChecks(doc, dom);
  const contentResults = runContentChecks(doc);
  const schemaResults = runSchemaChecks(doc, dom);

  // Add results, skipping any check IDs already covered by validation mapping
  for (const result of [
    ...structureResults,
    ...metadataResults,
    ...linkResults,
    ...imageResults,
    ...contentResults,
    ...schemaResults,
  ]) {
    if (!coveredCheckIds.has(result.check.id)) {
      coveredCheckIds.add(result.check.id);
      allResults.push(result);
    }
  }

  // 3. Readability check (W25)
  if (!coveredCheckIds.has("W25")) {
    const allText = collectPlainText(doc);
    const fkGrade = fleschKincaidGrade(allText);
    const w25Passed = fkGrade >= 10 && fkGrade <= 14;
    allResults.push(
      createResult(
        CHECK_REGISTRY.W25,
        w25Passed,
        w25Passed
          ? `Flesch-Kincaid Grade: ${fkGrade} (target: 10–14)`
          : `Flesch-Kincaid Grade: ${fkGrade} (target: 10–14) — ${fkGrade < 10 ? "too simple" : "too complex"}`,
        null,
        !w25Passed
          ? fkGrade < 10
            ? "Increase sentence complexity and vocabulary to reach Grade 10+ reading level."
            : "Simplify some sentences to bring reading level below Grade 14."
          : null
      )
    );
  }

  // 4. F16 placeholder (deferred to Guide 11 — always passes for now)
  if (!coveredCheckIds.has("F16")) {
    allResults.push(
      createResult(
        CHECK_REGISTRY.F16,
        true,
        "Internal link validation deferred to finalization (Guide 11)",
        null,
        null
      )
    );
  }

  // 5. Calculate score
  const total = allResults.reduce((sum, r) => sum + r.score, 0);
  const possible = allResults.length;
  const failCount = allResults.filter((r) => !r.passed && r.check.severity === "fail").length;
  const warnCount = allResults.filter((r) => !r.passed && r.check.severity === "warn").length;
  const passCount = allResults.filter((r) => r.passed).length;

  return {
    total,
    possible,
    failCount,
    warnCount,
    passCount,
    results: allResults,
    canFinalize: failCount === 0,
  };
}

/** Collect all plain text from the document for readability analysis */
function collectPlainText(doc: CanonicalArticleDocument): string {
  const parts: string[] = [doc.executiveSummary];
  for (const section of doc.sections) {
    for (const node of section.content) {
      switch (node.type) {
        case "paragraph":
        case "pullQuote":
        case "callout":
          parts.push(node.text);
          break;
        case "list":
          parts.push(...node.items);
          break;
      }
    }
  }
  return parts.join(" ").replace(/<[^>]*>/g, "");
}
