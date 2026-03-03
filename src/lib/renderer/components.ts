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
  isHero: boolean,
  dataCadPrefix?: string
): string {
  // Determine image src: use Cloudinary URL if cloudinaryPublicId is set, otherwise use src directly.
  // Fallback to placement.src if buildCloudinaryUrl returns "" (client-side has no CLOUDINARY_CLOUD_NAME).
  const src = placement.cloudinaryPublicId
    ? buildCloudinaryUrl(placement.cloudinaryPublicId, {
        width: placement.width || 1200,
      }) || placement.src
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
    const captionPath = dataCadPrefix ? ` data-cad-path="${dataCadPrefix}.caption"` : "";
    html += `\n    <figcaption${captionPath}>${escapeHtml(placement.caption)}</figcaption>`;
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
      return renderImage(node.placement, false, `${path}.placement`);

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
      for (let k = 0; k < node.facts.length; k++) {
        const fact = node.facts[k];
        html += `\n      <dt data-cad-path="${path}.facts[${k}].label">${escapeHtml(fact.label)}</dt><dd data-cad-path="${path}.facts[${k}].value">${escapeHtml(fact.value)}</dd>`;
      }
      html += "\n    </dl>\n  </aside>";
      return html;
    }

    case "table": {
      let html = "<table>";
      if (node.caption) {
        html += `\n    <caption data-cad-path="${path}.caption">${escapeHtml(node.caption)}</caption>`;
      }
      if (node.headers.length > 0) {
        html += "\n    <thead><tr>";
        for (let k = 0; k < node.headers.length; k++) {
          html += `<th data-cad-path="${path}.headers[${k}]">${escapeHtml(node.headers[k])}</th>`;
        }
        html += "</tr></thead>";
      }
      html += "\n    <tbody>";
      for (let r = 0; r < node.rows.length; r++) {
        html += "\n      <tr>";
        for (let c = 0; c < node.rows[r].length; c++) {
          html += `<td data-cad-path="${path}.rows[${r}][${c}]">${escapeHtml(node.rows[r][c])}</td>`;
        }
        html += "</tr>";
      }
      html += "\n    </tbody>\n  </table>";
      return html;
    }

    case "list": {
      const tag = node.ordered ? "ol" : "ul";
      let html = `<${tag}>`;
      for (let k = 0; k < node.items.length; k++) {
        // List items may contain inline HTML — pass through
        html += `\n    <li data-cad-path="${path}.items[${k}]">${node.items[k]}</li>`;
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
      <span>By ${doc.author.linkedinUrl ? `<a href="${escapeHtml(doc.author.linkedinUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(doc.author.name)}</a>` : escapeHtml(doc.author.name)}${doc.author.credentials ? `, ${escapeHtml(doc.author.credentials)}` : ""}</span>
    </p>
  </header>`;
}

/** Render the hero image (separate from hero header for loading priority) */
export function renderHeroImage(doc: CanonicalArticleDocument): string {
  if (!doc.heroImage) return "";
  return renderImage(doc.heroImage, true, "heroImage");
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
  const authorName = doc.author.linkedinUrl
    ? `<a href="${escapeHtml(doc.author.linkedinUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(doc.author.name)}</a>`
    : escapeHtml(doc.author.name);

  let html = `<footer class="bwc-author-bio">
    <p class="bwc-author-bio__name" data-cad-path="author.name">${authorName}</p>
    <p class="bwc-author-bio__credentials" data-cad-path="author.credentials">${escapeHtml(doc.author.credentials)}</p>`;

  if (doc.author.bio) {
    html += `\n    <p data-cad-path="author.bio">${escapeHtml(doc.author.bio)}</p>`;
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
