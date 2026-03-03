import type Anthropic from "@anthropic-ai/sdk";
import type { GenerateArticleRequest } from "@/types/claude";
import type { CanonicalArticleDocument } from "@/types/article";

/**
 * Extract a numeric word-count target from user text.
 * Matches patterns like "1200 words", "1,200-word", "word count: 1200",
 * "around 1200 words", "approximately 1500 words", "~1200 words".
 * Returns null if no target found or value is outside sane bounds (100–10000).
 */
export function extractWordCountTarget(text: string): number | null {
  const patterns = [
    /(\d{1,2},?\d{3}|\d{3,5})\s*[-–]?\s*words?\b/i,
    /\bword\s*count\s*[:=]?\s*(\d{1,2},?\d{3}|\d{3,5})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = (match[1] || match[2] || match[0]).replace(/,/g, "");
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num >= 100 && num <= 10000) {
        return num;
      }
    }
  }

  return null;
}

/**
 * Build a word-count constraint block for injection into the user message.
 * Uses a ±10% tolerance band so the model has practical room.
 */
function buildWordCountInstruction(target: number): string {
  const low = Math.round(target * 0.9);
  const high = Math.round(target * 1.1);
  return (
    `⚠️ WORD COUNT REQUIREMENT (HIGH PRIORITY):\n` +
    `The user has requested a target of ${target} words.\n` +
    `You MUST produce an article between ${low} and ${high} words (±10%).\n` +
    `This overrides the default word-count minimum for the article type.\n` +
    `Do NOT exceed ${high} words. Do NOT fall below ${low} words.\n` +
    `Count carefully — every paragraph, heading, list item, quote, and FAQ counts toward the total.`
  );
}

/**
 * Builds the messages array for the Claude API call from conversation history
 * and the current user request.
 */
export function buildMessages(
  request: GenerateArticleRequest
): Anthropic.Messages.MessageParam[] {
  const messages: Anthropic.Messages.MessageParam[] = [];

  // Add conversation history
  for (const msg of request.conversationHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Check if the user specified a word count target
  const wordCountTarget = extractWordCountTarget(request.userMessage);

  // Build the current user message
  let userContent = request.userMessage;

  // If there's a current document (re-edit), include it as context
  if (request.currentDocument) {
    userContent = buildEditMessage(request.currentDocument, request.userMessage, wordCountTarget);
  } else if (wordCountTarget) {
    // New generation — prepend the word count constraint
    userContent = buildWordCountInstruction(wordCountTarget) + "\n\n" + request.userMessage;
  }

  messages.push({
    role: "user",
    content: userContent,
  });

  return messages;
}

function buildEditMessage(
  currentDocument: CanonicalArticleDocument,
  userMessage: string,
  wordCountTarget: number | null
): string {
  const wordCountBlock = wordCountTarget
    ? `\n${buildWordCountInstruction(wordCountTarget)}\n`
    : "";

  return `Here is the current article document (CanonicalArticleDocument JSON):

\`\`\`json
${JSON.stringify(currentDocument, null, 2)}
\`\`\`
${wordCountBlock}
EDIT INSTRUCTIONS:
- Make ONLY the changes the user requests — preserve all other content exactly as-is
- Do NOT rewrite sections, paragraphs, or headings that the user did not ask to change
- Do NOT re-order, rephrase, or "improve" content beyond the specific edit requested${wordCountTarget ? "\n- The requested word count is a HARD REQUIREMENT — trim or expand content to meet it" : ""}
- Return the COMPLETE CanonicalArticleDocument JSON (the full document with your targeted changes applied)

My request: ${userMessage}`;
}
