import type { CanonicalArticleDocument } from "@/types/article";
import type { ValidationResult } from "@/types/api";
import { CanonicalArticleDocumentSchema } from "./schema";

/** Count words in a text string (strip HTML tags first) */
export function countWords(text: string): number {
  const stripped = text.replace(/<[^>]*>/g, "").trim();
  if (!stripped) return 0;
  return stripped.split(/\s+/).length;
}

/** Count total words across all text content in the document */
export function countDocumentWords(doc: CanonicalArticleDocument): number {
  let total = 0;

  // Executive summary
  total += countWords(doc.executiveSummary);

  // All sections
  for (const section of doc.sections) {
    total += countWords(section.heading);
    for (const node of section.content) {
      switch (node.type) {
        case "paragraph":
          total += countWords(node.text);
          break;
        case "pullQuote":
          total += countWords(node.text);
          break;
        case "keyFacts":
          for (const fact of node.facts) {
            total += countWords(fact.label) + countWords(fact.value);
          }
          break;
        case "table":
          for (const row of node.rows) {
            for (const cell of row) {
              total += countWords(cell);
            }
          }
          break;
        case "list":
          for (const item of node.items) {
            total += countWords(item);
          }
          break;
        case "callout":
          total += countWords(node.text);
          break;
      }
    }
  }

  // FAQ
  for (const faq of doc.faq) {
    total += countWords(faq.question) + countWords(faq.answer);
  }

  return total;
}

/**
 * Validate a CanonicalArticleDocument with strict Zod schema + SOP FAIL-level checks.
 * Returns ValidationResult with errors (FAIL) and warnings (WARN).
 */
