import type {
  ContentNode,
  ImagePlacement,
  FAQItem,
  CanonicalArticleDocument,
} from "@/types/article";
import { buildCloudinaryUrl } from "./cloudinary";

/** Escape HTML special characters in user-provided text */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format ISO date to human-readable */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Render an image placement (figure + img + figcaption) */
function renderImage(
  placement: ImagePlacement,
  isHero: boolean
): string {
  // Determine image src: use Cloudinary URL if photoId is set, otherwise use src directly
  const src = placement.photoId
    ? buildCloudinaryUrl(`blog/${placement.photoId}`, {
        width: placement.width || 1200,
      })
    : placement.src;

  const loading = isHero ? "eager" : "lazy";
  const fetchPriority = isHero ? '\n      fetchpriority="high"' : "";

  const isDecorative = placement.classification === "decorative";
  const altAttr = isDecorative ? 'alt=""' : `alt="${escapeHtml(placement.alt)}"`;
  const roleAttr = isDecorative ? '\n      role="presentation"' : "";

  const figureClass = isDecorative
    ? 'class="bwc-figure bwc-figure--decorative"'
    : 'class="bwc-figure"';

  const widthAttr = placement.width ? `\n      width="${placement.width}"` : "";
  const heightAttr = placement.height ? `\n      height="${placement.height}"` : "";

  let html = `<figure ${figureClass}>
    <img
      src="${escapeHtml(src)}"
      ${altAttr}${widthAttr}${heightAttr}
      loading="${loading}"${fetchPriority}${roleAttr}
    />`;

  if (!isDecorative && placement.caption) {
    html += `\n    <figcaption>${escapeHtml(placement.caption)}</figcaption>`;
  }

  html += "\n  </figure>";
  return html;
}

/** Render a content node to HTML */
export function renderContentNode(
  node: ContentNode,
  dataCadPrefix: string
): string {
  const path = `${dataCadPrefix}`;

  switch (node.type) {
    case "paragraph":
      // Paragraph text may contain inline HTML (links, bold, italic) — pass through
      return `<p data-cad-path="${path}.text">${node.text}</p>`;

    case "image":
      return renderImage(node.placement, false);

    case "pullQuote": {
      let html = `<blockquote class="bwc-pullquote">
    <p data-cad-path="${path}.text">${escapeHtml(node.text)}</p>`;
      if (node.attribution) {
        html += `\n    <cite data-cad-path="${path}.attribution">${escapeHtml(node.attribution)}</cite>`;
      }
      html += "\n  </blockquote>";
      return html;
    }

    case "keyFacts": {
      let html = `<aside class="bwc-key-facts">
    <h3 class="bwc-key-facts__title" data-cad-path="${path}.title">${escapeHtml(node.title)}</h3>
    <dl class="bwc-key-facts__list">`;
      for (const fact of node.facts) {
        html += `\n      <dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd>`;
      }
      html += "\n    </dl>\n  </aside>";
      return html;
    }

    case "table": {
      let html = "<table>";
      if (node.caption) {
        html += `\n    <caption>${escapeHtml(node.caption)}</caption>`;
      }
      if (node.headers.length > 0) {
        html += "\n    <thead><tr>";
        for (const h of node.headers) {
          html += `<th>${escapeHtml(h)}</th>`;
        }
        html += "</tr></thead>";
      }
      html += "\n    <tbody>";
      for (const row of node.rows) {
        html += "\n      <tr>";
        for (const cell of row) {
          html += `<td>${escapeHtml(cell)}</td>`;
        }
        html += "</tr>";
      }
      html += "\n    </tbody>\n  </table>";
      return html;
    }

    case "list": {
      const tag = node.ordered ? "ol" : "ul";
      let html = `<${tag}>`;
      for (const item of node.items) {
        // List items may contain inline HTML — pass through
        html += `\n    <li>${item}</li>`;
      }
      html += `\n  </${tag}>`;
      return html;
    }

    case "callout":
      return `<aside class="bwc-callout bwc-callout--${node.variant}">
    <p data-cad-path="${path}.text">${node.text}</p>
  </aside>`;

    default:
      return `<!-- Unknown content node type -->`;
  }
}

/** Render the hero header section */
export function renderHero(doc: CanonicalArticleDocument): string {
  return `<header class="blog-hero">
    <p class="eyebrow">Bhutan Wine Company Journal</p>
    <h1 data-cad-path="title">${escapeHtml(doc.title)}</h1>
    <p class="bwc-executive-summary" data-cad-path="executiveSummary"><strong>${escapeHtml(doc.executiveSummary)}</strong></p>
    <p class="meta">
      <time datetime="${doc.publishDate}">${formatDate(doc.publishDate)}</time>
      <span aria-hidden="true"> &middot; </span>
      <span>By ${escapeHtml(doc.author.name)}${doc.author.credentials ? `, ${escapeHtml(doc.author.credentials)}` : ""}</span>
    </p>
  </header>`;
}

/** Render the hero image (separate from hero header for loading priority) */
export function renderHeroImage(doc: CanonicalArticleDocument): string {
  if (!doc.heroImage) return "";
  return renderImage(doc.heroImage, true);
}

/** Render FAQ section */
export function renderFaq(items: FAQItem[]): string {
  if (items.length === 0) return "";

  let html = `<section class="bwc-faq">
    <h2>Frequently Asked Questions</h2>`;

  for (let i = 0; i < items.length; i++) {
    html += `\n    <h3 data-cad-path="faq[${i}].question">${escapeHtml(items[i].question)}</h3>`;
    html += `\n    <p data-cad-path="faq[${i}].answer">${escapeHtml(items[i].answer)}</p>`;
  }

  html += "\n  </section>";
  return html;
}

/** Render author bio footer */
export function renderAuthorBio(doc: CanonicalArticleDocument): string {
  let html = `<footer class="bwc-author-bio">
    <p class="bwc-author-bio__name">${escapeHtml(doc.author.name)}</p>
    <p class="bwc-author-bio__credentials">${escapeHtml(doc.author.credentials)}</p>`;

  if (doc.author.bio) {
    html += `\n    <p>${escapeHtml(doc.author.bio)}</p>`;
  }
  if (doc.author.linkedinUrl) {
    html += `\n    <p><a href="${escapeHtml(doc.author.linkedinUrl)}" target="_blank" rel="noopener noreferrer">LinkedIn Profile</a></p>`;
  }

  html += "\n  </footer>";
  return html;
}

/** Render article footer with last-updated date */
export function renderArticleFooter(doc: CanonicalArticleDocument): string {
  return `<footer class="article-footer">
    <p class="last-updated">Last updated: <time datetime="${doc.modifiedDate}">${formatDate(doc.modifiedDate)}</time></p>
  </footer>`;
}
