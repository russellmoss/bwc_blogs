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

  if (wasValid) {
    return { repaired: preCheck.data as unknown as CanonicalArticleDocument, changes, valid: true };
  }

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

  // 2. articleType — must be "hub"|"spoke"|"news"
  const validTypes = ["hub", "spoke", "news"];
  if (!validTypes.includes(d.articleType as string)) {
    // Try to infer from `article` wrapper or other fields
    if (typeof d.article === "object" && d.article !== null) {
      const art = d.article as Record<string, unknown>;
      if (validTypes.includes(art.articleType as string)) {
        d.articleType = art.articleType;
      } else if (validTypes.includes(art.type as string)) {
        d.articleType = art.type;
      }
    }
    // Still missing — default to "hub"
    if (!validTypes.includes(d.articleType as string)) {
      d.articleType = "hub";
      changes.push('Set missing articleType to "hub"');
    }
  }
  // Clean up `article` wrapper if present
  delete d.article;

  // 3. Missing optional arrays
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

  // 4. Missing optional nullable fields
  if (!("heroImage" in d) || d.heroImage === undefined) {
    d.heroImage = null;
    changes.push("Set missing heroImage to null");
  }
  if (!("hubId" in d) || d.hubId === undefined) {
    d.hubId = null;
    changes.push("Set missing hubId to null");
  }

  // 5. Missing dates
  const now = new Date().toISOString();
  if (!d.publishDate || typeof d.publishDate !== "string") {
    d.publishDate = now;
    changes.push("Set missing publishDate");
  }
  if (!d.modifiedDate || typeof d.modifiedDate !== "string") {
    d.modifiedDate = now;
    changes.push("Set missing modifiedDate");
  }

  // 6. Missing ctaType
  if (!d.ctaType || typeof d.ctaType !== "string") {
    d.ctaType = "newsletter";
    changes.push('Set missing ctaType to "newsletter"');
  }

  // 7. Missing canonicalUrl
  if (!d.canonicalUrl || typeof d.canonicalUrl !== "string") {
    d.canonicalUrl = `https://www.bhutanwine.com/blog/${d.slug || "article"}`;
    changes.push("Generated canonicalUrl from slug");
  }

  // 8. Author — fill missing sub-fields
  if (typeof d.author === "object" && d.author !== null) {
    const a = d.author as Record<string, unknown>;
    if (typeof a.bio !== "string") {
      a.bio = "";
      changes.push("Set missing author.bio to empty string");
    }
    if (typeof a.linkedinUrl !== "string" && a.linkedinUrl !== null) {
      a.linkedinUrl = null;
      changes.push("Set missing author.linkedinUrl to null");
    }
    if (typeof a.credentials !== "string" || (a.credentials as string).length === 0) {
      a.credentials = "Contributing Writer";
      changes.push('Set missing author.credentials to "Contributing Writer"');
    }
    if (typeof a.name !== "string" || (a.name as string).length === 0) {
      a.name = "BWC Editorial";
      changes.push('Set missing author.name to "BWC Editorial"');
    }

    // Extract embedded <a> tags from author.name (Claude sometimes bakes HTML into the field)
    if (typeof a.name === "string") {
      const linkMatch = (a.name as string).match(/<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (linkMatch) {
        const [, href, text] = linkMatch;
        if (!a.linkedinUrl && href) {
          a.linkedinUrl = href;
          changes.push(`Extracted linkedinUrl from author.name HTML: "${href}"`);
        }
        a.name = text.trim() || "BWC Editorial";
        changes.push(`Stripped HTML from author.name, extracted: "${a.name}"`);
      } else {
        // Strip any remaining HTML tags from name
        const stripped = (a.name as string).replace(/<[^>]+>/g, "").trim();
        if (stripped !== a.name) {
          a.name = stripped || "BWC Editorial";
          changes.push(`Stripped HTML tags from author.name: "${a.name}"`);
        }
      }
    }
  } else {
    d.author = { name: "BWC Editorial", credentials: "Contributing Writer", bio: "", linkedinUrl: null };
    changes.push("Set missing author to default");
  }

  // 9. Missing required string fields (must be non-empty for Zod .min(1))
  if (!d.slug || typeof d.slug !== "string") {
    d.slug = d.title
      ? String(d.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : "article";
    changes.push("Generated missing slug from title");
  }
  if (!d.metaTitle || typeof d.metaTitle !== "string") {
    d.metaTitle = typeof d.title === "string" ? String(d.title).slice(0, 60) : "Article";
    changes.push("Set missing metaTitle from title");
  }
  if (!d.metaDescription || typeof d.metaDescription !== "string") {
    d.metaDescription = typeof d.executiveSummary === "string"
      ? String(d.executiveSummary).slice(0, 160)
      : "Read this article from Bhutan Wine Company.";
    changes.push("Set missing metaDescription");
  }
  if (!d.executiveSummary || typeof d.executiveSummary !== "string") {
    d.executiveSummary = typeof d.metaDescription === "string"
      ? String(d.metaDescription)
      : "Discover insights from Bhutan Wine Company in this comprehensive article.";
    changes.push("Set missing executiveSummary");
  }

  // Now update canonicalUrl if it was generated before slug repair
  if (d.canonicalUrl === `https://www.bhutanwine.com/blog/article` && d.slug !== "article") {
    d.canonicalUrl = `https://www.bhutanwine.com/blog/${d.slug}`;
  }

  // 10. Schema flags missing or incomplete
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
    if (typeof s.blogPosting !== "boolean") s.blogPosting = true;
    if (typeof s.faqPage !== "boolean") {
      const faqArr = d.faq as unknown[];
      s.faqPage = Array.isArray(faqArr) && faqArr.length > 0;
    }
    if (typeof s.product !== "boolean") s.product = false;
  }

  // 10. Repair internal links — convert strings to objects, fill missing sub-fields
  if (Array.isArray(d.internalLinks)) {
    // Convert bare string URLs to link objects
    d.internalLinks = (d.internalLinks as unknown[]).map((item) => {
      if (typeof item === "string") {
        changes.push(`Converted string internal link to object: "${item}"`);
        // Extract a reasonable anchor text from the URL path
        const path = item.replace(/^https?:\/\/[^/]+/, "").replace(/[/-]/g, " ").trim();
        const anchor = path || "Learn more about Bhutan wine";
        return {
          targetUrl: item,
          anchorText: anchor,
          targetArticleId: null,
          targetCorePage: null,
          linkType: "contextual",
          sectionId: "section-1",
        };
      }
      return item;
    });

    let repaired = 0;
    for (const link of d.internalLinks as Record<string, unknown>[]) {
      if (typeof link !== "object" || link === null) continue;

      // Map alternate field names
      if (!link.targetUrl && link.url) { link.targetUrl = link.url; delete link.url; }
      if (!link.targetUrl && link.href) { link.targetUrl = link.href; delete link.href; }

      // Fill defaults for nullable/required fields
      if (link.targetArticleId === undefined) link.targetArticleId = null;
      if (link.targetCorePage === undefined) link.targetCorePage = null;
      if (!link.linkType) link.linkType = "contextual";
      if (!link.sectionId) link.sectionId = "section-1";
      repaired++;
    }
    if (repaired > 0) changes.push(`Repaired ${repaired} internal link(s) with missing fields`);

    // Filter out links missing required fields (and any remaining non-objects)
    const before = (d.internalLinks as unknown[]).length;
    d.internalLinks = (d.internalLinks as unknown[]).filter((item) => {
      if (typeof item !== "object" || item === null) return false;
      const l = item as Record<string, unknown>;
      return typeof l.targetUrl === "string" && (l.targetUrl as string).length > 0 &&
             typeof l.anchorText === "string" && (l.anchorText as string).length > 0;
    });
    const removed = before - (d.internalLinks as unknown[]).length;
    if (removed > 0) changes.push(`Removed ${removed} malformed internal link(s)`);
  }

  // 11. Repair external links — convert strings to objects, fill missing fields, normalize trustTier
  if (Array.isArray(d.externalLinks)) {
    // Convert bare string URLs to link objects
    d.externalLinks = (d.externalLinks as unknown[]).map((item) => {
      if (typeof item === "string") {
        changes.push(`Converted string external link to object: "${item}"`);
        try {
          const hostname = new URL(item).hostname.replace("www.", "");
          return {
            url: item,
            anchorText: hostname,
            trustTier: "general",
            sourceName: hostname,
            sectionId: "section-1",
          };
        } catch {
          return {
            url: item,
            anchorText: item,
            trustTier: "general",
            sourceName: "",
            sectionId: "section-1",
          };
        }
      }
      return item;
    });

    const validTiers = ["primary", "authority", "niche_expert", "general"];
    let repaired = 0;
    for (const link of d.externalLinks as Record<string, unknown>[]) {
      if (typeof link !== "object" || link === null) continue;

      // Map alternate field names
      if (!link.url && link.href) { link.url = link.href; delete link.href; }

      // Normalize trustTier
      if (!validTiers.includes(link.trustTier as string)) {
        const tier = String(link.trustTier || "").toLowerCase().replace(/[\s-]/g, "_");
        if (tier.includes("primary")) link.trustTier = "primary";
        else if (tier.includes("authority") || tier.includes("authoritative")) link.trustTier = "authority";
        else if (tier.includes("niche") || tier.includes("expert")) link.trustTier = "niche_expert";
        else link.trustTier = "general";
      }

      if (!link.sectionId) link.sectionId = "section-1";
      if (!link.sourceName) link.sourceName = "";
      repaired++;
    }
    if (repaired > 0) changes.push(`Repaired ${repaired} external link(s) with missing fields`);

    const before = (d.externalLinks as unknown[]).length;
    d.externalLinks = (d.externalLinks as unknown[]).filter((item) => {
      if (typeof item !== "object" || item === null) return false;
      const l = item as Record<string, unknown>;
      return typeof l.url === "string" && (l.url as string).length > 0 &&
             typeof l.anchorText === "string" && (l.anchorText as string).length > 0;
    });
    const removed = before - (d.externalLinks as unknown[]).length;
    if (removed > 0) changes.push(`Removed ${removed} malformed external link(s)`);
  }

  // 12. Repair sections — fill missing id, heading, headingLevel, content
  if (Array.isArray(d.sections)) {
    for (let i = 0; i < (d.sections as Record<string, unknown>[]).length; i++) {
      const section = (d.sections as Record<string, unknown>[])[i];
      if (!section.id || typeof section.id !== "string") {
        section.id = `section-${i + 1}`;
        changes.push(`Generated missing section ID: "${section.id}"`);
      }
      if (typeof section.heading !== "string" || (section.heading as string).trim().length === 0) {
        section.heading = `Section ${i + 1}`;
        changes.push(`Set null/missing heading for section "${section.id}" to "${section.heading}"`);
      }
      if (typeof section.headingLevel !== "number" || section.headingLevel < 2 || section.headingLevel > 3) {
        section.headingLevel = 2;
      }
      if (!Array.isArray(section.content)) {
        section.content = [];
        changes.push(`Set missing content array for section "${section.id}"`);
      }
    }

    // 12b. Duplicate section IDs
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

    // 13. Missing content node IDs
    for (const section of d.sections as Record<string, unknown>[]) {
      if (Array.isArray(section.content)) {
        const nodes = section.content as Record<string, unknown>[];
        for (let i = 0; i < nodes.length; i++) {
          if (!nodes[i].id || typeof nodes[i].id !== "string") {
            nodes[i].id = `${section.id}-node-${i}`;
            changes.push(`Generated missing node ID: "${nodes[i].id}"`);
          }
        }
      }
    }

    // 14. Remove content nodes with empty required text fields
    for (const section of d.sections as Record<string, unknown>[]) {
      if (Array.isArray(section.content)) {
        const before = (section.content as unknown[]).length;
        section.content = (section.content as Record<string, unknown>[]).filter((node) => {
          const t = node.type as string;
          // Nodes that require non-empty text: paragraph, pullQuote, callout, keyFacts
          if ((t === "paragraph" || t === "pullQuote" || t === "callout") &&
              (typeof node.text !== "string" || (node.text as string).trim().length === 0)) {
            return false;
          }
          // keyFacts requires non-empty title
          if (t === "keyFacts" && (typeof node.title !== "string" || (node.title as string).trim().length === 0)) {
            return false;
          }
          // list requires non-empty items array
          if (t === "list" && (!Array.isArray(node.items) || (node.items as unknown[]).length === 0)) {
            return false;
          }
          return true;
        });
        const removed = before - (section.content as unknown[]).length;
        if (removed > 0) {
          changes.push(`Removed ${removed} empty content node(s) from section "${section.id}"`);
        }
      }
    }

  }

  // Re-parse after repairs
  const postCheck = CanonicalArticleDocumentSchema.safeParse(d);
  if (!postCheck.success) {
    console.error("[repair] Zod validation failed after repairs. Issues:");
    for (const issue of postCheck.error.issues) {
      console.error(`  [${issue.path.join(".")}] ${issue.message} (${issue.code})`);
    }
    throw new Error("RENDER_ERROR");
  }

  console.log(`[repair] Successfully repaired document with ${changes.length} changes`);

  return {
    repaired: postCheck.data as unknown as CanonicalArticleDocument,
    changes,
    valid: wasValid,
  };
}