export function validateCanonicalDocument(doc: unknown): ValidationResult {
  const errors: { path: string; message: string }[] = [];
  const warnings: string[] = [];

  // 1. Zod structural validation
  const parsed = CanonicalArticleDocumentSchema.safeParse(doc);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        path: issue.path.join("."),
        message: issue.message,
      });
    }
    return { valid: false, errors, warnings };
  }

  const d = parsed.data;

  // 2. SOP FAIL-level checks (from exploration-results.md Appendix C)

  // --- Structure checks ---

  // Executive summary length: 25-40 words
  const execWords = countWords(d.executiveSummary);
  if (execWords < 25 || execWords > 40) {
    errors.push({
      path: "executiveSummary",
      message: `Executive summary must be 25-40 words, got ${execWords}`,
    });
  }

  // Meta title length: 50-60 characters
  if (d.metaTitle.length < 50 || d.metaTitle.length > 60) {
    errors.push({
      path: "metaTitle",
      message: `Meta title must be 50-60 characters, got ${d.metaTitle.length}`,
    });
  }

  // Meta description length: 150-160 characters
  if (d.metaDescription.length < 150 || d.metaDescription.length > 160) {
    errors.push({
      path: "metaDescription",
      message: `Meta description must be 150-160 characters, got ${d.metaDescription.length}`,
    });
  }

  // H2 count by article type
  const h2Count = d.sections.filter((s) => s.headingLevel === 2).length;
  const h2Ranges: Record<string, [number, number]> = {
    hub: [5, 8],
    spoke: [3, 5],
    news: [2, 3],
  };
  const [h2Min, h2Max] = h2Ranges[d.articleType] || [2, 8];
  if (h2Count < h2Min || h2Count > h2Max) {
    errors.push({
      path: "sections",
      message: `${d.articleType} articles need ${h2Min}-${h2Max} H2 sections, got ${h2Count}`,
    });
  }

  // Heading hierarchy: H3 must not appear before any H2
  let hasSeenH2 = false;
  for (let i = 0; i < d.sections.length; i++) {
    const s = d.sections[i];
    if (s.headingLevel === 2) hasSeenH2 = true;
    if (s.headingLevel === 3 && !hasSeenH2) {
      errors.push({
        path: `sections[${i}].headingLevel`,
        message: "H3 appears before any H2 — heading hierarchy violation",
      });
    }
  }

  // --- Volume checks ---

  // Word count minimum
  const wordCount = countDocumentWords(d);
  const wordMins: Record<string, number> = {
    hub: 2500,
    spoke: 1200,
    news: 600,
  };
  const wordMin = wordMins[d.articleType] || 600;
  if (wordCount < wordMin) {
    errors.push({
      path: "sections",
      message: `${d.articleType} articles need >= ${wordMin} words, got ${wordCount}`,
    });
  }

  // Internal link minimum
  const ilMins: Record<string, number> = { hub: 8, spoke: 5, news: 3 };
  const ilMin = ilMins[d.articleType] || 3;
  if (d.internalLinks.length < ilMin) {
    errors.push({
      path: "internalLinks",
      message: `${d.articleType} articles need >= ${ilMin} internal links, got ${d.internalLinks.length}`,
    });
  }

  // External link minimum
  const elMins: Record<string, number> = { hub: 5, spoke: 3, news: 2 };
  const elMin = elMins[d.articleType] || 2;
  if (d.externalLinks.length < elMin) {
    errors.push({
      path: "externalLinks",
      message: `${d.articleType} articles need >= ${elMin} external links, got ${d.externalLinks.length}`,
    });
  }

  // Core page links: at least 3
  const corePageLinks = d.internalLinks.filter(
    (l) => l.targetCorePage !== null
  ).length;
  if (corePageLinks < 3) {
    errors.push({
      path: "internalLinks",
      message: `Need >= 3 core page links, got ${corePageLinks}`,
    });
  }

  // --- Image & Accessibility checks ---

  // All images: check alt text and dimensions
  const allImages: { placement: typeof d.heroImage; path: string }[] = [];
  if (d.heroImage) {
    allImages.push({ placement: d.heroImage, path: "heroImage" });
  }
  for (let si = 0; si < d.sections.length; si++) {
    for (let ci = 0; ci < d.sections[si].content.length; ci++) {
      const node = d.sections[si].content[ci];
      if (node.type === "image") {
        allImages.push({
          placement: node.placement,
          path: `sections[${si}].content[${ci}].placement`,
        });
      }
    }
  }

  for (const { placement, path } of allImages) {
    if (!placement) continue;
    // Dimensions required
    if (placement.width === null || placement.height === null) {
      errors.push({
        path: `${path}.width/height`,
        message: "Image must have explicit width and height",
      });
    }
    // Alt text rules
    if (placement.classification === "informative") {
      const altWords = countWords(placement.alt);
      if (altWords < 10 || altWords > 25) {
        errors.push({
          path: `${path}.alt`,
          message: `Informative image alt must be 10-25 words, got ${altWords}`,
        });
      }
    }
    if (placement.classification === "decorative" && placement.alt !== "") {
      errors.push({
        path: `${path}.alt`,
        message: 'Decorative image alt must be empty string ""',
      });
    }
  }

  // --- Schema & Metadata checks ---

  // BlogPosting must be true
  if (!d.schema.blogPosting) {
    errors.push({
      path: "schema.blogPosting",
      message: "BlogPosting schema must be true on every article",
    });
  }

  // FAQPage sync
  if (d.faq.length > 0 && !d.schema.faqPage) {
    errors.push({
      path: "schema.faqPage",
      message: "faqPage must be true when faq array is non-empty",
    });
  }
  if (d.faq.length === 0 && d.schema.faqPage) {
    errors.push({
      path: "schema.faqPage",
      message: "faqPage must be false when faq array is empty",
    });
  }

  // Author present
  if (!d.author.name || !d.author.credentials) {
    errors.push({
      path: "author",
      message: "Author name and credentials are required",
    });
  }

  // Dates must be valid ISO 8601
  if (isNaN(Date.parse(d.publishDate))) {
    errors.push({
      path: "publishDate",
      message: "publishDate must be a valid ISO 8601 date",
    });
  }
  if (isNaN(Date.parse(d.modifiedDate))) {
    errors.push({
      path: "modifiedDate",
      message: "modifiedDate must be a valid ISO 8601 date",
    });
  }

  // Canonical URL must start with https://www.bhutanwine.com/
  if (!d.canonicalUrl.startsWith("https://www.bhutanwine.com/")) {
    errors.push({
      path: "canonicalUrl",
      message:
        'canonicalUrl must start with "https://www.bhutanwine.com/"',
    });
  }

  // --- WARN-level checks (don't block, but surface) ---

  // Generic anchor text
  const genericAnchors = ["click here", "read more", "learn more"];
  for (const link of d.internalLinks) {
    if (genericAnchors.includes(link.anchorText.toLowerCase())) {
      warnings.push(
        `Internal link "${link.anchorText}" uses generic anchor text`
      );
    }
    const anchorWords = countWords(link.anchorText);
    if (anchorWords < 3 || anchorWords > 8) {
      warnings.push(
        `Internal link anchor "${link.anchorText}" should be 3-8 words (got ${anchorWords})`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
