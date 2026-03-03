import { create } from "zustand";
import type { CanonicalArticleDocument } from "@/types/article";
import type { GenerateArticleResponse } from "@/types/claude";
import type { ContentMapEntry } from "@/types/content-map";
import type { ValidationResult } from "@/types/api";
import type { HtmlOverride } from "@/types/renderer";
import type { QAScore } from "@/types/qa";
import type {
  ArticleEditorState,
  ArticleEditorActions,
  ArticleVersion,
  PreviewMode,
  ViewportMode,
  EditingMode,
} from "@/types/ui";
import type { PhotoManifest } from "@/types/photo";
import { createUndoEntry, pushToStack, popFromStack, setByPath } from "@/lib/undo-redo";
import { renderArticle } from "@/lib/renderer";
import { TEMPLATE_VERSION } from "@/lib/renderer/compiled-template";
import { runQAChecks, BrowserDomAdapter, getFixEntry, getFixTier } from "@/lib/qa";
import type { DeterministicFixResult } from "@/types/qa-fix";
import { extractMetadataFromHtmlBrowser, buildSyntheticDocument } from "@/lib/html-import";

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
  qaScore: null,
  isScorecardOpen: false,
  pendingChatMessage: "",
  isApplyingFix: false,
  photoManifest: null,
  isPhotoSelectorOpen: false,
  isFinalizing: false,
  isPublishing: false,
  finalizationError: null,
  lastFinalizedVersion: null,
  isImportedHtml: false,
  importSource: null,
  selectedStyleId: null,
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
        qaScore: null,
        isScorecardOpen: false,
        pendingChatMessage: "",
        isApplyingFix: false,
        isFinalizing: false,
        isPublishing: false,
        finalizationError: null,
        lastFinalizedVersion: null,
        isImportedHtml: false,
        importSource: null,
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

    // === QA Scorecard ===

    setQaScore: (score: QAScore | null) => set({ qaScore: score }),

    setIsScorecardOpen: (open: boolean) => {
      const state = get();
      // Close canvas editing when opening scorecard (mutually exclusive)
      if (open && state.isCanvasEditing) {
        state.setIsCanvasEditing(false);
      }
      set({ isScorecardOpen: open });
    },

    setPendingChatMessage: (message: string) =>
      set({ pendingChatMessage: message }),

    runQa: () => {
      const state = get();
      if (!state.currentDocument || !state.currentHtml) {
        console.warn("[runQa] Skipped — no document or HTML in state");
        return;
      }
      try {
        console.log("[runQa] Running QA checks on", state.currentHtml.length, "chars of HTML");
        const dom = new BrowserDomAdapter(state.currentHtml);
        const score = runQAChecks(state.currentDocument, state.currentHtml, dom, {
          isImported: state.isImportedHtml,
        });
        console.log("[runQa] QA complete:", score.total, "/", score.possible, "- fails:", score.failCount, "warns:", score.warnCount);
        // Spread into a new object so React always sees a reference change
        set({ qaScore: { ...score }, isScorecardOpen: true, statusMessage: "" });
      } catch (error) {
        console.error("[runQa] QA check threw:", error);
        set({ statusMessage: `QA failed: ${error instanceof Error ? error.message : "Unknown error"}` });
      }
    },

    // === QA Deterministic Fixes ===

    applyDeterministicFix: (checkId: string): DeterministicFixResult | null => {
      const state = get();
      if (!state.currentDocument) {
        console.warn("[applyDeterministicFix] No document in state");
        return null;
      }

      const entry = getFixEntry(checkId);
      if (!entry || entry.tier !== 1 || !entry.fix) {
        console.warn("[applyDeterministicFix] No Tier 1 fix for:", checkId);
        return null;
      }

      const result = entry.fix(state.currentDocument);
      if (!result) {
        console.warn("[applyDeterministicFix] Fix returned null for:", checkId);
        return null;
      }
      console.log("[applyDeterministicFix]", checkId, "→", result.summary);

      // Push undo before applying
      const undoEntry = createUndoEntry(
        state.currentDocument,
        state.currentHtml,
        state.htmlOverrides,
        `Auto-fix: ${result.summary}`
      );

      // Apply all mutations
      let updatedDoc = state.currentDocument;
      for (const mutation of result.mutations) {
        updatedDoc = setByPath(updatedDoc, mutation.cadPath, mutation.value);
      }

      // For imports: keep the imported HTML, don't re-render from synthetic doc
      let newHtml: string;
      if (state.isImportedHtml) {
        newHtml = state.currentHtml;
      } else {
        const rendered = renderArticle({
          document: updatedDoc,
          htmlOverrides: state.htmlOverrides.length > 0 ? state.htmlOverrides : null,
          templateVersion: TEMPLATE_VERSION,
        });
        newHtml = rendered.html;
      }

      // Re-run QA
      const dom = new BrowserDomAdapter(newHtml);
      const qaScore = runQAChecks(updatedDoc, newHtml, dom, {
        isImported: state.isImportedHtml,
      });

      set({
        currentDocument: updatedDoc,
        currentHtml: newHtml,
        undoStack: pushToStack(state.undoStack, undoEntry),
        redoStack: [],
        qaScore,
      });

      return result;
    },

    applyBatchFixes: (checkIds: string[]) => {
      const state = get();
      if (!state.currentDocument || checkIds.length === 0) return;

      const tier1Ids = checkIds.filter((id) => getFixTier(id) === 1);
      const tier2Ids = checkIds.filter((id) => getFixTier(id) === 2);

      // Push undo once for the entire batch
      const undoEntry = createUndoEntry(
        state.currentDocument,
        state.currentHtml,
        state.htmlOverrides,
        `Batch fix: ${checkIds.length} issue(s)`
      );

      // Apply all Tier 1 fixes
      let updatedDoc = state.currentDocument;
      const appliedSummaries: string[] = [];

      for (const checkId of tier1Ids) {
        const entry = getFixEntry(checkId);
        if (!entry?.fix) continue;
        const result = entry.fix(updatedDoc);
        if (!result) continue;
        for (const mutation of result.mutations) {
          updatedDoc = setByPath(updatedDoc, mutation.cadPath, mutation.value);
        }
        appliedSummaries.push(result.summary);
      }

      // Re-render if any Tier 1 fixes applied (but not for imports — keep imported HTML)
      let newHtml = state.currentHtml;
      if (appliedSummaries.length > 0 && !state.isImportedHtml) {
        const rendered = renderArticle({
          document: updatedDoc,
          htmlOverrides: state.htmlOverrides.length > 0 ? state.htmlOverrides : null,
          templateVersion: TEMPLATE_VERSION,
        });
        newHtml = rendered.html;
      }

      // Re-run QA
      const dom = new BrowserDomAdapter(newHtml);
      const qaScore = runQAChecks(updatedDoc, newHtml, dom, {
        isImported: state.isImportedHtml,
      });

      set({
        currentDocument: updatedDoc,
        currentHtml: newHtml,
        undoStack: pushToStack(state.undoStack, undoEntry),
        redoStack: [],
        qaScore,
      });

      // Route Tier 2 items through the targeted fix endpoint
      if (tier2Ids.length > 0) {
        get().applyQaFix(tier2Ids);
      }
    },

    applyQaFix: async (checkIds: string[]) => {
      const state = get();
      if (!state.currentDocument || !state.currentHtml || checkIds.length === 0) {
        console.warn("[applyQaFix] Skipped — no document/html or empty checkIds");
        return;
      }

      console.log("[applyQaFix] Starting fix for:", checkIds);
      set({ isApplyingFix: true, statusMessage: "Applying AI fixes..." });

      try {
        // 90-second timeout — Claude API calls can take up to ~60s, plus network overhead
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90_000);

        const response = await fetch("/api/articles/qa/fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: state.currentDocument,
            html: state.currentHtml,
            checkIds,
            ...(state.isImportedHtml && { isImported: true }),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const result = await response.json();
        console.log("[applyQaFix] Response success:", result.success);

        if (!result.success) {
          console.error("[applyQaFix] Fix failed:", result.error);
          set({
            isApplyingFix: false,
            statusMessage: `Fix failed: ${result.error?.message || "Unknown error"}`,
          });
          return;
        }

        console.log("[applyQaFix] Applied:", result.data.appliedFixes, "tokens:", result.data.claudeTokensUsed);
        console.log("[applyQaFix] New QA score:", result.data.qaScore.total, "/", result.data.qaScore.possible,
          "fails:", result.data.qaScore.failCount, "warns:", result.data.qaScore.warnCount);

        // Re-read fresh state after the async gap
        const freshState = get();
        if (!freshState.currentDocument) {
          set({ isApplyingFix: false, statusMessage: "" });
          return;
        }

        // Push undo using CURRENT state (not the stale pre-fetch snapshot)
        const undoEntry = createUndoEntry(
          freshState.currentDocument,
          freshState.currentHtml,
          freshState.htmlOverrides,
          `QA fix: ${checkIds.length} issue(s)`
        );

        set({
          currentDocument: result.data.document,
          currentHtml: result.data.html,
          qaScore: result.data.qaScore,
          undoStack: pushToStack(freshState.undoStack, undoEntry),
          redoStack: [],
          isApplyingFix: false,
          statusMessage: "",
        });
        console.log("[applyQaFix] Store updated successfully");
      } catch (error) {
        const isTimeout = error instanceof DOMException && error.name === "AbortError";
        set({
          isApplyingFix: false,
          statusMessage: isTimeout
            ? "AI fix timed out — please try again"
            : `Fix failed: ${error instanceof Error ? error.message : "Network error"}`,
        });
      }
    },

    // Photo manifest
    setPhotoManifest: (manifest: PhotoManifest | null) => set({ photoManifest: manifest }),
    setIsPhotoSelectorOpen: (open: boolean) => set({ isPhotoSelectorOpen: open }),

    // === Finalization ===

    finalizeArticle: async () => {
      const state = get();
      if (!state.currentDocument || !state.currentHtml || !state.selectedArticleId) {
        console.warn("[finalizeArticle] Missing document, HTML, or article ID");
        return;
      }

      set({ isFinalizing: true, finalizationError: null, statusMessage: "Finalizing article..." });

      try {
        const response = await fetch(`/api/articles/${state.selectedArticleId}/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: state.currentDocument,
            html: state.currentHtml,
            htmlOverrides: state.htmlOverrides.length > 0 ? state.htmlOverrides : null,
            ...(state.isImportedHtml && { skipRender: true }),
          }),
        });

        const result = await response.json();

        if (!result.success) {
          set({
            isFinalizing: false,
            finalizationError: result.error?.message || "Finalization failed",
            statusMessage: "",
          });

          // If QA gate failed, open the scorecard
          if (result.error?.code === "QA_GATE_FAILED" && result.error?.details) {
            set({ qaScore: result.error.details, isScorecardOpen: true });
          }
          return;
        }

        // Update state with finalized result
        const freshState = get();
        set({
          isFinalizing: false,
          finalizationError: null,
          statusMessage: "",
          currentHtml: result.data.finalHtml,
          qaScore: result.data.qaScore,
          lastFinalizedVersion: result.data.documentVersion,
        });

        // Update the selected article status in store
        if (freshState.selectedArticle) {
          set({
            selectedArticle: {
              ...freshState.selectedArticle,
              status: "finalized" as any,
              wordCount: result.data.wordCount,
              qaScore: `${result.data.qaScore.total}/${result.data.qaScore.possible}`,
            },
          });
        }
      } catch (error) {
        set({
          isFinalizing: false,
          finalizationError: error instanceof Error ? error.message : "Network error",
          statusMessage: "",
        });
      }
    },

    publishArticle: async (url: string) => {
      const state = get();
      if (!state.selectedArticleId) return;

      set({ isPublishing: true, statusMessage: "Publishing article..." });

      try {
        const response = await fetch(`/api/articles/${state.selectedArticleId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publishedUrl: url }),
        });

        const result = await response.json();

        if (!result.success) {
          set({
            isPublishing: false,
            statusMessage: result.error?.message || "Publishing failed",
          });
          return;
        }

        const freshState = get();
        set({
          isPublishing: false,
          statusMessage: "",
        });

        if (freshState.selectedArticle) {
          set({
            selectedArticle: {
              ...freshState.selectedArticle,
              status: "published" as any,
              publishedDate: result.data.publishedDate,
              publishedUrl: url,
            },
          });
        }
      } catch (error) {
        set({
          isPublishing: false,
          statusMessage: error instanceof Error ? error.message : "Network error",
        });
      }
    },

    loadFinalizedArticle: async (articleId: number) => {
      set({ statusMessage: "Loading finalized article..." });

      try {
        const response = await fetch(`/api/articles/${articleId}`);
        const result = await response.json();

        if (!result.success || !result.data.latestDocument) {
          set({ statusMessage: "No finalized version found" });
          return;
        }

        const doc = result.data.latestDocument.canonicalDoc as CanonicalArticleDocument;
        const overrides = (result.data.latestDocument.htmlOverrides as HtmlOverride[]) || [];

        // Re-render HTML from stored document
        const rendered = renderArticle({
          document: doc,
          htmlOverrides: overrides.length > 0 ? overrides : null,
          templateVersion: TEMPLATE_VERSION,
        });

        set({
          currentDocument: doc,
          currentHtml: rendered.html,
          htmlOverrides: overrides,
          selectedArticleId: articleId,
          lastFinalizedVersion: result.data.latestDocument.version,
          statusMessage: "",
        });

        // Run QA so the scorecard is immediately available
        try {
          const dom = new BrowserDomAdapter(rendered.html);
          const qaScore = runQAChecks(doc, rendered.html, dom);
          set({ qaScore: { ...qaScore } });
        } catch (qaError) {
          console.error("[loadFinalizedArticle] QA check failed:", qaError);
        }

        // Load version history
        const versionsResponse = await fetch(`/api/articles/${articleId}/versions`);
        const versionsResult = await versionsResponse.json();

        if (versionsResult.success) {
          console.log("[loadFinalizedArticle] Loaded", versionsResult.data.length, "versions");
        }
      } catch (error) {
        set({
          statusMessage: error instanceof Error ? error.message : "Failed to load article",
        });
      }
    },

    // === HTML Import ===

    importHtml: (html: string, source: 'paste' | 'upload', filename?: string) => {
      const state = get();

      // Push undo if there's an existing document
      let newUndoStack = state.undoStack;
      if (state.currentDocument) {
        const entry = createUndoEntry(
          state.currentDocument,
          state.currentHtml,
          state.htmlOverrides,
          "Before HTML import"
        );
        newUndoStack = pushToStack(state.undoStack, entry);
      }

      // Extract metadata from the imported HTML
      const metadata = extractMetadataFromHtmlBrowser(html);

      // Build synthetic canonical doc if we have a selected article
      let syntheticDoc: CanonicalArticleDocument | null = null;
      if (state.selectedArticle) {
        syntheticDoc = buildSyntheticDocument(metadata, state.selectedArticle);
      }

      set({
        currentHtml: html,
        currentDocument: syntheticDoc,
        isImportedHtml: true,
        importSource: source,
        editingMode: "chat",
        previewMode: "preview",
        undoStack: newUndoStack,
        redoStack: [],
        qaScore: null,
        isScorecardOpen: false,
        statusMessage: filename ? `Imported: ${filename}` : "HTML imported",
      });
    },

    clearImport: () => {
      set({
        isImportedHtml: false,
        importSource: null,
      });
    },

    // Writing style
    setSelectedStyleId: (id: number | null) => set({ selectedStyleId: id }),

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

export function selectQaScore(state: ArticleEditorState): QAScore | null {
  return state.qaScore;
}

export function selectIsScorecardOpen(state: ArticleEditorState): boolean {
  return state.isScorecardOpen;
}
