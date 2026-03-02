import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import { CHECK_REGISTRY, createResult } from "../engine";

const HARDCODED_PATTERNS = [
  /\$\d[\d,]*\.?\d*/g,           // Dollar amounts: $XXX, $X,XXX.XX
  /\d+\.?\d*%/g,                 // Percentages: XX.X%
];

const BANNED_SUPERLATIVES = [
  "best winery", "finest wines", "greatest wine", "most exclusive",
  "unmatched quality", "world's best", "finest winery", "number one",
  "top-rated winery", "leading winery", "premium quality",
];

export function runContentChecks(
  doc: CanonicalArticleDocument
): QAResult[] {
  const results: QAResult[] = [];

  // Collect all text content for scanning
  const allText = collectAllText(doc);

  // W22: No hardcoded volatile data ($XXX, XX.X%)
  const hardcodedMatches: string[] = [];
  for (const pattern of HARDCODED_PATTERNS) {
    const matches = allText.match(pattern);
    if (matches) hardcodedMatches.push(...matches);
  }
  results.push(
    createResult(
      CHECK_REGISTRY.W22,
      hardcodedMatches.length === 0,
      hardcodedMatches.length === 0
        ? "No hardcoded volatile data found"
        : `Found ${hardcodedMatches.length} hardcoded value(s): ${hardcodedMatches.slice(0, 3).join(", ")}`,
      null,
      hardcodedMatches.length > 0
        ? `Replace hardcoded values (${hardcodedMatches[0]}) with data pulled from the knowledge base.`
        : null
    )
  );

  // W23: Banned superlatives
  const textLower = allText.toLowerCase();
  const foundSuperlatives = BANNED_SUPERLATIVES.filter((phrase) =>
    textLower.includes(phrase)
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W23,
      foundSuperlatives.length === 0,
      foundSuperlatives.length === 0
        ? "No banned superlatives found"
        : `Found banned phrase(s): "${foundSuperlatives[0]}"`,
      null,
      foundSuperlatives.length > 0
        ? `Remove or replace the superlative "${foundSuperlatives[0]}". Use specific, provable claims instead.`
        : null
    )
  );

  // W24: Main entity placement — should appear in H1, exec summary, meta title, first 100 words
  const entity = doc.title
    .split(/[\s—–:,|]+/)
    .slice(0, 3)
    .join(" ")
    .toLowerCase()
    .trim();
  const entityInH1 = doc.title.toLowerCase().includes(entity);
  const entityInExecSummary = doc.executiveSummary.toLowerCase().includes(entity);
  const entityInMeta = doc.metaTitle.toLowerCase().includes(entity);
  // First 100 words of body
  const firstSection = doc.sections[0];
  const firstContent = firstSection
    ? firstSection.content
        .filter((n) => n.type === "paragraph")
        .map((n) => (n as { type: "paragraph"; text: string }).text)
        .join(" ")
        .split(/\s+/)
        .slice(0, 100)
        .join(" ")
        .toLowerCase()
    : "";
  const entityInFirst100 = firstContent.includes(entity);
  const entityLocations = [entityInH1, entityInExecSummary, entityInMeta, entityInFirst100];
  const entityCount = entityLocations.filter(Boolean).length;
  results.push(
    createResult(
      CHECK_REGISTRY.W24,
      entityCount >= 3,
      entityCount >= 3
        ? `Main entity appears in ${entityCount}/4 required positions`
        : `Main entity only in ${entityCount}/4 positions (H1: ${entityInH1 ? "yes" : "no"}, Summary: ${entityInExecSummary ? "yes" : "no"}, Meta: ${entityInMeta ? "yes" : "no"}, First 100w: ${entityInFirst100 ? "yes" : "no"})`,
      null,
      entityCount < 3
        ? "Ensure the main entity appears in the H1, executive summary, meta title, and first 100 words."
        : null
    )
  );

  // W26: Citable paragraphs — ≥3 standalone factual paragraphs (30+ words, no links/quotes)
  let citableCount = 0;
  for (const section of doc.sections) {
    for (const node of section.content) {
      if (node.type === "paragraph") {
        const text = node.text.replace(/<[^>]*>/g, "").trim();
        const wordCount = text.split(/\s+/).length;
        const hasLink = /<a\s/i.test(node.text);
        if (wordCount >= 30 && !hasLink) {
          citableCount++;
        }
      }
    }
  }
  results.push(
    createResult(
      CHECK_REGISTRY.W26,
      citableCount >= 3,
      citableCount >= 3
        ? `${citableCount} citable paragraphs found (minimum: 3)`
        : `Only ${citableCount} citable paragraph(s) — need at least 3 standalone factual paragraphs (30+ words, no embedded links)`,
      null,
      citableCount < 3
        ? "Add more standalone factual paragraphs (30+ words, no embedded links) to improve citability."
        : null
    )
  );

  return results;
}

/** Collect all visible text from the canonical document */
function collectAllText(doc: CanonicalArticleDocument): string {
  const parts: string[] = [
    doc.title,
    doc.executiveSummary,
  ];
  for (const section of doc.sections) {
    parts.push(section.heading);
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
        case "keyFacts":
          for (const fact of node.facts) {
            parts.push(fact.label, fact.value);
          }
          break;
        case "table":
          for (const row of node.rows) {
            parts.push(...row);
          }
          break;
      }
    }
  }
  for (const faq of doc.faq) {
    parts.push(faq.question, faq.answer);
  }
  return parts.join(" ").replace(/<[^>]*>/g, "");
}
