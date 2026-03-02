import type { CanonicalArticleDocument } from "./article";
import type { PhotoManifest } from "./photo";
import type { ValidationResult } from "./api";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface PromptLayer {
  name: string;
  content: string;
  tokenEstimate: number;
}

export interface GenerationRequest {
  articleId: number;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  currentDocument: CanonicalArticleDocument | null;
}

export interface GenerationResponse {
  document: CanonicalArticleDocument;
  conversationReply: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  webSearchResults: WebSearchResult[];
}

export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
}

// === API route request/response types (from orchestration doc §5B) ===

export interface GenerateArticleRequest {
  articleId: number;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  currentDocument: CanonicalArticleDocument | null;
  photoManifest: PhotoManifest | null;
}

export interface GenerateArticleResponse {
  document: CanonicalArticleDocument;
  html: string;
  validationResult: ValidationResult;
  conversationReply: string;
  tokensUsed: { input: number; output: number };
  webSearchResults: WebSearchResult[];
}

// === SSE streaming event types ===

export type StreamEventType =
  | "status"
  | "text_delta"
  | "web_search"
  | "document"
  | "validation"
  | "complete"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
}
