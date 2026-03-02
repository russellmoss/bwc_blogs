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
 */
export function parseGenerationResponse(rawText: string): ParseResult {
  const trimmed = rawText.trim();
  let conversationReply = "";

  // Strategy 1: Entire text is JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (isCanonicalDoc(parsed)) {
      return { document: parsed, conversationReply: "", rawText, parseError: null };
    }
  } catch {
    // Not pure JSON, try other strategies
  }

  // Strategy 2: Extract from markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (isCanonicalDoc(parsed)) {
        // Everything outside the fence is conversation
        conversationReply = trimmed
          .replace(/```(?:json)?\s*\n?[\s\S]*?\n?```/, "")
          .trim();
        return { document: parsed, conversationReply, rawText, parseError: null };
      }
    } catch {
      // fence content wasn't valid JSON
    }
  }

  // Strategy 3: Find the outermost { ... } block
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (isCanonicalDoc(parsed)) {
        conversationReply = (
          trimmed.slice(0, firstBrace) + trimmed.slice(lastBrace + 1)
        ).trim();
        return { document: parsed, conversationReply, rawText, parseError: null };
      }
    } catch {
      // not valid JSON
    }
  }

  // All strategies failed
  return {
    document: null,
    conversationReply: trimmed,
    rawText,
    parseError: "Failed to extract CanonicalArticleDocument JSON from Claude's response",
  };
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
