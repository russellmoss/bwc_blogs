import { prisma } from "@/lib/db";
import type { PromptLayer } from "@/types/claude";

const MAX_CONTENT_CHARS = 8000; // ~2000 tokens at 4 chars/token
const CHARS_PER_TOKEN = 4;

const VOICE_PREAMBLE = `=== WRITING VOICE DIRECTIVE ===
The following style guide governs the TONE, VOICE, and PROSE STYLE
of this article. Follow these directions for sentence structure,
vocabulary, rhythm, perspective, and emotional register.

IMPORTANT: This voice directive does NOT override:
- The SOP's structural requirements (word count, links, entities, headings)
- The Brand Style Guide's visual rules (CSS, components, formatting)
- The Template Reference's content node types
- Any QA scorecard check

The voice directive shapes HOW you write, not WHAT you write or
how the output is structured. All SOP and SEO rules remain in force.

--- BEGIN STYLE ---
`;

const VOICE_POSTAMBLE = `
--- END STYLE ---`;

export async function buildLayerWritingVoice(
  styleId: number | null
): Promise<PromptLayer | null> {
  if (styleId === null) {
    return null;
  }

  const style = await prisma.writingStyle.findUnique({
    where: { id: styleId },
    select: { name: true, content: true },
  });

  if (!style) {
    return null;
  }

  let content = style.content;
  if (content.length > MAX_CONTENT_CHARS) {
    content = content.slice(0, MAX_CONTENT_CHARS);
    console.warn(
      `[layer-writing-voice] Style "${style.name}" truncated to ~${Math.ceil(MAX_CONTENT_CHARS / CHARS_PER_TOKEN)} tokens`
    );
  }

  const fullContent = VOICE_PREAMBLE + content + VOICE_POSTAMBLE;

  return {
    name: `Writing Voice: ${style.name}`,
    content: fullContent,
    tokenEstimate: Math.ceil(fullContent.length / CHARS_PER_TOKEN),
  };
}
