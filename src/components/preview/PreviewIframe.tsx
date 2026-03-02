"use client";

import { useRef, useCallback } from "react";
import { useArticleStore, selectEffectiveHtml } from "@/lib/store/article-store";

export function PreviewIframe() {
  const viewportMode = useArticleStore((s) => s.viewportMode);
  const isCanvasEditing = useArticleStore((s) => s.isCanvasEditing);
  const currentHtml = useArticleStore(selectEffectiveHtml);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastHtmlRef = useRef<string>("");

  // Expose iframe ref for canvas edit overlay
  const setIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    (iframeRef as React.MutableRefObject<HTMLIFrameElement | null>).current = el;
    // Store ref globally for CanvasEditOverlay to access
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__bwcIframeRef = el;
    }
  }, []);

  // Determine which HTML to render — suppress updates during canvas editing
  const displayHtml = isCanvasEditing ? lastHtmlRef.current : currentHtml;
  if (!isCanvasEditing) {
    lastHtmlRef.current = currentHtml;
  }

  if (!currentHtml) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f7f7" }}>
        <p className="text-[#414141] text-sm">
          Preview will appear here after generation
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", justifyContent: "center", background: "#e8e6e6", overflow: "auto", padding: "16px" }}>
      <div
        style={{
          width: viewportMode === "mobile" ? "375px" : "100%",
          maxWidth: viewportMode === "desktop" ? "1200px" : "375px",
          height: "100%",
          background: "#ffffff",
          boxShadow: "0 10px 15px -3px rgba(0,0,0,.1)",
          transition: "all 300ms",
        }}
      >
        <iframe
          ref={setIframeRef}
          srcDoc={displayHtml}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Article preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
