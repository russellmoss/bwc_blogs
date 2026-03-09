import type { CanonicalArticleDocument } from "@/types/article";

export interface ParseResult {
  document: CanonicalArticleDocument | null;
  conversationReply: string;
  rawText: string;
  parseError: string | null;
}

/**
 * Attempts to extract a JSON CanonicalArticleDocument from Claude's response text.
 *
 * Claude may include conversational text before/after the JSON. This parser:
 * 1. Tries to parse the entire text as JSON
 * 2. Falls back to extracting JSON from markdown code fences
 * 3. Falls back to finding the outermost { ... } block
 *
 * After extraction, normalizes the shape if Claude used a `metadata` wrapper.
 */
export function parseGenerationResponse(rawText: string, articleId?: number, articleType?: string, textBlocks?: string[]): ParseResult {
  const trimmed = rawText.trim();
  let conversationReply = "";

  console.log("[streaming-parser] Raw text length:", trimmed.length);
  if (textBlocks) {
    console.log("[streaming-parser] Text blocks provided:", textBlocks.length, "sizes:", textBlocks.map(b => b.length));
  }

  if (!trimmed) {
    console.error("[streaming-parser] EMPTY response from Claude");
    return {
      document: null,
      conversationReply: "",
      rawText,
      parseError: "Claude returned an empty response",
    };
  }

  // Try to extract a JSON object using multiple strategies
  // First try the full concatenated text
  let extracted = extractJson(trimmed);

  // If that fails and we have multiple text blocks, try each block individually
  // (when Claude uses web_search, the JSON is typically in the last text block)
  if (!extracted && textBlocks && textBlocks.length > 1) {
    console.log("[streaming-parser] Full-text extraction failed, trying individual text blocks...");
    for (let i = textBlocks.length - 1; i >= 0; i--) {
      const block = textBlocks[i].trim();
      if (!block || block.indexOf("{") === -1) continue;
      console.log("[streaming-parser] Trying text block", i, "length:", block.length);
      extracted = extractJson(block);
      if (extracted) {
        // Gather conversation text from other blocks
        const otherBlocks = textBlocks.filter((_, idx) => idx !== i).map(b => b.trim()).filter(Boolean);
        if (otherBlocks.length > 0) {
          extracted.conversationReply = otherBlocks.join("\n\n");
        }
        console.log("[streaming-parser] Found JSON in text block", i);
        break;
      }
    }
  }

  if (!extracted) {
    console.error("[streaming-parser] No valid JSON object found in response");
    return {
      document: null,
      conversationReply: trimmed,
      rawText,
      parseError: `No valid JSON object found in ${trimmed.length} chars of response text.`,
    };
  }

  conversationReply = extracted.conversationReply;
  let obj = extracted.parsed;

  // Normalize: if Claude wrapped fields in a `metadata` object, flatten them up
  obj = normalizeDocument(obj, articleId, articleType);

  if (isCanonicalDoc(obj)) {
    console.log("[streaming-parser] SUCCESS — document extracted and validated");
    return { document: obj as CanonicalArticleDocument, conversationReply, rawText, parseError: null };
  }

  // Still not valid — report what's missing
  const doc = obj as Record<string, unknown>;
  const missing: string[] = [];
  if (typeof doc.title !== "string") missing.push("title");
  if (typeof doc.articleId !== "number") missing.push("articleId");
  if (!Array.isArray(doc.sections)) missing.push("sections");

  console.error("[streaming-parser] Document shape check failed. Missing:", missing, "Top-level keys:", Object.keys(doc).slice(0, 15));

  return {
    document: null,
    conversationReply: trimmed,
    rawText,
    parseError: `JSON extracted but missing required fields: ${missing.join(", ")}. Top-level keys: ${Object.keys(doc).slice(0, 10).join(", ")}`,
  };
}

/**
 * Tries 3 strategies to extract a JSON object from text.
 */
