import type { RendererInput, RendererOutput } from "@/types/renderer";
import type { HtmlOverride } from "@/types/renderer";
import { repairCanonicalDocument } from "@/lib/article-schema";
import { buildSchemaJson } from "./jsonld";
import { GOOGLE_FONTS_HTML, STYLE_BLOCK } from "./compiled-template";
import {
  renderHero,
  renderHeroImage,
  renderContentNode,
  renderFaq,
  renderAuthorBio,
  renderArticleFooter,
} from "./components";

/** Count words in rendered text (strip HTML tags) */
function countRenderedWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, "").trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

/** Escape HTML for attribute values */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Render a CanonicalArticleDocument into complete Wix-ready HTML.
 * This is a PURE FUNCTION — no DB calls, no API calls, no side effects.
 */
export function renderArticle(input: RendererInput): RendererOutput {
  // Auto-repair before rendering (repair is cheap, rendering broken doc is expensive)
  const { repaired: doc } = repairCanonicalDocument(input.document);

  // Build JSON-LD schema blocks
  const schemaJson = buildSchemaJson(doc);

  // Build sections HTML
  let sectionsHtml = "";
  for (let si = 0; si < doc.sections.length; si++) {
    const section = doc.sections[si];
    const tag = section.headingLevel === 2 ? "h2" : "h3";
    const cadPath = `sections[${si}]`;

    // data-nosnippet wrapper
    const isNosnippet = doc.dataNosnippetSections.includes(section.id);
    if (isNosnippet) {
      sectionsHtml += '\n    <div data-nosnippet>';
    }

    sectionsHtml += `\n    <${tag} data-cad-path="${cadPath}.heading">${escapeAttr(section.heading)}</${tag}>`;

    for (let ci = 0; ci < section.content.length; ci++) {
      const nodePath = `${cadPath}.content[${ci}]`;
      sectionsHtml += "\n    " + renderContentNode(section.content[ci], nodePath);
    }

    if (isNosnippet) {
      sectionsHtml += '\n    </div>';
    }
  }

  // Assemble the full HTML document
  const bodyHtml = `
  <article class="bwc-article">
    ${renderHero(doc)}
    ${renderHeroImage(doc)}
    <section class="blog-content">${sectionsHtml}
    </section>
    ${renderFaq(doc.faq)}
    ${renderAuthorBio(doc)}
    ${renderArticleFooter(doc)}
  </article>`;

  let fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeAttr(doc.metaTitle)}</title>
  <meta name="description" content="${escapeAttr(doc.metaDescription)}">
  <link rel="canonical" href="${escapeAttr(doc.canonicalUrl)}">
  ${GOOGLE_FONTS_HTML}
  ${STYLE_BLOCK}
  ${schemaJson}
</head>
<body>${bodyHtml}
</body>
</html>`;

  // Apply HTML overrides (if any)
  const overrides: HtmlOverride[] = input.htmlOverrides || [];
  for (const override of overrides) {
    // Simple path-based replacement: find element with matching data-cad-path
    const pattern = `data-cad-path="${override.path}"`;
    const idx = fullHtml.indexOf(pattern);
    if (idx !== -1) {
      // Find the containing element's opening and closing tags
      const tagStart = fullHtml.lastIndexOf("<", idx);
      const tagEnd = fullHtml.indexOf(">", idx);
      if (tagStart !== -1 && tagEnd !== -1) {
        // Find closing tag
        const afterTag = fullHtml.substring(tagEnd + 1);
        const tagName = fullHtml.substring(tagStart + 1, fullHtml.indexOf(" ", tagStart + 1));
        const closeIdx = afterTag.indexOf(`</${tagName}>`);
        if (closeIdx !== -1) {
          const absoluteCloseStart = tagEnd + 1 + closeIdx;
          const absoluteCloseEnd = absoluteCloseStart + tagName.length + 3;
          fullHtml =
            fullHtml.substring(0, tagStart) +
            override.html +
            fullHtml.substring(absoluteCloseEnd);
        }
      }
    }
  }

  // Count words from body content only (not head/schema)
  const wordCount = countRenderedWords(bodyHtml);

  return {
    html: fullHtml,
    metaTitle: doc.metaTitle,
    metaDescription: doc.metaDescription,
    schemaJson,
    wordCount,
  };
}
