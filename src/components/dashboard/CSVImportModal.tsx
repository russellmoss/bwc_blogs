"use client";

import { useState, useRef } from "react";
import { X, Upload, FileText, Download } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboard-store";

interface CSVImportModalProps {
  onClose: () => void;
}

interface PreviewData {
  rowCount: number;
  headers: string[];
  firstRows: string[][];
}

function parsePreview(csvText: string): PreviewData {
  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rowCount: 0, headers: [], firstRows: [] };
  }

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const dataLines = lines.slice(1);
  const firstRows = dataLines.slice(0, 3).map((line) =>
    line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
  );

  return { rowCount: dataLines.length, headers, firstRows };
}

const CSV_TEMPLATE_HEADERS = [
  "Hub Article",
  "Article Type",
  "Spoke Article Title",
  "Target Keywords",
  "Search Volume Est.",
  "Difficulty",
  "Target Audience",
  "Internal Links To",
  "Suggested External Source Links",
  "Content Notes",
];

const CSV_TEMPLATE_EXAMPLE = [
  "Bhutanese Wine",
  "hub",
  "",
  "bhutanese wine; wine from bhutan",
  "medium",
  "medium",
  "Wine enthusiasts",
  "red-rice-wine-guide; bhutan-grape-varieties",
  "https://example.com/wine-source",
  "Pillar page for the Bhutanese Wine hub",
];

function downloadTemplate() {
  const header = CSV_TEMPLATE_HEADERS.join(",");
  const example = CSV_TEMPLATE_EXAMPLE.map((v) =>
    v.includes(",") || v.includes(";") ? `"${v}"` : v
  ).join(",");
  const csv = header + "\n" + example + "\n";

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "content-map-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function CSVImportModal({ onClose }: CSVImportModalProps) {
  const fetchArticles = useDashboardStore((s) => s.fetchArticles);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; hubs: number; spokes: number } | null>(null);

  function handleTextChange(text: string) {
    setCsvText(text);
    setError(null);
    setResult(null);
    if (text.trim()) {
      setPreview(parsePreview(text));
    } else {
      setPreview(null);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleTextChange(text);
    };
    reader.readAsText(file);
  }

  async function handleSubmit() {
    if (!csvText.trim()) {
      setError("No CSV data provided");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/content-map/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Import failed");
        return;
      }

      setResult(data.data);
      await fetchArticles();
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsSubmitting(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#414141",
    marginBottom: "4px",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.2)",
          zIndex: 50,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          maxWidth: "90vw",
          maxHeight: "85vh",
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e8e6e6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#242323",
              margin: 0,
            }}
          >
            Import CSV
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#888",
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Download template */}
          <div
            style={{
              padding: "10px 14px",
              background: "#fcf8ed",
              borderRadius: "6px",
              border: "1px solid #e8dcc5",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "13px", color: "#414141" }}>
              Need the right format? Grab the template first.
            </span>
            <button
              type="button"
              onClick={downloadTemplate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                background: "transparent",
                color: "#bc9b5d",
                border: "1px solid #bc9b5d",
                borderRadius: "6px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Download style={{ width: "13px", height: "13px" }} />
              Download Template
            </button>
          </div>

          {/* File upload */}
          <div>
            <label style={labelStyle}>Upload CSV File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 500,
                background: "transparent",
                color: "#414141",
                border: "1px dashed #cccccc",
                borderRadius: "6px",
                cursor: "pointer",
                width: "100%",
                justifyContent: "center",
              }}
            >
              <Upload style={{ width: "14px", height: "14px" }} />
              Choose .csv file
            </button>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: "#888",
              fontSize: "12px",
            }}
          >
            <div style={{ flex: 1, height: "1px", background: "#e8e6e6" }} />
            or paste CSV text
            <div style={{ flex: 1, height: "1px", background: "#e8e6e6" }} />
          </div>

          {/* Paste area */}
          <div>
            <label style={labelStyle}>
              <FileText
                style={{
                  width: "12px",
                  height: "12px",
                  display: "inline",
                  verticalAlign: "middle",
                  marginRight: "4px",
                }}
              />
              CSV Text
            </label>
            <textarea
              value={csvText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={"Hub Article,Article Type,Spoke Article Title,Target Keywords,...\nBhutanese Wine,hub,,\"bhutanese wine; wine from bhutan\",..."}
              rows={6}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "12px",
                fontFamily: "monospace",
                border: "1px solid #cccccc",
                borderRadius: "6px",
                outline: "none",
                color: "#242323",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Preview */}
          {preview && preview.rowCount > 0 && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#414141", marginBottom: "6px" }}>
                Preview — {preview.rowCount} row{preview.rowCount !== 1 ? "s" : ""} detected
              </div>
              <div
                style={{
                  overflow: "auto",
                  border: "1px solid #e8e6e6",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    whiteSpace: "nowrap",
                  }}
                >
                  <thead>
                    <tr>
                      {preview.headers.map((h, i) => (
                        <th
                          key={i}
                          style={{
                            padding: "6px 8px",
                            textAlign: "left",
                            background: "#f7f7f7",
                            color: "#414141",
                            fontWeight: 600,
                            borderBottom: "1px solid #e8e6e6",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.firstRows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            style={{
                              padding: "4px 8px",
                              color: "#242323",
                              borderBottom: "1px solid #f3f3f3",
                              maxWidth: "150px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rowCount > 3 && (
                <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                  ... and {preview.rowCount - 3} more row{preview.rowCount - 3 !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "8px 12px",
                fontSize: "13px",
                color: "#b91c1c",
                background: "#fef2f2",
                borderRadius: "6px",
                border: "1px solid #fecaca",
              }}
            >
              {error}
            </div>
          )}

          {/* Success result */}
          {result && (
            <div
              style={{
                padding: "10px 14px",
                fontSize: "13px",
                color: "#065f46",
                background: "#ecfdf5",
                borderRadius: "6px",
                border: "1px solid #a7f3d0",
              }}
            >
              Imported {result.imported} article{result.imported !== 1 ? "s" : ""} ({result.hubs} hub{result.hubs !== 1 ? "s" : ""}, {result.spokes} spoke{result.spokes !== 1 ? "s" : ""})
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              paddingTop: "4px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                background: "transparent",
                color: "#414141",
                border: "1px solid #cccccc",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {result ? "Close" : "Cancel"}
            </button>
            {!result && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !csvText.trim()}
                style={{
                  padding: "8px 20px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: isSubmitting || !csvText.trim() ? "#d4b87a" : "#bc9b5d",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: isSubmitting || !csvText.trim() ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Importing..." : "Import"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