function extractJson(text: string): { parsed: Record<string, unknown>; conversationReply: string } | null {
  // Strategy 1: Entire text is JSON
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      console.log("[streaming-parser] Strategy 1: pure JSON, keys:", Object.keys(parsed).slice(0, 10));
      return { parsed, conversationReply: "" };
    }
  } catch {
    // Not pure JSON
  }

  // Strategy 2: Extract from markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const reply = text.replace(/```(?:json)?\s*\n?[\s\S]*?\n?```/, "").trim();
        console.log("[streaming-parser] Strategy 2: code fence, keys:", Object.keys(parsed).slice(0, 10));
        return { parsed, conversationReply: reply };
      }
    } catch {
      // fence content wasn't valid JSON
    }
  }

  // Strategy 3: Find outermost { ... } block
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const reply = (text.slice(0, firstBrace) + text.slice(lastBrace + 1)).trim();
        console.log("[streaming-parser] Strategy 3: outermost braces, keys:", Object.keys(parsed).slice(0, 10));
        return { parsed, conversationReply: reply };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("[streaming-parser] Strategy 3 JSON parse failed:", msg.slice(0, 200));
      // Check for truncation
      const opens = (candidate.match(/{/g) || []).length;
      const closes = (candidate.match(/}/g) || []).length;
      if (opens > closes) {
        console.error("[streaming-parser] JSON appears truncated: { count:", opens, "} count:", closes);
      }

      // Strategy 4: Attempt JSON repair on the candidate
      const repaired = repairJson(candidate);
      if (repaired !== candidate) {
        try {
          const parsed = JSON.parse(repaired);
          if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            const reply = (text.slice(0, firstBrace) + text.slice(lastBrace + 1)).trim();
            console.log("[streaming-parser] Strategy 4: repaired JSON, keys:", Object.keys(parsed).slice(0, 10));
            return { parsed, conversationReply: reply };
          }
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          console.log("[streaming-parser] Strategy 4 repair also failed:", msg2.slice(0, 200));
        }
      }
    }
  }

  return null;
}

/**
 * Attempts to repair common JSON issues in Claude's output:
 * - Unescaped control characters (newlines, tabs) inside string values
 * - Trailing commas before } or ]
 * - Single-quoted strings (rare but happens)
 *
 * Uses a character-by-character state machine to properly handle string boundaries.
 */
function repairJson(input: string): string {
  let result = "";
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (escapeNext) {
      escapeNext = false;
      result += ch;
      continue;
    }

    if (ch === "\\") {
      escapeNext = true;
      result += ch;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
        continue;
      }

      // We're inside a string and hit a quote — is this the end of the string?
      // Look ahead: if the next non-whitespace character is : , } ] or end-of-input,
      // this is likely the closing quote
      const rest = input.slice(i + 1);
      const nextSignificant = rest.match(/^\s*([,:\}\]\"])/);
      if (nextSignificant || rest.trim() === "") {
        inString = false;
        result += ch;
        continue;
      }

      // Otherwise this is an unescaped quote inside a string value — escape it
      result += '\\"';
      continue;
    }

    if (inString) {
      // Escape control characters that are invalid in JSON strings
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
      // Other control characters (U+0000 to U+001F)
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        result += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
      result += ch;
      continue;
    }

    result += ch;
  }

  // Fix trailing commas: ,} or ,]
  result = result.replace(/,(\s*[}\]])/g, "$1");

  return result;
}

/**
 * Normalizes Claude's JSON output into CanonicalArticleDocument shape.
 *
 * Claude sometimes wraps title/slug/meta fields in a `metadata` object instead
 * of placing them at the top level. This flattens that structure.
 */
