/**
 * HTML metadata extraction for the Import HTML feature.
 *
 * Two adapters: cheerio (server-side) and DOMParser (client-side).
 * Both produce the same ExtractedMetadata shape.
 */

export interface ExtractedMetadata {
  title: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  publishDate: string | null;
  authorName: string | null;
  authorCredentials: string | null;
  schemaJson: Record<string, unknown> | null;
  faqItems: { question: string; answer: string }[];
  sections: { heading: string; level: 2 | 3 }[];
  heroImageSrc: string | null;
  heroImageAlt: string | null;
  internalLinks: { url: string; anchorText: string }[];
  externalLinks: { url: string; anchorText: string }[];
  wordCount: number;
  extractionCoverage: string[];
}

// ================================================================
// Adapter interface — abstracts DOM access for extraction logic
// ================================================================

interface ExtractorAdapter {
  getTitle(): string | null;
  getMetaContent(name: string): string | null;
  getCanonicalUrl(): string | null;
  getH1Text(): string | null;
  getHeadings(): { text: string; level: number }[];
  getFirstImage(): { src: string | null; alt: string | null } | null;
  getLinks(): { href: string; text: string }[];
  getBodyText(): string;
  getScriptJsonLd(): string[];
}

// ================================================================
// Shared extraction logic
// ================================================================

const BWC_DOMAIN = "bhutanwine.com";

