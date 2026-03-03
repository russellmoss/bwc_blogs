"use client";

import { useState } from "react";
import { Lock, Loader2, XCircle } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";

export function FinalizeButton() {
  const {
    currentDocument,
    currentHtml,
    isFinalizing,
    finalizationError,
    lastFinalizedVersion,
    qaScore,
    finalizeArticle,
  } = useArticleStore();
  const [showError, setShowError] = useState(false);

  const hasDocument = !!currentDocument && !!currentHtml;
  const qaCanFinalize = qaScore?.canFinalize ?? false;
  const alreadyFinalized = !!lastFinalizedVersion;
  const hasError = !!finalizationError;

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <button
        onClick={finalizeArticle}
        disabled={isFinalizing || !hasDocument}
        title={
          !hasDocument
            ? "Generate an article first"
            : isFinalizing
              ? "Finalizing..."
              : alreadyFinalized
                ? `Re-finalize (current: v${lastFinalizedVersion})`
                : "Finalize article to permanent storage"
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: 500,
          background: isFinalizing
            ? "#e8e6e6"
            : hasError
              ? "#fef2f2"
              : qaCanFinalize
                ? "#bc9b5d"
                : "#f7f7f7",
          color: isFinalizing
            ? "#414141"
            : hasError
              ? "#b91c1c"
              : qaCanFinalize
                ? "#ffffff"
                : "#414141",
          border: hasError ? "1px solid #fca5a5" : "1px solid #cccccc",
          cursor: isFinalizing || !hasDocument ? "default" : "pointer",
          opacity: !hasDocument ? 0.5 : 1,
        }}
      >
        {isFinalizing ? (
          <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
        ) : hasError ? (
          <XCircle style={{ width: "14px", height: "14px" }} />
        ) : (
          <Lock style={{ width: "14px", height: "14px" }} />
        )}
        {isFinalizing
          ? "Finalizing..."
          : alreadyFinalized
            ? `Re-finalize (v${lastFinalizedVersion})`
            : "Finalize"}
      </button>

      {/* Error indicator dot — click to toggle tooltip */}
      {hasError && (
        <button
          onClick={() => setShowError(!showError)}
          title="Click to see error details"
          style={{
            marginLeft: "4px",
            background: "#b91c1c",
            color: "#fff",
            border: "none",
            borderRadius: "999px",
            fontSize: "10px",
            fontWeight: 700,
            width: "18px",
            height: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          !
        </button>
      )}

      {/* Error tooltip — positioned as dropdown, doesn't push layout */}
      {hasError && showError && (
        <>
          <div
            onClick={() => setShowError(false)}
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
          />
          <div style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "6px",
            width: "320px",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 100,
            padding: "10px 12px",
            fontSize: "12px",
            lineHeight: "1.5",
            color: "#b91c1c",
          }}>
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>Finalization Failed</div>
            <div style={{ color: "#414141" }}>{finalizationError}</div>
            <div style={{ marginTop: "6px", fontSize: "11px", color: "#6b7280" }}>
              Fix remaining FAIL-level QA issues, then try again.
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
