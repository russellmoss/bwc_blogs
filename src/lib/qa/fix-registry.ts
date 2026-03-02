import type { CanonicalArticleDocument } from "@/types/article";
import type {
  FixTier,
  FixRegistryEntry,
  DeterministicFixResult,
} from "@/types/qa-fix";

// ================================================================
// Deterministic Fix Functions (Tier 1)
// Each returns mutations or null if it can't confidently fix.
// ================================================================

/** F04: Meta title too long → trim to 60 chars at word boundary; too short → null (needs AI) */
function fixMetaTitle(doc: CanonicalArticleDocument): DeterministicFixResult | null {
  const len = doc.metaTitle.length;
  if (len >= 50 && len <= 60) return null; // already valid

  if (len > 60) {
    // Trim at word boundary, append ellipsis if needed
    let trimmed = doc.metaTitle.slice(0, 59);
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace > 40) trimmed = trimmed.slice(0, lastSpace);
    // Ensure within range
    if (trimmed.length < 50) return null; // can't trim safely
    return {
      mutations: [{ cadPath: "metaTitle", value: trimmed }],
      summary: `Trimmed meta title from ${len} to ${trimmed.length} chars`,
    };
  }

  // Too short — can't add meaningful content deterministically
  return null;
}

/** F05: Meta description too long → trim at word boundary; too short → null */
function fixMetaDescription(doc: CanonicalArticleDocument): DeterministicFixResult | null {
  const len = doc.metaDescription.length;
  if (len >= 150 && len <= 160) return null;

  if (len > 160) {
    let trimmed = doc.metaDescription.slice(0, 159);
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace > 140) trimmed = trimmed.slice(0, lastSpace);
    if (trimmed.length < 150) return null;
    return {
      mutations: [{ cadPath: "metaDescription", value: trimmed }],
      summary: `Trimmed meta description from ${len} to ${trimmed.length} chars`,
    };
  }

  return null;
}

/** F10: BlogPosting schema flag missing → set to true */
function fixBlogPostingSchema(doc: CanonicalArticleDocument): DeterministicFixResult | null {
  if (doc.schema.blogPosting) return null;
  return {
    mutations: [{ cadPath: "schema.blogPosting", value: true }],
    summary: "Enabled BlogPosting schema flag",
  };
}

/** F14: Publication date invalid → set to today's ISO date */
function fixPublicationDate(doc: CanonicalArticleDocument): DeterministicFixResult | null {
  const mutations: DeterministicFixResult["mutations"] = [];
  const summaryParts: string[] = [];

  if (isNaN(Date.parse(doc.publishDate))) {
    const today = new Date().toISOString().split("T")[0];
    mutations.push({ cadPath: "publishDate", value: today });
    summaryParts.push("Set publishDate to today");
  }
  if (isNaN(Date.parse(doc.modifiedDate))) {
    const today = new Date().toISOString().split("T")[0];
    mutations.push({ cadPath: "modifiedDate", value: today });
    summaryParts.push("Set modifiedDate to today");
  }

  if (mutations.length === 0) return null;
  return { mutations, summary: summaryParts.join("; ") };
}

/** F17: Canonical URL missing bhutanwine.com domain → construct from slug */
function fixCanonicalUrl(doc: CanonicalArticleDocument): DeterministicFixResult | null {
  if (doc.canonicalUrl.startsWith("https://www.bhutanwine.com/")) return null;
  const slug = doc.slug || "untitled";
  const url = `https://www.bhutanwine.com/post/${slug}`;
  return {
    mutations: [{ cadPath: "canonicalUrl", value: url }],
    summary: `Set canonical URL to ${url}`,
  };
}

/** W04: Meta title = H1 → append " | Bhutan Wine Company" to meta title */
function fixMetaTitleNotH1(doc: CanonicalArticleDocument): DeterministicFixResult | null {
  if (doc.metaTitle !== doc.title) return null;
  const suffix = " | Bhutan Wine Company";
  let newTitle = doc.metaTitle + suffix;
  // If too long, trim the original part
  if (newTitle.length > 60) {
    const maxBase = 60 - suffix.length;
    let base = doc.metaTitle.slice(0, maxBase);
    const lastSpace = base.lastIndexOf(" ");
    if (lastSpace > 20) base = base.slice(0, lastSpace);
    newTitle = base + suffix;
  }
  if (newTitle.length < 50 || newTitle.length > 60) return null; // can't fit in range
  return {
    mutations: [{ cadPath: "metaTitle", value: newTitle }],
    summary: `Differentiated meta title from H1 (${newTitle.length} chars)`,
  };
}

