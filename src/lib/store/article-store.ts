import { create } from "zustand";
import type { CanonicalArticleDocument } from "@/types/article";
import type { GenerateArticleResponse } from "@/types/claude";
import type { ContentMapEntry } from "@/types/content-map";
import type { ValidationResult } from "@/types/api";
import type {
  ArticleEditorState,
  ArticleEditorActions,
  ArticleVersion,
  PreviewMode,
  ViewportMode,
  EditingMode,
} from "@/types/ui";

const initialState: ArticleEditorState = {
  selectedArticleId: null,
  selectedArticle: null,
  isGenerating: false,
  streamingText: "",
  statusMessage: "",
  currentDocument: null,
  currentHtml: "",
  validationResult: null,
  versionHistory: [],
  activeVersionNumber: null,
  conversationHistory: [],
  previewMode: "preview",
  viewportMode: "desktop",
  editingMode: "chat",
};

export const useArticleStore = create<ArticleEditorState & ArticleEditorActions>(
  (set, get) => ({
    ...initialState,

    // Article selection
    setSelectedArticle: (article: ContentMapEntry | null) =>
      set({
        selectedArticle: article,
        selectedArticleId: article?.id ?? null,
        // Reset document state when switching articles
        currentDocument: null,
        currentHtml: "",
        validationResult: null,
        versionHistory: [],
        activeVersionNumber: null,
        conversationHistory: [],
        streamingText: "",
        statusMessage: "",
        isGenerating: false,
      }),

    // Generation
    startGeneration: () =>
      set({
        isGenerating: true,
        streamingText: "",
        statusMessage: "Starting generation...",
        activeVersionNumber: null,
      }),

    appendStreamingText: (text: string) =>
      set((state) => ({
        streamingText: state.streamingText + text,
      })),

    setStatusMessage: (message: string) =>
      set({ statusMessage: message }),

    setDocument: (doc: CanonicalArticleDocument) =>
      set({ currentDocument: doc }),

    setCurrentHtml: (html: string) =>
      set({ currentHtml: html }),

    setValidationResult: (result: ValidationResult) =>
      set({ validationResult: result }),

    completeGeneration: (response: GenerateArticleResponse) =>
      set((state) => {
        const newHistory = [...state.versionHistory];

        // Snapshot current document before replacing (if one exists)
        if (state.currentDocument) {
          const versionNumber = newHistory.length + 1;
          const label =
            versionNumber === 1
              ? `v${versionNumber} — Initial generation`
              : `v${versionNumber} — Chat edit`;
          newHistory.push({
            versionNumber,
            timestamp: new Date().toISOString(),
            label,
            document: state.currentDocument,
            html: state.currentHtml,
            validationResult: state.validationResult,
            conversationIndex: state.conversationHistory.length - 1,
          });
        }

        return {
          isGenerating: false,
          streamingText: "",
          statusMessage: "",
          currentDocument: response.document,
          currentHtml: response.html,
          validationResult: response.validationResult,
          versionHistory: newHistory,
          conversationHistory: [
            ...state.conversationHistory,
            {
              role: "assistant" as const,
              content: response.conversationReply,
              timestamp: new Date().toISOString(),
            },
          ],
        };
      }),

    failGeneration: (error: string) =>
      set((state) => ({
        isGenerating: false,
        streamingText: "",
        statusMessage: "",
        conversationHistory: [
          ...state.conversationHistory,
          {
            role: "assistant" as const,
            content: `Error: ${error}`,
            timestamp: new Date().toISOString(),
          },
        ],
      })),

    // Conversation
    addUserMessage: (content: string) =>
      set((state) => ({
        conversationHistory: [
          ...state.conversationHistory,
          {
            role: "user" as const,
            content,
            timestamp: new Date().toISOString(),
          },
        ],
      })),

    addAssistantMessage: (content: string) =>
      set((state) => ({
        conversationHistory: [
          ...state.conversationHistory,
          {
            role: "assistant" as const,
            content,
            timestamp: new Date().toISOString(),
          },
        ],
      })),

    // Version history
    viewVersion: (versionNumber: number) => {
      const state = get();
      const version = state.versionHistory.find(
        (v) => v.versionNumber === versionNumber
      );
      if (version) {
        set({ activeVersionNumber: versionNumber });
      }
    },

    viewLiveVersion: () => set({ activeVersionNumber: null }),

    rollbackToVersion: (versionNumber: number) => {
      const state = get();
      const version = state.versionHistory.find(
        (v) => v.versionNumber === versionNumber
      );
      if (!version || !state.currentDocument) return;

      // Save current state as a "Before rollback" version first
      const newHistory = [...state.versionHistory];
      const nextNumber = newHistory.length + 1;
      newHistory.push({
        versionNumber: nextNumber,
        timestamp: new Date().toISOString(),
        label: `v${nextNumber} — Before rollback`,
        document: state.currentDocument,
        html: state.currentHtml,
        validationResult: state.validationResult,
        conversationIndex: state.conversationHistory.length - 1,
      });

      set({
        currentDocument: version.document,
        currentHtml: version.html,
        validationResult: version.validationResult,
        versionHistory: newHistory,
        activeVersionNumber: null,
      });
    },

    // UI toggles
    setPreviewMode: (mode: PreviewMode) => set({ previewMode: mode }),
    setViewportMode: (mode: ViewportMode) => set({ viewportMode: mode }),
    setEditingMode: (mode: EditingMode) => set({ editingMode: mode }),

    // Reset
    resetEditor: () => set(initialState),
  })
);

// === Selectors ===

export function selectEffectiveHtml(
  state: ArticleEditorState
): string {
  if (state.activeVersionNumber === null) return state.currentHtml;
  const version = state.versionHistory.find(
    (v) => v.versionNumber === state.activeVersionNumber
  );
  return version?.html ?? state.currentHtml;
}

export function selectEffectiveValidation(
  state: ArticleEditorState
): ValidationResult | null {
  if (state.activeVersionNumber === null) return state.validationResult;
  const version = state.versionHistory.find(
    (v) => v.versionNumber === state.activeVersionNumber
  );
  return version?.validationResult ?? state.validationResult;
}

export function selectIsViewingHistory(
  state: ArticleEditorState
): boolean {
  return state.activeVersionNumber !== null;
}
