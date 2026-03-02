import type Anthropic from "@anthropic-ai/sdk";
import type { GenerateArticleRequest } from "@/types/claude";
import type { CanonicalArticleDocument } from "@/types/article";

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

  // Build the current user message
  let userContent = request.userMessage;

  // If there's a current document (re-edit), include it as context
  if (request.currentDocument) {
    userContent = buildEditMessage(request.currentDocument, request.userMessage);
  }

  messages.push({
    role: "user",
    content: userContent,
  });

  return messages;
}

function buildEditMessage(
  currentDocument: CanonicalArticleDocument,
  userMessage: string
): string {
  return `Here is the current article document (CanonicalArticleDocument JSON):

\`\`\`json
${JSON.stringify(currentDocument, null, 2)}
\`\`\`

EDIT INSTRUCTIONS:
- Make ONLY the changes the user requests — preserve all other content exactly as-is
- Do NOT rewrite sections, paragraphs, or headings that the user did not ask to change
- Do NOT re-order, rephrase, or "improve" content beyond the specific edit requested
- Return the COMPLETE CanonicalArticleDocument JSON (the full document with your targeted changes applied)

My request: ${userMessage}`;
}
