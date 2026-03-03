import type { CanonicalArticleDocument } from "@/types/article";
import type { QAScore } from "@/types/qa";
import { getClaudePromptTemplate } from "./fix-registry";

const PATCH_SYSTEM_PROMPT = `You are a surgical article editor for Bhutan Wine Company. You receive a CanonicalArticleDocument (JSON) and a list of QA issues to fix.

CRITICAL RULES:
1. Return ONLY a JSON object containing the fields you changed — nothing else.
2. For scalar fields (title, metaTitle, metaDescription, executiveSummary, etc.), include just the field name and new value.
3. For array fields (sections, internalLinks, externalLinks, faq), return the COMPLETE replacement array — not a diff or partial array.
4. If you modify any section's content, return the FULL sections array with ALL sections (unchanged ones included) to preserve order and IDs.
5. Do NOT change fields unrelated to the requested fixes.
6. Do NOT include version, articleId, slug, articleType, or hubId unless explicitly asked to fix them.
7. Return valid JSON only — no markdown fences, no explanation text, no comments.
8. Preserve all existing section IDs exactly (e.g. "section-1", "section-2").
9. InternalLinkRef format (ALL fields required): { "targetUrl": "https://www.bhutanwine.com/post/slug-here", "anchorText": "descriptive text 3-8 words", "targetArticleId": null, "targetCorePage": null, "linkType": "spoke-to-hub", "sectionId": "section-1" }
   Valid linkType values: "spoke-to-hub", "spoke-to-sibling", "hub-to-spoke", "cross-cluster", "to-core-page"
   For core page links, set targetCorePage to the page path (e.g. "shop") and linkType to "to-core-page".
10. ExternalLinkRef format (ALL fields required): { "url": "https://example.com/page", "anchorText": "descriptive text 3-8 words", "trustTier": "authority", "sourceName": "Example Source", "sectionId": "section-1" }
    Valid trustTier values: "primary" (govt/academic), "authority" (major publications), "niche_expert" (industry experts), "general" (other)
11. ImagePlacement format: { "photoId": null, "cloudinaryPublicId": null, "src": "existing-url", "alt": "descriptive 10-25 words", "caption": "optional caption", "classification": "informative", "width": 800, "height": 533 }
12. The article is about Bhutan Wine Company — a winery in the Himalayan kingdom of Bhutan. Write in a sophisticated, luxury-brand tone appropriate for wine enthusiasts.`;

/**
 * Build the system and user prompts for a targeted Claude QA fix call.
 * Returns { system, user } strings ready for the Anthropic API.
 */
export function buildPatchPrompt(
  doc: CanonicalArticleDocument,
  checkIds: string[],
  qaScore: QAScore | null
): { system: string; user: string } {
  const issueLines: string[] = [];

  for (const id of checkIds) {
    const template = getClaudePromptTemplate(id);
    // Find the matching QA result for context
    const result = qaScore?.results.find(
      (r) => r.check.id === id && !r.passed
    );
    const context = result ? ` (Current: ${result.message})` : "";
    issueLines.push(`- [${id}] ${template || "Fix this issue."}${context}`);
  }

  const user = `Current document:
${JSON.stringify(doc, null, 2)}

QA issues to fix:
${issueLines.join("\n")}

Return ONLY the JSON patch with changed fields.`;

  return { system: PATCH_SYSTEM_PROMPT, user };
}