function normalizeDocument(obj: Record<string, unknown>, articleId?: number, articleType?: string): Record<string, unknown> {
  // If the doc already has `title` and `articleId` at top level, it's fine
  if (typeof obj.title === "string" && typeof obj.articleId === "number") {
    return obj;
  }

  console.log("[streaming-parser] Normalizing document shape...");
  const result = { ...obj };

  // Flatten `article` wrapper FIRST — Claude sometimes nests the entire document under an `article` key
  // This must run before metadata flattening so nested metadata keys become top-level
  // Also handle `content`, `document`, `blogPost` wrappers
  const wrapperKeys = ["article", "content", "document", "blogPost", "post"];
  for (const wrapperKey of wrapperKeys) {
    if (typeof result[wrapperKey] === "object" && result[wrapperKey] !== null && !Array.isArray(result[wrapperKey])) {
      const inner = result[wrapperKey] as Record<string, unknown>;
      // Only flatten if the wrapper contains content-like keys (title, sections, slug, metadata, etc.)
      if (inner.title || inner.sections || inner.slug || inner.metadata) {
        console.log(`[streaming-parser] Flattening '${wrapperKey}' wrapper, keys:`, Object.keys(inner));
        for (const [key, value] of Object.entries(inner)) {
          if (!(key in result) || key === wrapperKey) {
            result[key] = value;
          }
        }
        delete result[wrapperKey];
      }
    }
  }

  // Flatten any metadata-like wrapper that contains `title`
  // Claude uses: `metadata`, `articleMetadata`, `seoMetadata`, `meta`, etc.
  // Runs AFTER wrapper flattening so { article: { metadata: { title } } } is handled
  const metadataKeys = Object.keys(result).filter((k) => {
    const lower = k.toLowerCase();
    if (lower !== "meta" && !lower.includes("metadata")) return false;
    const val = result[k];
    return typeof val === "object" && val !== null && !Array.isArray(val);
  });

  for (const metaKey of metadataKeys) {
    const meta = result[metaKey] as Record<string, unknown>;
    console.log(`[streaming-parser] Flattening '${metaKey}' keys:`, Object.keys(meta));
    for (const [key, value] of Object.entries(meta)) {
      // Don't override existing top-level keys (except the metadata key itself)
      if (!(key in result) || key === metaKey) {
        result[key] = value;
      }
    }
    delete result[metaKey];
  }

  // Map alternate field names Claude commonly uses.
  // Each entry: [canonical name, ...alternate names Claude might use]
  const fieldAliases: [string, ...string[]][] = [
    ["title", "blogTitle", "articleTitle", "postTitle", "headline"],
    ["articleId", "article_id"],
    ["articleType", "article_type", "type"],
    ["metaTitle", "meta_title"],
    ["metaDescription", "meta_description"],
    ["canonicalUrl", "canonical_url", "url"],
    ["publishDate", "publish_date", "datePublished", "date_published", "publicationDate"],
    ["modifiedDate", "modified_date", "dateModified", "date_modified", "lastModified"],
    ["heroImage", "hero_image", "hero"],
    ["executiveSummary", "executive_summary", "summary", "excerpt"],
    ["internalLinks", "internal_links"],
    ["externalLinks", "external_links"],
    ["ctaType", "cta_type"],
    ["faq", "faqItems", "faq_items", "faqs", "faqSection"],
    ["captureComponents", "capture_components"],
    ["dataNosnippetSections", "data_nosnippet_sections"],
    ["hubId", "hub_id", "parentHubId", "parent_hub_id"],
  ];

  for (const [canonical, ...alternates] of fieldAliases) {
    if (result[canonical] === undefined || result[canonical] === null) {
      for (const alt of alternates) {
        if (result[alt] !== undefined && result[alt] !== null) {
          result[canonical] = result[alt];
          delete result[alt];
          break;
        }
      }
    }
  }

  // Handle `schemaFlags` -> `schema`
  if (!result.schema && result.schemaFlags) {
    result.schema = result.schemaFlags;
    delete result.schemaFlags;
  }

  // If articleId is still missing, inject from request or try to parse
  if (typeof result.articleId !== "number") {
    if (typeof result.articleId === "string") {
      const parsed = parseInt(result.articleId, 10);
      if (!isNaN(parsed)) result.articleId = parsed;
    }
    if (typeof result.articleId !== "number" && typeof articleId === "number") {
      console.log("[streaming-parser] Injecting articleId from request:", articleId);
      result.articleId = articleId;
    }
  }

  // If articleType is still missing, inject from request
  const validArticleTypes = ["hub", "spoke", "news"];
  if (!validArticleTypes.includes(result.articleType as string) && articleType && validArticleTypes.includes(articleType)) {
    console.log("[streaming-parser] Injecting articleType from request:", articleType);
    result.articleType = articleType;
  }

  // Handle `captureComponent` (singular) -> map to ctaType and captureComponents
  if (typeof result.captureComponent === "object" && result.captureComponent !== null) {
    const cap = result.captureComponent as Record<string, unknown>;
    if (!result.ctaType && cap.ctaType) {
      result.ctaType = cap.ctaType;
    }
    delete result.captureComponent;
  }

  // Delete extra keys not in the schema (would cause Zod strict parse to fail)
  delete result.seo;
  delete result.seoMetadata;

  // === Fill defaults for required fields Claude commonly omits ===
  if (!result.version) result.version = "1.0";
  if (!result.hubId && result.hubId !== 0) result.hubId = null;
  if (!result.canonicalUrl) {
    const slug = result.slug as string | undefined;
    result.canonicalUrl = slug ? `https://www.bhutanwine.com/blog/${slug}` : "https://www.bhutanwine.com/blog";
  }
  if (!result.publishDate) result.publishDate = new Date().toISOString();
  if (!result.modifiedDate) result.modifiedDate = new Date().toISOString();
  if (!result.ctaType) result.ctaType = "newsletter";

  // Ensure required arrays exist
  if (!Array.isArray(result.faq)) result.faq = [];
  if (!Array.isArray(result.dataNosnippetSections)) result.dataNosnippetSections = [];
  if (!Array.isArray(result.captureComponents)) {
    result.captureComponents = result.ctaType ? [result.ctaType] : [];
  }
  if (!Array.isArray(result.internalLinks)) result.internalLinks = [];
  if (!Array.isArray(result.externalLinks)) result.externalLinks = [];

  // Ensure schema flags exist
  if (!result.schema || typeof result.schema !== "object") {
    result.schema = {
      blogPosting: true,
      faqPage: Array.isArray(result.faq) && (result.faq as unknown[]).length > 0,
      product: false,
    };
  }

  // Ensure heroImage is null if missing (not undefined)
  if (!result.heroImage) result.heroImage = null;

  // Coerce photoId, width, height from string to number in all ImagePlacement nodes
  // Claude often returns these as strings (e.g. "5" instead of 5)
  coerceImageFields(result);

  // Normalize content node types — Claude often uses non-standard types
  normalizeContentNodeTypes(result);

  // Clean HTML from author fields — Claude sometimes embeds <a> tags in author.name
  if (typeof result.author === "object" && result.author !== null) {
    const author = result.author as Record<string, unknown>;
    if (typeof author.name === "string") {
      const linkMatch = (author.name as string).match(/<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (linkMatch) {
        const [, href, text] = linkMatch;
        if (!author.linkedinUrl && href) {
          author.linkedinUrl = href;
          console.log("[streaming-parser] Extracted linkedinUrl from author.name:", href);
        }
        author.name = text.trim() || author.name;
      }
      // Strip any remaining HTML tags
      author.name = (author.name as string).replace(/<[^>]+>/g, "").trim();
    }
  }

  console.log("[streaming-parser] After normalization, top-level keys:", Object.keys(result).slice(0, 20));
  console.log("[streaming-parser] title:", typeof result.title, "articleId:", typeof result.articleId, "sections:", Array.isArray(result.sections));

  return result;
}

/**
 * Coerces photoId, width, height from strings to numbers in all ImagePlacement nodes.
 * Claude frequently outputs these as strings (e.g. "5" instead of 5).
 */
function coerceImageFields(doc: Record<string, unknown>): void {
  const coercePlacement = (p: Record<string, unknown>) => {
    if (typeof p.photoId === "string") {
      const n = parseInt(p.photoId as string, 10);
      p.photoId = isNaN(n) ? null : n;
    }
    if (typeof p.width === "string") {
      const n = parseInt(p.width as string, 10);
      p.width = isNaN(n) ? null : n;
    }
    if (typeof p.height === "string") {
      const n = parseInt(p.height as string, 10);
      p.height = isNaN(n) ? null : n;
    }
  };

  if (doc.heroImage && typeof doc.heroImage === "object") {
    coercePlacement(doc.heroImage as Record<string, unknown>);
  }
  if (Array.isArray(doc.sections)) {
    for (const section of doc.sections as Record<string, unknown>[]) {
      if (Array.isArray(section.content)) {
        for (const node of section.content as Record<string, unknown>[]) {
          if (node.type === "image" && typeof node.placement === "object" && node.placement !== null) {
            coercePlacement(node.placement as Record<string, unknown>);
          }
        }
      }
    }
  }
}

/**
 * Normalizes content node types that Claude invents to the 7 valid types.
 */
function normalizeContentNodeTypes(doc: Record<string, unknown>): void {
  const validTypes = new Set(["paragraph", "image", "pullQuote", "keyFacts", "table", "list", "callout"]);
  const typeMap: Record<string, string> = {
    blockquote: "pullQuote", quote: "pullQuote", pull_quote: "pullQuote", pullquote: "pullQuote",
    heading: "paragraph", subheading: "paragraph", h2: "paragraph", h3: "paragraph",
    data_table: "table", dataTable: "table",
    ordered_list: "list", unordered_list: "list", orderedList: "list", unorderedList: "list",
    bullet_list: "list", bulletList: "list", numbered_list: "list", numberedList: "list",
    info: "callout", tip: "callout", warning: "callout", note: "callout",
    infobox: "callout", info_box: "callout",
    text: "paragraph", richText: "paragraph", rich_text: "paragraph", html: "paragraph",
    key_facts: "keyFacts", keyfacts: "keyFacts", facts: "keyFacts",
    stat: "keyFacts", stats: "keyFacts", statistics: "keyFacts",
  };

  if (!Array.isArray(doc.sections)) return;
  for (const section of doc.sections as Record<string, unknown>[]) {
    if (!Array.isArray(section.content)) continue;
    for (const node of section.content as Record<string, unknown>[]) {
      const t = node.type as string;
      if (t && !validTypes.has(t)) {
        const mapped = typeMap[t] || typeMap[t.toLowerCase()];
        if (mapped) {
          node.type = mapped;
          if (mapped === "pullQuote" && !node.text && node.content) { node.text = node.content; delete node.content; }
          if (mapped === "pullQuote" && !node.attribution) node.attribution = null;
          if (mapped === "paragraph" && !node.text) { node.text = (node.content || node.heading || node.value || "") as string; }
          if (mapped === "callout" && !node.variant) node.variant = t === "warning" ? "warning" : t === "tip" ? "tip" : "info";
          if (mapped === "callout" && !node.text && node.content) { node.text = node.content; delete node.content; }
        } else if (typeof node.text === "string" || typeof node.content === "string") {
          node.type = "paragraph";
          if (!node.text && node.content) { node.text = node.content; delete node.content; }
        }
      }
    }
  }
}

function isCanonicalDoc(obj: unknown): obj is CanonicalArticleDocument {
  if (typeof obj !== "object" || obj === null) return false;
  const doc = obj as Record<string, unknown>;
  return (
    typeof doc.title === "string" &&
    typeof doc.articleId === "number" &&
    Array.isArray(doc.sections)
  );
}
