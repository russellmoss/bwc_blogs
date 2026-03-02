"use client";

import { useArticleStore } from "@/lib/store/article-store";
import { PreviewToolbar } from "./PreviewToolbar";
import { PreviewIframe } from "./PreviewIframe";
import { HtmlSourceView } from "./HtmlSourceView";

export function PreviewPanel() {
  const { previewMode } = useArticleStore();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PreviewToolbar />
      <div style={{ flex: 1, overflow: "hidden" }}>
        {previewMode === "preview" ? <PreviewIframe /> : <HtmlSourceView />}
      </div>
    </div>
  );
}
