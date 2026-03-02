import type { CanonicalArticleDocument } from "./article";
import type { ConversationMessage, GenerateArticleResponse } from "./claude";
import type { ContentMapEntry } from "./content-map";
import type { ValidationResult } from "./api";

// === UI Mode Types ===

export type PreviewMode = "preview" | "html";
export type ViewportMode = "desktop" | "mobile";
export type EditingMode = "chat" | "canvas" | "html";

// === Version History ===

export interface ArticleVersion {
  versionNumber: number;
  timestamp: string;
  label: string;
  document: CanonicalArticleDocument;
  html: string;
  validationResult: ValidationResult | null;
  conversationIndex: number;
}

// === Article Editor State ===

export interface ArticleEditorState {
  // Article selection
  selectedArticleId: number | null;
  selectedArticle: ContentMapEntry | null;

  // Generation state
  isGenerating: boolean;
  streamingText: string;
  statusMessage: string;

  // Document state
  currentDocument: CanonicalArticleDocument | null;
  currentHtml: string;
  validationResult: ValidationResult | null;

  // Version history
  versionHistory: ArticleVersion[];
  activeVersionNumber: number | null;

  // Conversation
  conversationHistory: ConversationMessage[];

  // UI state
  previewMode: PreviewMode;
  viewportMode: ViewportMode;
  editingMode: EditingMode;
}

export interface ArticleEditorActions {
  // Article selection
  setSelectedArticle: (article: ContentMapEntry | null) => void;

  // Generation
  startGeneration: () => void;
  appendStreamingText: (text: string) => void;
  setStatusMessage: (message: string) => void;
  setDocument: (doc: CanonicalArticleDocument) => void;
  setCurrentHtml: (html: string) => void;
  setValidationResult: (result: ValidationResult) => void;
  completeGeneration: (response: GenerateArticleResponse) => void;
  failGeneration: (error: string) => void;

  // Conversation
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;

  // Version history
  viewVersion: (versionNumber: number) => void;
  viewLiveVersion: () => void;
  rollbackToVersion: (versionNumber: number) => void;

  // UI toggles
  setPreviewMode: (mode: PreviewMode) => void;
  setViewportMode: (mode: ViewportMode) => void;
  setEditingMode: (mode: EditingMode) => void;

  // Reset
  resetEditor: () => void;
}
