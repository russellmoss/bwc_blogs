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

Please modify this document based on my request below. Return the COMPLETE updated CanonicalArticleDocument JSON (not just the changed parts).

My request: ${userMessage}`;
}
