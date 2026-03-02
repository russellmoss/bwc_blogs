"use client";

import { useArticleStore } from "@/lib/store/article-store";
import { PreviewToolbar } from "./PreviewToolbar";
import { PreviewIframe } from "./PreviewIframe";
import { HtmlSourceView } from "./HtmlSourceView";
import { CanvasEditOverlay } from "@/components/canvas-edit";
import { HtmlEditor } from "@/components/html-editor";

export function PreviewPanel() {
  const { previewMode, editingMode } = useArticleStore();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PreviewToolbar />
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
      </div>
    </div>
  );
}
