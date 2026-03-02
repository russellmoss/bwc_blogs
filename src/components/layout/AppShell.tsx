"use client";

import { ArticleSelector } from "./ArticleSelector";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#ffffff" }}>
      {/* Header */}
      <header
        style={{
          height: "56px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: "16px",
          borderBottom: "1px solid #e8e6e6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px", fontFamily: "serif", fontWeight: 600, color: "#bc9b5d" }}>
            BWC
          </span>
          <span style={{ fontSize: "14px", color: "#414141" }}>Content Engine</span>
        </div>
        <div style={{ borderLeft: "1px solid #e8e6e6", height: "24px", margin: "0 8px" }} />
        <ArticleSelector />
      </header>

      {/* Main content — fills remaining viewport */}
      <main style={{ flex: 1, overflow: "hidden" }}>{children}</main>
    </div>
  );
}
