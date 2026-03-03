"use client";

import { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, AlertTriangle } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";
import type { ContentMapEntry } from "@/types/content-map";

interface ImportHtmlModalProps {
  onClose: () => void;
}

export function ImportHtmlModal({ onClose }: ImportHtmlModalProps) {
  const selectedArticle = useArticleStore((s) => s.selectedArticle);
  const importHtml = useArticleStore((s) => s.importHtml);

  const [htmlContent, setHtmlContent] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [source, setSource] = useState<"paste" | "upload">("paste");
  const [articles, setArticles] = useState<ContentMapEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(
    selectedArticle?.id ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch articles for the dropdown if no article is selected in the editor
  useEffect(() => {
    if (selectedArticle) return;
    let cancelled = false;
    fetch("/api/content-map")
      .then((r) => r.json())
      .then((result) => {
        if (cancelled || !result.success) return;
        // Show all articles — import can overwrite any status
        const eligible = result.data as ContentMapEntry[];
        setArticles(eligible);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedArticle]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.html?$/i)) {
      setError("Please select an .html or .htm file");
      return;
    }
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setHtmlContent(content);
      setFilename(file.name);
      setSource("upload");
      setError(null);
      setIsLoading(false);
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setIsLoading(false);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    // Validation
    const trimmed = htmlContent.trim();
    if (!trimmed) {
      setError("Please paste HTML or upload a file");
      return;
    }
    if (!trimmed.includes("<")) {
      setError("Content does not appear to be HTML");
      return;
    }
    const articleId = selectedArticle?.id ?? selectedId;
    if (!articleId) {
      setError("Please select an article");
      return;
    }
    // Import
    importHtml(trimmed, source, filename || undefined);
    onClose();
  };

  const selectedEntry = selectedArticle
    || articles.find((a) => a.id === selectedId);
  const isFinalized = selectedEntry?.status === "finalized" || selectedEntry?.status === "published";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          maxHeight: "80vh",
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #e8e6e6",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Upload style={{ width: "18px", height: "18px", color: "#bc9b5d" }} />
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
              Import HTML
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#414141",
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          {/* Article selector — show only if no article is selected in editor */}
          {!selectedArticle && (
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "6px",
                  color: "#242323",
                }}
              >
                Target Article
              </label>
              <select
                value={selectedId ?? ""}
                onChange={(e) => {
                  setSelectedId(e.target.value ? parseInt(e.target.value, 10) : null);
                  setError(null);
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "13px",
                  border: "1px solid #cccccc",
                  borderRadius: "6px",
                  background: "#ffffff",
                }}
              >
                <option value="">Select an article...</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.articleType}] {a.title} ({a.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Already-selected article indicator */}
          {selectedArticle && (
            <div
              style={{
                padding: "8px 12px",
                marginBottom: "16px",
                background: "#f7f7f7",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#414141",
              }}
            >
              Importing to: <strong>{selectedArticle.title}</strong>
            </div>
          )}

          {/* Finalized warning */}
          {isFinalized && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                marginBottom: "16px",
                background: "#fefce8",
                border: "1px solid #fde047",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#a16207",
              }}
            >
              <AlertTriangle style={{ width: "14px", height: "14px", flexShrink: 0 }} />
              This article is already finalized. Importing will create a new version.
            </div>
          )}

          {/* File upload */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                marginBottom: "6px",
                color: "#242323",
              }}
            >
              Upload HTML File
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                border: "2px dashed #cccccc",
                borderRadius: "6px",
                cursor: "pointer",
                color: "#414141",
                fontSize: "13px",
              }}
            >
              <FileText style={{ width: "16px", height: "16px" }} />
              {filename ? filename : "Click to upload .html file"}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </div>

          {/* Divider */}
          <div
            style={{
              textAlign: "center",
              fontSize: "12px",
              color: "#999",
              margin: "12px 0",
            }}
          >
            — or paste HTML below —
          </div>

          {/* Paste textarea */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                marginBottom: "6px",
                color: "#242323",
              }}
            >
              Paste HTML
            </label>
            <textarea
              value={htmlContent}
              onChange={(e) => {
                setHtmlContent(e.target.value);
                setSource("paste");
                setFilename(null);
                setError(null);
              }}
              placeholder="Paste your HTML here..."
              style={{
                width: "100%",
                minHeight: "200px",
                padding: "10px 12px",
                fontSize: "12px",
                fontFamily: "monospace",
                border: "1px solid #cccccc",
                borderRadius: "6px",
                resize: "vertical",
                lineHeight: "1.5",
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "8px 12px",
                marginBottom: "12px",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#b91c1c",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            padding: "12px 20px",
            borderTop: "1px solid #e8e6e6",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              background: "#ffffff",
              border: "1px solid #cccccc",
              borderRadius: "6px",
              cursor: "pointer",
              color: "#414141",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isLoading || !htmlContent.trim()}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              background: htmlContent.trim() ? "#bc9b5d" : "#e8e6e6",
              color: htmlContent.trim() ? "#ffffff" : "#999",
              border: "none",
              borderRadius: "6px",
              cursor: htmlContent.trim() ? "pointer" : "default",
            }}
          >
            Import & Preview
          </button>
        </div>
      </div>
    </>
  );
}
