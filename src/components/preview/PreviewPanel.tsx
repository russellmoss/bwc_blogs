"use client";

import { useArticleStore } from "@/lib/store/article-store";
import { PreviewToolbar } from "./PreviewToolbar";
import { PreviewIframe } from "./PreviewIframe";
import { CanvasEditOverlay } from "@/components/canvas-edit";
import { HtmlEditor } from "@/components/html-editor";
import { ScorecardPanel } from "@/components/scorecard";
import { ExportPanel } from "@/components/finalization/ExportPanel";
import { CitationView } from "./CitationView";

export function PreviewPanel() {
  const editingMode = useArticleStore((s) => s.editingMode);
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
        {editingMode === "citation" ? (
          <CitationView />
        ) : editingMode === "html" ? (
          <HtmlEditor />
        ) : (
          <>
            <PreviewIframe />
            {editingMode === "canvas" && <CanvasEditOverlay />}
          </>
        )}
        <ScorecardPanel />
      </div>
    </div>
  );
}
