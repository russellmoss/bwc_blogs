"use client";

import dynamic from "next/dynamic";

const HtmlEditorInner = dynamic(
  () => import("./HtmlEditorInner").then((m) => ({ default: m.HtmlEditorInner })),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: "100%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#94a3b8", fontSize: "13px" }}>Loading editor...</span>
      </div>
    ),
  }
);

export function HtmlEditor() {
  return <HtmlEditorInner />;
}
