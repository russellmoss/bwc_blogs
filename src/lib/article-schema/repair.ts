import type { CanonicalArticleDocument } from "@/types/article";
import { CanonicalArticleDocumentSchema } from "./schema";

/**
 * Attempt to repair a potentially malformed CanonicalArticleDocument.
 * Returns the repaired document, a list of human-readable changes, and
 * whether the input was valid BEFORE repairs.
 */
export function repairCanonicalDocument(doc: unknown): {
  repaired: CanonicalArticleDocument;
  changes: string[];
  valid: boolean;
} {
  const changes: string[] = [];

  // Check if already valid
  const preCheck = CanonicalArticleDocumentSchema.safeParse(doc);
  const wasValid = preCheck.success;

  if (typeof doc !== "object" || doc === null) {
    throw new Error("RENDER_ERROR");
  }

  // Work on a mutable copy
  const d = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  // 1. Missing version
  if (!d.version || typeof d.version !== "string") {
    d.version = "1.0";
    changes.push('Set missing version to "1.0"');
  }

  // 2. Missing optional arrays
  const arrayFields = [
    "faq",
    "internalLinks",
    "externalLinks",
    "captureComponents",
    "dataNosnippetSections",
  ];
  for (const field of arrayFields) {
    if (!Array.isArray(d[field])) {
      d[field] = [];
      changes.push(`Set missing ${field} to []`);
    }
  }

  // 3. Missing optional nullable fields
  if (!("heroImage" in d) || d.heroImage === undefined) {
    d.heroImage = null;
    changes.push("Set missing heroImage to null");
  }
  if (!("hubId" in d) || d.hubId === undefined) {
    d.hubId = null;
    changes.push("Set missing hubId to null");
  }

  // 4. Schema flags missing or incomplete
  if (typeof d.schema !== "object" || d.schema === null) {
    const faqArr = d.faq as unknown[];
    d.schema = {
      blogPosting: true,
      faqPage: Array.isArray(faqArr) && faqArr.length > 0,
      product: false,
    };
    changes.push("Set missing schema flags to defaults");
  } else {
    const s = d.schema as Record<string, unknown>;
    if (typeof s.blogPosting !== "boolean") {
      s.blogPosting = true;
      changes.push("Set schema.blogPosting to true");
    }
    if (typeof s.faqPage !== "boolean") {
      const faqArr = d.faq as unknown[];
      s.faqPage = Array.isArray(faqArr) && faqArr.length > 0;
      changes.push(`Set schema.faqPage to ${s.faqPage}`);
    }
    if (typeof s.product !== "boolean") {
      s.product = false;
      changes.push("Set schema.product to false");
    }
  }

  // 5. Duplicate section IDs
  if (Array.isArray(d.sections)) {
    const sectionIds = new Set<string>();
    for (const section of d.sections as Record<string, unknown>[]) {
      if (typeof section.id === "string") {
        let id = section.id;
        let counter = 2;
        while (sectionIds.has(id)) {
          id = `${section.id}-${counter}`;
          counter++;
        }
        if (id !== section.id) {
          changes.push(`Renamed duplicate section ID "${section.id}" to "${id}"`);
          section.id = id;
        }
        sectionIds.add(id);
      }
    }

    // 6. Missing content node IDs
    for (const section of d.sections as Record<string, unknown>[]) {
      if (Array.isArray(section.content)) {
        const nodes = section.content as Record<string, unknown>[];
        for (let i = 0; i < nodes.length; i++) {
          if (!nodes[i].id || typeof nodes[i].id !== "string") {
            nodes[i].id = `${section.id}-node-${i}`;
            changes.push(
              `Generated missing node ID: "${nodes[i].id}"`
            );
          }
        }
      }
    }

    // 7. headingLevel out of range — clamp to 2 or 3
    for (const section of d.sections as Record<string, unknown>[]) {
      const level = section.headingLevel;
      if (typeof level === "number" && (level < 2 || level > 3)) {
        section.headingLevel = level < 2 ? 2 : 3;
        changes.push(
          `Clamped headingLevel ${level} to ${section.headingLevel}`
        );
      }
    }
  }

  // 8. Remove malformed link entries (missing required fields)
  if (Array.isArray(d.internalLinks)) {
    const before = (d.internalLinks as unknown[]).length;
    d.internalLinks = (d.internalLinks as Record<string, unknown>[]).filter(
      (l) =>
        typeof l.targetUrl === "string" &&
        l.targetUrl.length > 0 &&
        typeof l.anchorText === "string" &&
        l.anchorText.length > 0
    );
    const removed = before - (d.internalLinks as unknown[]).length;
    if (removed > 0) {
      changes.push(`Removed ${removed} malformed internal link(s)`);
    }
  }

  if (Array.isArray(d.externalLinks)) {
    const before = (d.externalLinks as unknown[]).length;
    d.externalLinks = (d.externalLinks as Record<string, unknown>[]).filter(
      (l) =>
        typeof l.url === "string" &&
        l.url.length > 0 &&
        typeof l.anchorText === "string" &&
        l.anchorText.length > 0
    );
    const removed = before - (d.externalLinks as unknown[]).length;
    if (removed > 0) {
      changes.push(`Removed ${removed} malformed external link(s)`);
    }
  }

  // Re-parse after repairs
  const postCheck = CanonicalArticleDocumentSchema.safeParse(d);
  if (!postCheck.success) {
    // If still invalid after repairs, throw — the document is too broken
    throw new Error("RENDER_ERROR");
  }

  return {
    repaired: postCheck.data as unknown as CanonicalArticleDocument,
    changes,
    valid: wasValid,
  };
}
