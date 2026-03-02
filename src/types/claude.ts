import { CanonicalArticleDocument } from "./article";

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
