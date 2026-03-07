import type { GenerateArticleRequest, GenerateArticleResponse, StreamEvent } from "@/types/claude";
import { assembleSystemPrompt } from "@/lib/prompt-assembly";
import { streamGeneration } from "@/lib/claude";
import { buildMessages } from "./conversation";
import { parseGenerationResponse } from "./streaming-parser";
import { runPostProcessing } from "./post-processing";

export type StreamCallback = (event: StreamEvent) => void;

/**
 * Runs the full generation pipeline:
 * 1. Assemble system prompt
 * 2. Call Claude with streaming
 * 3. Parse response into CanonicalArticleDocument
 * 4. Run post-processing (repair + validate + render)
 * 5. Return complete response
 */
export async function generateArticle(
  request: GenerateArticleRequest,
  onEvent?: StreamCallback
): Promise<GenerateArticleResponse> {
  const emit = (type: StreamEvent["type"], data: unknown) => {
    onEvent?.({ type, data });
  };

  // Step 1: Assemble the 7-layer system prompt
  emit("status", { message: "Assembling system prompt..." });
  const { systemPrompt, layers, totalTokenEstimate, onyxSources } = await assembleSystemPrompt(
    request.articleId,
    request.photoManifest,
    request.selectedStyleId ?? null
  );
  emit("status", {
    message: `System prompt assembled (${layers.length} layers, ~${totalTokenEstimate} tokens)`,
  });

  // Step 2: Build messages array
  const messages = buildMessages(request);

  // Step 3: Call Claude API with streaming
  emit("status", { message: "Calling Claude API..." });

  const streamResult = await streamGeneration(systemPrompt, messages, {
    onTextDelta: (text) => emit("text_delta", { text }),
    onWebSearch: (query) => emit("web_search", { query }),
    onError: (error) => emit("error", { code: "GENERATION_FAILED", message: error.message }),
  });

  emit("status", {
    message: `Claude response complete (${streamResult.tokensUsed.input} input, ${streamResult.tokensUsed.output} output tokens)`,
  });

  // Step 4: Parse JSON from response, passing articleId + articleType for injection if Claude omits them
  emit("status", { message: "Parsing response..." });
  const briefLayer = layers.find((l) => l.name === "Article Brief");
  const articleTypeMatch = briefLayer?.content.match(/Article Type: (\w+)/);
  const articleType = articleTypeMatch?.[1];
  const parseResult = parseGenerationResponse(streamResult.text, request.articleId, articleType, streamResult.textBlocks);

  if (!parseResult.document) {
    emit("error", {
      code: "GENERATION_FAILED",
      message: parseResult.parseError || "Failed to parse response",
    });
    throw new Error("GENERATION_FAILED");
  }

  emit("document", parseResult.document);

  // Step 5: Post-processing (repair + validate + render)
  emit("status", { message: "Running validation and rendering..." });
  const postResult = await runPostProcessing(parseResult.document);

  emit("validation", postResult.validationResult);

  // Build final response
  const response: GenerateArticleResponse = {
    document: postResult.document,
    html: postResult.html,
    validationResult: postResult.validationResult,
    conversationReply:
      parseResult.conversationReply || `Article generated successfully (${postResult.wordCount} words).`,
    tokensUsed: streamResult.tokensUsed,
    webSearchResults: streamResult.webSearchResults,
    onyxSources,
  };

  emit("complete", response);

  return response;
}