function extractFromAdapter(adapter: ExtractorAdapter): ExtractedMetadata {
  const coverage: string[] = [];

  // Title
  const h1 = adapter.getH1Text();
  const titleTag = adapter.getTitle();
  const title = h1 || titleTag || null;
  if (title) coverage.push("title");

  // Meta
  const metaTitle = adapter.getMetaContent("og:title")
    || adapter.getTitle()
    || null;
  if (metaTitle) coverage.push("metaTitle");

  const metaDescription = adapter.getMetaContent("description")
    || adapter.getMetaContent("og:description")
    || null;
  if (metaDescription) coverage.push("metaDescription");

  // Canonical
  const canonicalUrl = adapter.getCanonicalUrl() || null;
  if (canonicalUrl) coverage.push("canonicalUrl");

  // Dates — try article:published_time, then schema
  const publishDate = adapter.getMetaContent("article:published_time") || null;
  if (publishDate) coverage.push("publishDate");

  // Author — try meta author
  const authorName = adapter.getMetaContent("author") || null;
  if (authorName) coverage.push("authorName");

  // Schema JSON-LD
  let schemaJson: Record<string, unknown> | null = null;
  let authorCredentials: string | null = null;
  const faqItems: { question: string; answer: string }[] = [];

  for (const script of adapter.getScriptJsonLd()) {
    try {
      const parsed = JSON.parse(script);
      if (parsed["@type"] === "BlogPosting" || parsed["@type"] === "Article") {
        schemaJson = parsed;
        if (!publishDate && parsed.datePublished) {
          coverage.push("publishDate");
        }
        if (parsed.author) {
          const author = Array.isArray(parsed.author) ? parsed.author[0] : parsed.author;
          if (author?.name && !authorName) coverage.push("authorName");
          if (author?.jobTitle) {
            authorCredentials = author.jobTitle;
            coverage.push("authorCredentials");
          }
        }
      }
      if (parsed["@type"] === "FAQPage" && Array.isArray(parsed.mainEntity)) {
        for (const entity of parsed.mainEntity) {
          if (entity["@type"] === "Question" && entity.acceptedAnswer) {
            faqItems.push({
              question: entity.name || "",
              answer: entity.acceptedAnswer.text || "",
            });
          }
        }
        if (faqItems.length > 0) coverage.push("faqItems");
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  // Sections from headings
  const headings = adapter.getHeadings();
  const sections: { heading: string; level: 2 | 3 }[] = [];
  for (const h of headings) {
    if (h.level === 2 || h.level === 3) {
      sections.push({ heading: h.text, level: h.level as 2 | 3 });
    }
  }
  if (sections.length > 0) coverage.push("sections");

  // Hero image
  const firstImg = adapter.getFirstImage();
  const heroImageSrc = firstImg?.src || null;
  const heroImageAlt = firstImg?.alt || null;
  if (heroImageSrc) coverage.push("heroImage");

  // Links
  const allLinks = adapter.getLinks();
  const internalLinks: { url: string; anchorText: string }[] = [];
  const externalLinks: { url: string; anchorText: string }[] = [];

  for (const link of allLinks) {
    if (!link.href || link.href.startsWith("#") || link.href.startsWith("mailto:")) continue;
    const text = link.text.trim();
    if (!text) continue;

    if (link.href.includes(BWC_DOMAIN)) {
      internalLinks.push({ url: link.href, anchorText: text });
    } else if (link.href.startsWith("http")) {
      externalLinks.push({ url: link.href, anchorText: text });
    }
  }
  if (internalLinks.length > 0) coverage.push("internalLinks");
  if (externalLinks.length > 0) coverage.push("externalLinks");

  // Word count
  const bodyText = adapter.getBodyText();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  coverage.push("wordCount");

  return {
    title,
    metaTitle,
    metaDescription,
    canonicalUrl,
    publishDate: publishDate
      || (schemaJson as Record<string, unknown> | null)?.["datePublished"] as string
      || null,
    authorName: authorName
      || ((schemaJson as Record<string, unknown> | null)?.["author"] as Record<string, unknown> | undefined)?.["name"] as string
      || null,
    authorCredentials,
    schemaJson,
    faqItems,
    sections,
    heroImageSrc,
    heroImageAlt,
    internalLinks,
    externalLinks,
    wordCount,
    extractionCoverage: coverage,
  };
}

// ================================================================
// Browser adapter (DOMParser) — for client-side usage
// ================================================================

class BrowserExtractorAdapter implements ExtractorAdapter {
  private doc: Document;

  constructor(html: string) {
    this.doc = new DOMParser().parseFromString(html, "text/html");
  }

  getTitle(): string | null {
    return this.doc.querySelector("title")?.textContent?.trim() || null;
  }

  getMetaContent(name: string): string | null {
    const el = this.doc.querySelector(`meta[name="${name}"]`)
      || this.doc.querySelector(`meta[property="${name}"]`);
    return el?.getAttribute("content") || null;
  }

  getCanonicalUrl(): string | null {
    return this.doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || null;
  }

  getH1Text(): string | null {
    return this.doc.querySelector("h1")?.textContent?.trim() || null;
  }

  getHeadings(): { text: string; level: number }[] {
    const results: { text: string; level: number }[] = [];
    this.doc.querySelectorAll("h1, h2, h3").forEach((el) => {
      const level = parseInt(el.tagName.charAt(1), 10);
      results.push({ text: el.textContent?.trim() || "", level });
    });
    return results;
  }

  getFirstImage(): { src: string | null; alt: string | null } | null {
    const img = this.doc.querySelector("img");
    if (!img) return null;
    return { src: img.getAttribute("src"), alt: img.getAttribute("alt") };
  }

  getLinks(): { href: string; text: string }[] {
    const results: { href: string; text: string }[] = [];
    this.doc.querySelectorAll("a[href]").forEach((el) => {
      results.push({
        href: el.getAttribute("href") || "",
        text: el.textContent?.trim() || "",
      });
    });
    return results;
  }

  getBodyText(): string {
    return this.doc.body?.textContent || "";
  }

  getScriptJsonLd(): string[] {
    const results: string[] = [];
    this.doc.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      if (el.textContent) results.push(el.textContent);
    });
    return results;
  }
}

// ================================================================
// Server adapter (cheerio) — for API route usage
// ================================================================

class CheerioExtractorAdapter implements ExtractorAdapter {
  private $: import("cheerio").CheerioAPI;

  constructor($: import("cheerio").CheerioAPI) {
    this.$ = $;
  }

  getTitle(): string | null {
    return this.$("title").first().text().trim() || null;
  }

  getMetaContent(name: string): string | null {
    const el = this.$(`meta[name="${name}"]`).first();
    if (el.length) return el.attr("content") || null;
    const prop = this.$(`meta[property="${name}"]`).first();
    if (prop.length) return prop.attr("content") || null;
    return null;
  }

  getCanonicalUrl(): string | null {
    return this.$('link[rel="canonical"]').first().attr("href") || null;
  }

  getH1Text(): string | null {
    return this.$("h1").first().text().trim() || null;
  }

  getHeadings(): { text: string; level: number }[] {
    const results: { text: string; level: number }[] = [];
    this.$("h1, h2, h3").each((_, el) => {
      const tag = (el as import("domhandler").Element).tagName;
      const level = parseInt(tag.charAt(1), 10);
      results.push({ text: this.$(el).text().trim(), level });
    });
    return results;
  }

  getFirstImage(): { src: string | null; alt: string | null } | null {
    const img = this.$("img").first();
    if (!img.length) return null;
    return { src: img.attr("src") || null, alt: img.attr("alt") || null };
  }

  getLinks(): { href: string; text: string }[] {
    const results: { href: string; text: string }[] = [];
    this.$("a[href]").each((_, el) => {
      results.push({
        href: this.$(el).attr("href") || "",
        text: this.$(el).text().trim(),
      });
    });
    return results;
  }

  getBodyText(): string {
    return this.$("body").text();
  }

  getScriptJsonLd(): string[] {
    const results: string[] = [];
    this.$('script[type="application/ld+json"]').each((_, el) => {
      const text = this.$(el).text();
      if (text) results.push(text);
    });
    return results;
  }
}

// ================================================================
// Public API
// ================================================================

/** Client-side extraction using DOMParser */
export function extractMetadataFromHtmlBrowser(html: string): ExtractedMetadata {
  const adapter = new BrowserExtractorAdapter(html);
  return extractFromAdapter(adapter);
}

/** Server-side extraction using cheerio */
export async function extractMetadataFromHtmlServer(html: string): Promise<ExtractedMetadata> {
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);
  const adapter = new CheerioExtractorAdapter($);
  return extractFromAdapter(adapter);
}
