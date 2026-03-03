"use client";

import { useArticleStore } from "@/lib/store/article-store";
import { PreviewToolbar } from "./PreviewToolbar";
import { PreviewIframe } from "./PreviewIframe";
import { HtmlSourceView } from "./HtmlSourceView";
import { CanvasEditOverlay } from "@/components/canvas-edit";
import { HtmlEditor } from "@/components/html-editor";
import { ScorecardPanel } from "@/components/scorecard";
import { ExportPanel } from "@/components/finalization/ExportPanel";

export function PreviewPanel() {
  const { previewMode, editingMode } = useArticleStore();
  const lastFinalizedVersion = useArticleStore((s) => s.lastFinalizedVersion);
  const currentHtml = useArticleStore((s) => s.currentHtml);
  const currentDocument = useArticleStore((s) => s.currentDocument);
  const selectedArticle = useArticleStore((s) => s.selectedArticle);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PreviewToolbar />
      {lastFinalizedVersion && currentHtml && (
        <div style={{ padding: "0 12px" }}>
          <ExportPanel
            html={currentHtml}
            metaTitle={currentDocument?.metaTitle || selectedArticle?.title || ""}
            metaDescription={currentDocument?.metaDescription || ""}
            slug={selectedArticle?.slug || "article"}
          />
        </div>
      )}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {editingMode === "html" ? (
          <HtmlEditor />
        ) : previewMode === "preview" ? (
          <>
            <PreviewIframe />
            {editingMode === "canvas" && <CanvasEditOverlay />}
          </>
        ) : (
          <HtmlSourceView />
        )}
        <ScorecardPanel />
      </div>
    </div>
  );
}
