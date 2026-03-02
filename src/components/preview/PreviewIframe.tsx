"use client";

import { useArticleStore, selectEffectiveHtml } from "@/lib/store/article-store";

export function PreviewIframe() {
  const viewportMode = useArticleStore((s) => s.viewportMode);
  const currentHtml = useArticleStore(selectEffectiveHtml);

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
          srcDoc={currentHtml}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Article preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
