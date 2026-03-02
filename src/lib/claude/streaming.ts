import type Anthropic from "@anthropic-ai/sdk";
import { getClaudeClient, getModelId, getMaxOutputTokens } from "./client";
import { getGenerationTools } from "./tools";
import type { WebSearchResult } from "@/types/claude";

export interface ClaudeStreamCallbacks {
  onTextDelta?: (text: string) => void;
  onWebSearch?: (query: string) => void;
  onError?: (error: Error) => void;
}

export interface ClaudeStreamResult {
  text: string;
  tokensUsed: { input: number; output: number };
  webSearchResults: WebSearchResult[];
}

export async function streamGeneration(
  systemPrompt: string,
  messages: Anthropic.Messages.MessageParam[],
  callbacks: ClaudeStreamCallbacks = {}
): Promise<ClaudeStreamResult> {
  const client = getClaudeClient();
  const tools = getGenerationTools();
  let accumulatedText = "";
  const webSearchResults: WebSearchResult[] = [];

  const stream = client.messages.stream({
    model: getModelId(),
    max_tokens: getMaxOutputTokens(),
    system: systemPrompt,
    messages,
    tools: tools.length > 0 ? tools : undefined,
  });

  stream.on("text", (text) => {
    accumulatedText += text;
    callbacks.onTextDelta?.(text);
  });

  // Iterate over raw events to capture web search results
  for await (const event of stream) {
    if (event.type === "content_block_start") {
      const block = event.content_block as unknown as Record<string, unknown>;

      if (
        block.type === "server_tool_use" &&
        block.name === "web_search"
      ) {
        const input = block.input as { query?: string } | undefined;
        if (input?.query) {
          callbacks.onWebSearch?.(input.query);
        }
      }

      if (block.type === "web_search_tool_result") {
        const content = block.content;
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === "web_search_result") {
              webSearchResults.push({
                url: item.url || "",
                title: item.title || "",
                snippet: item.description || "",
              });
            }
          }
        }
      }
    }
  }

  const finalMessage = await stream.finalMessage();

  // === Debug logging ===
  console.log("[claude-streaming] stop_reason:", finalMessage.stop_reason);
  console.log("[claude-streaming] model:", finalMessage.model);
  console.log("[claude-streaming] usage:", JSON.stringify(finalMessage.usage));
  console.log("[claude-streaming] max_tokens configured:", getMaxOutputTokens());
  console.log("[claude-streaming] content blocks:", finalMessage.content.length, "types:", finalMessage.content.map(b => b.type));
  console.log("[claude-streaming] accumulated text length:", accumulatedText.length);

  // Check for truncated output
  if (finalMessage.stop_reason === "max_tokens") {
    console.error("[claude-streaming] OUTPUT TRUNCATED at", finalMessage.usage.output_tokens, "tokens");
    callbacks.onError?.(
      new Error(
        `Output truncated — Claude used all ${finalMessage.usage.output_tokens} output tokens. ` +
        `Increase ANTHROPIC_MAX_OUTPUT_TOKENS (currently ${getMaxOutputTokens()}).`
      )
    );
  }

  // Extract any text from the final message content blocks
  // (in case text events didn't fire for all blocks)
  if (!accumulatedText) {
    console.log("[claude-streaming] No text from stream events, extracting from finalMessage blocks");
    for (const block of finalMessage.content) {
      if (block.type === "text") {
        accumulatedText += block.text;
      }
    }
    console.log("[claude-streaming] Extracted text length:", accumulatedText.length);
  }

  return {
    text: accumulatedText,
    tokensUsed: {
      input: finalMessage.usage.input_tokens,
      output: finalMessage.usage.output_tokens,
    },
    webSearchResults,
  };
}