/** W05: Slug too long → truncate to 6 words */
function fixSlugLength(doc: CanonicalArticleDocument): DeterministicFixResult | null {
  const words = doc.slug.split("-");
  if (words.length >= 3 && words.length <= 6) return null;

  if (words.length > 6) {
    const shortened = words.slice(0, 6).join("-");
    return {
      mutations: [{ cadPath: "slug", value: shortened }],
      summary: `Shortened slug from ${words.length} to 6 words`,
    };
  }

  // Too short — can't add meaningful words deterministically
  return null;
}

/** W18: FAQPage schema flag out of sync → sync with FAQ array presence */
function fixFaqPageSchemaSync(doc: CanonicalArticleDocument): DeterministicFixResult | null {
  const hasFaq = doc.faq.length > 0;
  if (doc.schema.faqPage === hasFaq) return null;
  return {
    mutations: [{ cadPath: "schema.faqPage", value: hasFaq }],
    summary: hasFaq
      ? "Enabled FAQPage schema (FAQ section present)"
      : "Disabled FAQPage schema (no FAQ section)",
  };
}

// ================================================================
// Fix Registry — maps every check ID to a tier
// ================================================================

const FIX_REGISTRY: Record<string, FixRegistryEntry> = {
  // FAIL-level — Tier 1 (deterministic)
  F04: { tier: 1, fix: fixMetaTitle },
  F05: { tier: 1, fix: fixMetaDescription },
  F10: { tier: 1, fix: fixBlogPostingSchema },
  F14: { tier: 1, fix: fixPublicationDate },
  F17: { tier: 1, fix: fixCanonicalUrl },

  // FAIL-level — Tier 2 (Claude-assisted)
  F01: { tier: 2, claudePromptTemplate: "The article's H1 comes from the 'title' field. If it's empty, write a compelling 50-65 character title. If section content contains duplicate H1-level headings in inline HTML, remove them. Return the 'title' field (and 'sections' if inline HTML was changed)." },
  F02: { tier: 2, claudePromptTemplate: "Fix heading hierarchy in the sections array. Each section has a 'headingLevel' (2 or 3). Ensure no section uses level 4-6, and levels don't skip (e.g. a level-3 section must follow a level-2 section). Adjust headingLevel values and reorganize sections as needed. Return the full 'sections' array." },
  F03: { tier: 2, claudePromptTemplate: "Rewrite the 'executiveSummary' field to be exactly 25-40 words. It should be a compelling, concise summary of the article's key point. Return just the 'executiveSummary' field." },
  F06: { tier: 2, claudePromptTemplate: "Fix the section/word count issue. If there are too many H2 sections (headingLevel: 2), consolidate related sections by merging their content under fewer headings — combine the content arrays and pick the best heading. If word count is too low, expand existing section paragraphs with more detail and substance. Check the 'Current' note for whether it's a section count or word count problem. Return the full 'sections' array." },
  F07: { tier: 2, claudePromptTemplate: "Add more internal links to bhutanwine.com/post/* blog articles. Add entries to the internalLinks array with targetUrl, anchorText (3-8 words), linkType (e.g. 'spoke-to-hub', 'hub-to-spoke'), sectionId matching an existing section, targetArticleId: null, and targetCorePage: null. Distribute across multiple sections. Return the full 'internalLinks' array. Check the 'Current' note for the count shortfall." },
  F08: { tier: 2, claudePromptTemplate: "Add more core page links — links to main bhutanwine.com site pages (NOT blog posts). Examples: shop, about-us, tours, wine-tasting, contact. Each link needs: targetUrl (e.g. 'https://www.bhutanwine.com/shop'), targetCorePage set to the page path (e.g. 'shop'), linkType: 'to-core-page', targetArticleId: null, and a sectionId. Return the full 'internalLinks' array. Check the 'Current' note for the count shortfall." },
  F09: { tier: 2, claudePromptTemplate: "Add more external source links to authoritative domains. Good sources: government tourism sites, wine authorities (OIV, Wine Institute), academic/research institutions, major publications (Decanter, Wine Spectator). Each needs: url, anchorText (3-8 words), trustTier ('primary' for govt/academic, 'authority' for major pubs), sourceName, and sectionId. Spread across 3+ sections. Return the full 'externalLinks' array." },
  F11: { tier: 2, claudePromptTemplate: "Set the heroImage.alt field to descriptive text (10-25 words) that describes the image content for accessibility. Also ensure heroImage.classification is 'informative'. Return the 'heroImage' object." },
  F12: { tier: 2, claudePromptTemplate: "Find images in sections[].content where type='image' and placement.alt is empty or missing. Write descriptive alt text (10-25 words) for each. Set classification to 'informative' for content images or 'decorative' (with alt='') for decorative ones. Return the full 'sections' array." },
  F13: { tier: 2, claudePromptTemplate: "Set the 'author' object fields: 'name' should be a plausible wine/travel writer name, 'credentials' should describe relevant expertise (e.g. 'Certified Sommelier & Himalayan Travel Writer'), and 'bio' should be a 2-3 sentence professional bio. Return the 'author' object." },
  F15: { tier: 2, claudePromptTemplate: "Find links in internalLinks and externalLinks arrays where anchorText is generic ('click here', 'read more', 'learn more', 'link', 'here'). Replace each with descriptive 3-8 word anchor text that describes the destination. Return the full 'internalLinks' and/or 'externalLinks' arrays." },
  F16: { tier: 2, claudePromptTemplate: "Review all internal link URLs in the internalLinks array. Ensure each targetUrl follows the format 'https://www.bhutanwine.com/post/slug-here'. Remove any links with broken or invalid URLs. Return the full 'internalLinks' array." },

  // WARN-level — Tier 1 (deterministic)
  W04: { tier: 1, fix: fixMetaTitleNotH1 },
  W05: { tier: 1, fix: fixSlugLength },
  W18: { tier: 1, fix: fixFaqPageSchemaSync },

  // WARN-level — Tier 2 (Claude-assisted)
  W01: { tier: 2, claudePromptTemplate: "Rewrite the 'title' field to be 50-65 characters. Keep the same topic and keywords but adjust length. Return just the 'title' field. Check the 'Current' note for the actual character count." },
  W02: { tier: 2, claudePromptTemplate: "Adjust the number of H2 sections (headingLevel: 2) to match the range: Hub 5-8, Spoke 3-5, News 2-3. If too many, consolidate related sections by merging their content arrays under fewer headings. If too few, split a large section into focused subtopics. Return the full 'sections' array. Check the 'Current' note for specifics." },
  W03: { tier: 2, claudePromptTemplate: "Find sections with identical heading text and rewrite them to be unique while keeping them relevant to their content. Return the full 'sections' array. Check the 'Current' note for which heading is duplicated." },
  W06: { tier: 2, claudePromptTemplate: "Add an internal link from this spoke article to its parent hub. Create an entry in internalLinks with linkType: 'spoke-to-hub' and the hub article's URL. If the document has a hubId, use it as targetArticleId. Return the full 'internalLinks' array." },
  W07: { tier: 2, claudePromptTemplate: "Add 1-2 internal links to sibling spoke articles (articles in the same hub cluster). Each link needs linkType: 'spoke-to-sibling', a targetUrl to bhutanwine.com/post/*, and 3-8 word anchorText. Return the full 'internalLinks' array." },
  W08: { tier: 2, claudePromptTemplate: "Add at least one cross-cluster internal link — a link to an article in a different hub topic. Set linkType: 'cross-cluster', targetUrl to bhutanwine.com/post/*, and 3-8 word anchorText. Return the full 'internalLinks' array." },
  W09: { tier: 2, claudePromptTemplate: "Find links in internalLinks and externalLinks where anchorText is fewer than 3 words or more than 8 words. Rewrite the anchorText to be 3-8 descriptive words. Return the full 'internalLinks' and/or 'externalLinks' arrays." },
  W10: { tier: 2, claudePromptTemplate: "Find external <a> tags in section paragraph text (sections[].content[].text) that are missing target=\"_blank\". Add target=\"_blank\" rel=\"noopener noreferrer\" to each external link. Return the full 'sections' array." },
  W11: { tier: 2, claudePromptTemplate: "Remove entries from externalLinks that point to competitor winery storefronts (wine.com, vivino.com, totalwine.com, drizly.com, etc.). Also remove any corresponding <a> tags from section paragraph text. Return the updated 'externalLinks' array (and 'sections' if inline HTML was changed)." },
  W12: { tier: 2, claudePromptTemplate: "Redistribute external links so they span at least 3 different sections. Move some externalLinks entries to different sectionIds, and update the corresponding <a> tags in section paragraph text to match. Return the updated 'externalLinks' and 'sections' arrays." },
  W13: { tier: 2, claudePromptTemplate: "Add at least one external link with trustTier: 'primary' — this means a government, academic, or official industry body source. Examples: tourism.gov.bt, OIV.int, university research. Return the full 'externalLinks' array." },
  W14: { tier: 2, claudePromptTemplate: "Add image content nodes to sections to meet the minimum image count. Insert { type: 'image', placement: { photoId: null, src: 'PLACEHOLDER', alt: 'descriptive 10-25 words', caption: 'brief caption', classification: 'informative', width: 800, height: 533 } } into section content arrays. The user will replace PLACEHOLDER src with real Cloudinary URLs. Return the full 'sections' array." },
  W15: { tier: 2, claudePromptTemplate: "There are too many consecutive words without a visual break. Insert an image content node (with src: 'PLACEHOLDER' — user will add real URL) into a section that has a long text gap. The user will replace PLACEHOLDER with a real image. Return the full 'sections' array." },
  W16: { tier: 2, claudePromptTemplate: "Find images in heroImage and sections[].content where placement.alt is too short (< 10 words) or too long (> 25 words). Rewrite each alt to be 10-25 descriptive words. Return the 'heroImage' and/or 'sections' as needed." },
  W17: { tier: 2, claudePromptTemplate: "Find image content nodes in sections where placement.classification is 'informative' but placement.caption is null or empty. Write a brief, informative caption for each. Return the full 'sections' array." },
  W19: { tier: 2, claudePromptTemplate: "Identify sections containing pricing ($), legal disclaimers, or liability content. Add those section IDs (e.g. 'section-3') to the 'dataNosnippetSections' array. Return just the 'dataNosnippetSections' field." },
  W20: { tier: 2, claudePromptTemplate: "The renderer automatically adds loading='eager' and fetchpriority='high' to the hero image. If this check failed, ensure 'heroImage' is not null and is properly structured with all required fields (photoId, src, alt, caption, classification, width, height). Return the 'heroImage' object." },
  W21: { tier: 2, claudePromptTemplate: "Find images in heroImage and sections[].content where placement.width or placement.height is null. Set reasonable dimensions (e.g. width: 1200, height: 800 for hero; width: 800, height: 533 for inline). Return the 'heroImage' and/or 'sections' as needed." },
  W22: { tier: 2, claudePromptTemplate: "Find hardcoded dollar amounts ($XXX) and percentages (XX.X%) in section paragraph text and replace them with contextually appropriate, verified-sounding values or rephrase to avoid specific numbers. Return the full 'sections' array. Check the 'Current' note for which values were found." },
  W23: { tier: 2, claudePromptTemplate: "Find and remove or rephrase banned superlatives in section text: 'best winery', 'finest wines', 'greatest wine', 'most exclusive', 'unmatched quality', 'world\\'s best', etc. Replace with specific, provable claims. Return the full 'sections' array. Check the 'Current' note for which phrase was found." },
  W24: { tier: 2, claudePromptTemplate: "The main entity (key topic from the title) must appear in 4 positions: title, executiveSummary, metaTitle, and first 100 words of the first section. Check which positions are missing from the 'Current' note and weave the entity naturally into those fields. Return only the fields you changed." },
  W25: { tier: 2, claudePromptTemplate: "Adjust the reading level to Flesch-Kincaid Grade 10-14. If the grade is too high, simplify sentence structure and use shorter words. If too low, use more sophisticated vocabulary and longer sentences. Modify paragraph text in the 'sections' array. Return the full 'sections' array." },
  W26: { tier: 2, claudePromptTemplate: "Add standalone factual paragraphs (30+ words, no embedded <a> links) to sections. These 'citable' paragraphs should contain concrete facts, statistics, or descriptions that search engines can extract as featured snippets. You need at least 3 total. Return the full 'sections' array." },
};

// ================================================================
// Public API
// ================================================================

/** Get the fix tier for a check ID. Returns 2 (Claude) for unknown checks. */
export function getFixTier(checkId: string): FixTier {
  return FIX_REGISTRY[checkId]?.tier ?? 2;
}

/** Get the full registry entry for a check ID */
export function getFixEntry(checkId: string): FixRegistryEntry | null {
  return FIX_REGISTRY[checkId] ?? null;
}

/** Get the Claude prompt template for a Tier 2 check */
export function getClaudePromptTemplate(checkId: string): string | null {
  return FIX_REGISTRY[checkId]?.claudePromptTemplate ?? null;
}
