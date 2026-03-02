import type { PromptLayer } from "@/types/claude";
import { TEMPLATE_VERSION } from "@/lib/renderer";

const TEMPLATE_REFERENCE = `You are generating a CanonicalArticleDocument (structured JSON). The Article Renderer (v${TEMPLATE_VERSION}) supports these content node types:

SECTION STRUCTURE:
- Each section has: id (string), heading (string), headingLevel (2 | 3), content (ContentNode[])

CONTENT NODE TYPES:
1. "paragraph" — { type: "paragraph", id, text } — Body text. May contain inline HTML: <a>, <strong>, <em>
2. "image" — { type: "image", id, placement: ImagePlacement } — Photo with alt text, caption, dimensions
3. "pullQuote" — { type: "pullQuote", id, text, attribution } — Styled blockquote with gold left border
4. "keyFacts" — { type: "keyFacts", id, title, facts: [{label, value}] } — Highlighted fact box
5. "table" — { type: "table", id, caption, headers, rows } — Data table
6. "list" — { type: "list", id, ordered, items } — Ordered or unordered list
7. "callout" — { type: "callout", id, variant: "info"|"tip"|"warning", text } — Highlighted callout box

IMAGE PLACEMENT:
- heroImage: appears above article, loading="eager", fetchpriority="high"
- Inline images: loading="lazy", positioned within sections
- All images require: src (URL), alt (10-25 words for informative, "" for decorative), width, height

CAPTURE COMPONENTS (ctaType field):
- "newsletter" | "allocation" | "tour" | "content_upgrade" | "waitlist"

SCHEMA FLAGS:
- blogPosting: always true
- faqPage: true only if FAQ section present
- product: true only if specific wine product discussed`;

export function buildLayerTemplateRef(): PromptLayer {
  return {
    name: "Template Reference",
    content: TEMPLATE_REFERENCE,
    tokenEstimate: Math.ceil(TEMPLATE_REFERENCE.length / 4),
  };
}
