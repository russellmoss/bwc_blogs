"use client";

import { useArticleStore } from "@/lib/store/article-store";

export function StreamingMessage() {
  const { statusMessage, streamingText, isGenerating } = useArticleStore();

  if (!isGenerating) return null;

  return (
    <div style={{ padding: "12px 16px" }}>
      {statusMessage && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <div style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#bc9b5d",
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
          <span style={{ fontSize: "14px", color: "#414141", fontStyle: "italic" }}>{statusMessage}</span>
        </div>
      )}

      {streamingText && (
        <div style={{
          background: "#f7f7f7",
          borderRadius: "8px",
          padding: "12px 16px",
          fontSize: "14px",
          color: "#242323",
          whiteSpace: "pre-wrap",
        }}>
          {streamingText}
          <span style={{
            display: "inline-block",
            width: "6px",
            height: "16px",
            background: "#bc9b5d",
            marginLeft: "2px",
            verticalAlign: "text-bottom",
            animation: "pulse 1s ease-in-out infinite",
          }} />
        </div>
      )}
    </div>
  );
}
