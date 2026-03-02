import { create } from "zustand";
import type { CanonicalArticleDocument } from "@/types/article";
import type { GenerateArticleResponse } from "@/types/claude";
import type { ContentMapEntry } from "@/types/content-map";
import type { ValidationResult } from "@/types/api";
import type { HtmlOverride } from "@/types/renderer";
import type {
  ArticleEditorState,
  ArticleEditorActions,
  ArticleVersion,
  PreviewMode,
  ViewportMode,
  EditingMode,
} from "@/types/ui";
import { createUndoEntry, pushToStack, popFromStack, setByPath } from "@/lib/undo-redo";
import { renderArticle } from "@/lib/renderer";
import { TEMPLATE_VERSION } from "@/lib/renderer/compiled-template";

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
  undoStack: [],
  redoStack: [],
  isCanvasEditing: false,
  htmlOverrides: [],
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
        // Push undo before replacing document
        let newUndoStack = state.undoStack;
        if (state.currentDocument) {
          const entry = createUndoEntry(
            state.currentDocument,
            state.currentHtml,
            state.htmlOverrides,
            `v${state.versionHistory.length + 1} — Chat edit`
          );
          newUndoStack = pushToStack(state.undoStack, entry);
        }

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
          undoStack: newUndoStack,
          redoStack: [], // clear redo on new edit
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

    // === Undo/Redo ===

    pushUndo: (label: string) => {
      const state = get();
      if (!state.currentDocument) return;
      const entry = createUndoEntry(
        state.currentDocument,
        state.currentHtml,
        state.htmlOverrides,
        label
      );
      set({
        undoStack: pushToStack(state.undoStack, entry),
        redoStack: [], // clear redo on new edit
      });
    },

    undo: () => {
      const state = get();
      if (state.undoStack.length === 0 || !state.currentDocument) return;
      // Save current state to redo
      const currentEntry = createUndoEntry(
        state.currentDocument,
        state.currentHtml,
        state.htmlOverrides,
        "Before undo"
      );
      const [entry, newUndoStack] = popFromStack(state.undoStack);
      if (!entry) return;
      set({
        currentDocument: entry.document,
        currentHtml: entry.html,
        htmlOverrides: entry.htmlOverrides,
        undoStack: newUndoStack,
        redoStack: pushToStack(state.redoStack, currentEntry),
      });
    },

    redo: () => {
      const state = get();
      if (state.redoStack.length === 0 || !state.currentDocument) return;
      // Save current state to undo
      const currentEntry = createUndoEntry(
        state.currentDocument,
        state.currentHtml,
        state.htmlOverrides,
        "Before redo"
      );
      const [entry, newRedoStack] = popFromStack(state.redoStack);
      if (!entry) return;
      set({
        currentDocument: entry.document,
        currentHtml: entry.html,
        htmlOverrides: entry.htmlOverrides,
        redoStack: newRedoStack,
        undoStack: pushToStack(state.undoStack, currentEntry),
      });
    },

    // === Canvas Edit ===

    applyCanvasEdit: (cadPath: string, newText: string) => {
      const state = get();
      if (!state.currentDocument) return;
      const updatedDoc = setByPath(state.currentDocument, cadPath, newText);
      // Do NOT re-render HTML here — isCanvasEditing suppresses iframe updates
      set({ currentDocument: updatedDoc });
    },

    setIsCanvasEditing: (active: boolean) => {
      const state = get();
      if (!active && state.currentDocument) {
        // Leaving canvas mode — re-render HTML from canonical doc
        const result = renderArticle({
          document: state.currentDocument,
          htmlOverrides: state.htmlOverrides.length > 0 ? state.htmlOverrides : null,
          templateVersion: TEMPLATE_VERSION,
        });
        set({ isCanvasEditing: false, currentHtml: result.html });
      } else {
        set({ isCanvasEditing: active });
      }
    },

    // === HTML Overrides ===

    applyHtmlOverride: (override: HtmlOverride) =>
      set((state) => {
        const existing = state.htmlOverrides.findIndex((o) => o.path === override.path);
        const newOverrides = [...state.htmlOverrides];
        if (existing >= 0) {
          newOverrides[existing] = override;
        } else {
          newOverrides.push(override);
        }
        return { htmlOverrides: newOverrides };
      }),

    clearHtmlOverrides: () => set({ htmlOverrides: [] }),

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

export function selectCanUndo(state: ArticleEditorState): boolean {
  return state.undoStack.length > 0;
}

export function selectCanRedo(state: ArticleEditorState): boolean {
  return state.redoStack.length > 0;
}
