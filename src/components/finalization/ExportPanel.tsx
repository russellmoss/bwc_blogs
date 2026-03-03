"use client";

import { useState } from "react";
import { Copy, Download, Check } from "lucide-react";

interface ExportPanelProps {
  html: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
}

function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch ? bodyMatch[1].trim() : html;
}

function CopyButton({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: 500,
        background: copied ? "#f0fdf4" : "#ffffff",
        color: copied ? "#15803d" : "#414141",
        border: "1px solid #cccccc",
        borderRadius: "6px",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {copied ? <Check style={{ width: "14px", height: "14px" }} /> : <Copy style={{ width: "14px", height: "14px" }} />}
      {copied ? "Copied!" : label}
    </button>
  );
}

export function ExportPanel({ html, metaTitle, metaDescription, slug }: ExportPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "article"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: "4px 10px",
          fontSize: "11px",
          background: "#f7f7f7",
          border: "1px solid #cccccc",
          borderRadius: "4px",
          cursor: "pointer",
          color: "#414141",
        }}
      >
        Show Export
      </button>
    );
  }

  return (
    <div
      style={{
        background: "#fcf8ed",
        border: "1px solid #bc9b5d",
        borderRadius: "8px",
        padding: "12px",
        marginTop: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#000000" }}>
          Export for Wix
        </span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            color: "#414141",
          }}
        >
          &times;
        </button>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <CopyButton label="Copy Meta Title" value={metaTitle} />
        <CopyButton label="Copy Meta Desc" value={metaDescription} />
        <CopyButton label="Copy HTML for Wix" value={extractBodyContent(html)} />
        <button
          onClick={handleDownload}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 500,
            background: "#ffffff",
            color: "#414141",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          <Download style={{ width: "14px", height: "14px" }} />
          Download .html
        </button>
      </div>
    </div>
  );
}
