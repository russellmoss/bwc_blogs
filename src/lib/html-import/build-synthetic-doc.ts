/**
 * Builds a minimal valid CanonicalArticleDocument from extracted HTML metadata
 * and a ContentMapEntry. Used by the HTML Import feature.
 */

import type { CanonicalArticleDocument, ArticleSection, InternalLinkRef, ExternalLinkRef } from "@/types/article";
import type { ContentMapEntry } from "@/types/content-map";
import type { ExtractedMetadata } from "./extract-metadata";

export function buildSyntheticDocument(
  metadata: ExtractedMetadata,
  contentMapEntry: ContentMapEntry
): CanonicalArticleDocument {
  const now = new Date().toISOString();

  // Build sections from extracted headings, or a single placeholder section
  const sections: ArticleSection[] = metadata.sections.length > 0
    ? metadata.sections.map((s, i) => ({
        id: `section-${i + 1}`,
        heading: s.heading,
        headingLevel: s.level,
        content: [{
          type: "paragraph" as const,
          id: `p-${i + 1}-1`,
          text: "(Imported section — content rendered from HTML)",
        }],
      }))
    : [{
        id: "section-1",
        heading: "Introduction",
        headingLevel: 2 as const,
        content: [{
          type: "paragraph" as const,
          id: "p-1-1",
          text: "(Imported article — content rendered from HTML)",
        }],
      }];

  // Map extracted internal links
  const internalLinks: InternalLinkRef[] = metadata.internalLinks.map((link, i) => ({
    targetUrl: link.url,
    targetArticleId: null,
    targetCorePage: null,
    anchorText: link.anchorText,
    linkType: "contextual",
    sectionId: sections[Math.min(i, sections.length - 1)]?.id || "section-1",
  }));

  // Map extracted external links
  const externalLinks: ExternalLinkRef[] = metadata.externalLinks.map((link, i) => ({
    url: link.url,
    anchorText: link.anchorText,
    trustTier: "general" as const,
    sourceName: extractDomain(link.url),
    sectionId: sections[Math.min(i, sections.length - 1)]?.id || "section-1",
  }));

  // Build canonical URL from content map or extraction
  const canonicalUrl = metadata.canonicalUrl
    || (contentMapEntry.slug
      ? `https://www.bhutanwine.com/post/${contentMapEntry.slug}`
      : `https://www.bhutanwine.com/post/${contentMapEntry.id}`);

  const doc: CanonicalArticleDocument = {
    version: "1.0-import",
    articleId: contentMapEntry.id,
    slug: contentMapEntry.slug || `article-${contentMapEntry.id}`,
    articleType: contentMapEntry.articleType,
    hubId: contentMapEntry.parentHubId,
    title: metadata.title || contentMapEntry.title,
    metaTitle: truncate(metadata.metaTitle || metadata.title || contentMapEntry.title, 60),
    metaDescription: truncate(
      metadata.metaDescription || `${contentMapEntry.title} — Bhutan Wine Company`,
      160
    ),
    canonicalUrl,
    publishDate: metadata.publishDate || now,
    modifiedDate: now,
    author: {
      name: metadata.authorName || contentMapEntry.authorName || "BWC Editorial",
      credentials: metadata.authorCredentials || "Bhutan Wine Company",
      bio: "",
      linkedinUrl: null,
    },
    executiveSummary: buildExecutiveSummary(metadata, contentMapEntry),
    heroImage: metadata.heroImageSrc
      ? {
          photoId: null,
          cloudinaryPublicId: null,
          src: metadata.heroImageSrc,
          alt: metadata.heroImageAlt || contentMapEntry.title,
          caption: null,
          classification: "informative",
          width: null,
          height: null,
        }
      : null,
    sections,
    faq: metadata.faqItems.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),
    internalLinks,
    externalLinks,
    ctaType: "newsletter",
    captureComponents: ["newsletter"],
    schema: {
      blogPosting: true,
      faqPage: metadata.faqItems.length > 0,
      product: false,
    },
    dataNosnippetSections: [],
  };

  return doc;
}

/** Truncate string to a max length, adding ellipsis if needed */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

/** Extract domain from URL for sourceName */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

/** Build a 25–40 word executive summary from metadata */
function buildExecutiveSummary(metadata: ExtractedMetadata, entry: ContentMapEntry): string {
  // Try meta description first — it's usually a good summary
  if (metadata.metaDescription) {
    const words = metadata.metaDescription.split(/\s+/);
    if (words.length >= 25 && words.length <= 40) {
      return metadata.metaDescription;
    }
    if (words.length > 40) {
      return words.slice(0, 35).join(" ") + ".";
    }
  }
  // Fallback: generate from title + main entity
  return `This article explores ${entry.mainEntity} as covered in "${metadata.title || entry.title}." Published by Bhutan Wine Company, it provides expert insights for wine enthusiasts and curious travelers.`;
}
