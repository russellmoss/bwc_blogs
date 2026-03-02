"use client";

import { useCallback, useEffect, useState } from "react";
import { X, RotateCw, Shield, Zap } from "lucide-react";
import { useArticleStore, selectQaScore, selectIsScorecardOpen } from "@/lib/store/article-store";
import { ScorecardItem } from "./ScorecardItem";
import { getFixTier } from "@/lib/qa";
import type { QAResult } from "@/types/qa";

export function ScorecardPanel() {
  const qaScore = useArticleStore(selectQaScore);
  const isScorecardOpen = useArticleStore(selectIsScorecardOpen);
  const isApplyingFix = useArticleStore((s) => s.isApplyingFix);
  const {
    setIsScorecardOpen,
    setEditingMode,
    setPendingChatMessage,
    runQa,
    applyDeterministicFix,
    applyBatchFixes,
    applyQaFix,
  } = useArticleStore();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRerunning, setIsRerunning] = useState(false);

  // Clear selection when QA results change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [qaScore]);

  // Inject highlight styles into iframe on mount
  useEffect(() => {
    if (!isScorecardOpen) return;
    const iframe = (window as unknown as Record<string, unknown>).__bwcIframeRef as HTMLIFrameElement | null;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    // Inject styles if not already present
    if (!doc.getElementById("bwc-qa-highlight")) {
      const style = doc.createElement("style");
      style.id = "bwc-qa-highlight";
      style.textContent = `
        .bwc-qa-highlight-fail {
          outline: 3px solid #ef4444 !important;
          outline-offset: 4px !important;
          background-color: rgba(239, 68, 68, 0.05) !important;
          transition: outline-color 0.2s, background-color 0.2s;
        }
        .bwc-qa-highlight-warn {
          outline: 3px solid #f59e0b !important;
          outline-offset: 4px !important;
          background-color: rgba(245, 158, 11, 0.05) !important;
          transition: outline-color 0.2s, background-color 0.2s;
        }
      `;
      doc.head.appendChild(style);
    }

    // Cleanup highlights on unmount
    return () => {
      if (!doc) return;
      doc.querySelectorAll(".bwc-qa-highlight-fail, .bwc-qa-highlight-warn").forEach((el) => {
        el.classList.remove("bwc-qa-highlight-fail", "bwc-qa-highlight-warn");
      });
    };
  }, [isScorecardOpen]);

  const handleHighlight = useCallback(
    (elementPath: string | null, severity: "fail" | "warn") => {
      if (!elementPath) return;
      const iframe = (window as unknown as Record<string, unknown>).__bwcIframeRef as HTMLIFrameElement | null;
      const doc = iframe?.contentDocument;
      if (!doc) return;

      // Clear previous highlights
      doc.querySelectorAll(".bwc-qa-highlight-fail, .bwc-qa-highlight-warn").forEach((el) => {
        el.classList.remove("bwc-qa-highlight-fail", "bwc-qa-highlight-warn");
      });

      // Determine how to query: if elementPath is already a CSS selector
      // (starts with [, ., or #), use it directly; otherwise wrap as data-cad-path
      let target: Element | null = null;
      if (!elementPath.startsWith("[") && !elementPath.startsWith(".") && !elementPath.startsWith("#")) {
        target = doc.querySelector(`[data-cad-path="${elementPath}"]`);
      }
      if (!target) {
        try {
          target = doc.querySelector(elementPath);
        } catch {
          // Invalid selector — ignore
        }
      }

      if (target) {
        const className = severity === "fail" ? "bwc-qa-highlight-fail" : "bwc-qa-highlight-warn";
        target.classList.add(className);
        target.scrollIntoView({ behavior: "smooth", block: "center" });

        // Auto-remove after 4 seconds
        setTimeout(() => {
          target?.classList.remove(className);
        }, 4000);
      }
    },
    []
  );

  const handleFixInChat = useCallback(
    (suggestion: string) => {
      setIsScorecardOpen(false);
      setEditingMode("chat");
      setPendingChatMessage(suggestion);
    },
    [setIsScorecardOpen, setEditingMode, setPendingChatMessage]
  );

  const handleFixInCanvas = useCallback(
    (elementPath: string | null) => {
      setIsScorecardOpen(false);
      setEditingMode("canvas");
      // Highlight will be applied after canvas overlay mounts
      if (elementPath) {
        setTimeout(() => handleHighlight(elementPath, "warn"), 500);
      }
    },
    [setIsScorecardOpen, setEditingMode, handleHighlight]
  );

  const handleToggleSelect = useCallback((checkId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return next;
    });
  }, []);

  const handleAutoFix = useCallback(
    (checkId: string) => {
      applyDeterministicFix(checkId);
    },
    [applyDeterministicFix]
  );

  const handleFixSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const t1 = ids.filter((id) => getFixTier(id) === 1);
    const t2 = ids.filter((id) => getFixTier(id) === 2);

    // Apply Tier 1 deterministically (sync)
    if (t1.length > 0 && t2.length === 0) {
      applyBatchFixes(t1);
    } else if (t1.length === 0 && t2.length > 0) {
      applyQaFix(t2);
    } else {
      // Mixed: apply Tier 1 first, then Tier 2 via targeted endpoint
      applyBatchFixes(t1);
      applyQaFix(t2);
    }
    setSelectedIds(new Set());
  }, [selectedIds, applyBatchFixes, applyQaFix]);

  if (!isScorecardOpen || !qaScore) return null;

  // Group results by severity
  const failResults = qaScore.results.filter(
    (r) => !r.passed && r.check.severity === "fail"
  );
  const warnResults = qaScore.results.filter(
    (r) => !r.passed && r.check.severity === "warn"
  );
  const passResults = qaScore.results.filter((r) => r.passed);

  const scorePercent = qaScore.possible > 0
    ? Math.round((qaScore.total / qaScore.possible) * 100)
    : 0;

  // Count how many selected are Tier 1 vs Tier 2
  const selectedTier1Count = Array.from(selectedIds).filter((id) => getFixTier(id) === 1).length;
  const selectedTier2Count = selectedIds.size - selectedTier1Count;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: "380px",
        height: "100%",
        background: "#ffffff",
        borderLeft: "2px solid #e8e6e6",
        boxShadow: "-4px 0 12px rgba(0,0,0,0.1)",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`@keyframes bwc-spin { to { transform: rotate(360deg); } }`}</style>

      {isApplyingFix && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255, 255, 255, 0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 25,
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              border: "3px solid #e8e6e6",
              borderTopColor: "#bc9b5d",
              borderRadius: "50%",
              animation: "bwc-spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: "13px", color: "#414141", fontWeight: 500 }}>
            Applying AI fixes...
          </span>
        </div>
      )}

      {/* Sticky header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #e8e6e6",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield style={{ width: "18px", height: "18px", color: "#bc9b5d" }} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#242323" }}>
              Article Scorecard
            </span>
          </div>
          <button
            onClick={() => setIsScorecardOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "4px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#414141",
            }}
          >
            <X style={{ width: "16px", height: "16px" }} />
          </button>
        </div>

        {/* Score summary */}
        <div style={{ marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "#242323" }}>
              {qaScore.total}/{qaScore.possible}
            </span>
            <span style={{
              fontSize: "12px",
              fontWeight: 600,
              color: qaScore.canFinalize ? "#15803d" : "#b91c1c",
              background: qaScore.canFinalize ? "#f0fdf4" : "#fef2f2",
              padding: "2px 8px",
              borderRadius: "999px",
            }}>
              {qaScore.canFinalize ? "Can finalize" : "Blocked"}
            </span>
          </div>
        </div>

        {/* Score bar */}
        <div style={{ height: "6px", background: "#e8e6e6", borderRadius: "3px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${scorePercent}%`,
              background: qaScore.canFinalize ? "#bc9b5d" : "#b91c1c",
              borderRadius: "3px",
              transition: "width 0.3s",
            }}
          />
        </div>
        <div style={{ fontSize: "11px", color: "#414141", marginTop: "4px" }}>
          {qaScore.passCount} passed, {qaScore.failCount} failed, {qaScore.warnCount} warnings
        </div>
      </div>

      {/* Scrollable results */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {/* FAIL section */}
        {failResults.length > 0 && (
          <ResultSection
            title={`BLOCKERS (${failResults.length})`}
            titleColor="#b91c1c"
            results={failResults}
            selectedIds={selectedIds}
            onHighlight={handleHighlight}
            onFixInChat={handleFixInChat}
            onFixInCanvas={handleFixInCanvas}
            onToggleSelect={handleToggleSelect}
            onAutoFix={handleAutoFix}
          />
        )}

        {/* WARN section */}
        {warnResults.length > 0 && (
          <ResultSection
            title={`WARNINGS (${warnResults.length})`}
            titleColor="#a16207"
            results={warnResults}
            selectedIds={selectedIds}
            onHighlight={handleHighlight}
            onFixInChat={handleFixInChat}
            onFixInCanvas={handleFixInCanvas}
            onToggleSelect={handleToggleSelect}
            onAutoFix={handleAutoFix}
          />
        )}

        {/* PASS section (collapsed by default) */}
        {passResults.length > 0 && (
          <CollapsibleSection
            title={`PASSED (${passResults.length})`}
            titleColor="#15803d"
            results={passResults}
            onHighlight={handleHighlight}
            onFixInChat={handleFixInChat}
            onFixInCanvas={handleFixInCanvas}
          />
        )}
      </div>

      {/* Footer actions */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #e8e6e6",
          display: "flex",
          gap: "8px",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        {selectedIds.size > 0 && (
          <button
            onClick={handleFixSelected}
            disabled={isApplyingFix}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              background: "#15803d",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: isApplyingFix ? "not-allowed" : "pointer",
              opacity: isApplyingFix ? 0.5 : 1,
            }}
          >
            <Zap style={{ width: "12px", height: "12px" }} />
            Fix Selected ({selectedIds.size})
            {selectedTier1Count > 0 && selectedTier2Count > 0 && (
              <span style={{ fontSize: "10px", opacity: 0.8 }}>
                {selectedTier1Count} auto + {selectedTier2Count} AI
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => {
            if (isApplyingFix || isRerunning) return;
            setIsRerunning(true);
            // Brief visual flash then run QA
            setTimeout(() => {
              runQa();
              setIsRerunning(false);
            }, 150);
          }}
          disabled={isApplyingFix || isRerunning}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            fontSize: "12px",
            fontWeight: 500,
            background: "#bc9b5d",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            cursor: isApplyingFix || isRerunning ? "not-allowed" : "pointer",
            opacity: isApplyingFix || isRerunning ? 0.5 : 1,
          }}
        >
          <RotateCw style={{ width: "12px", height: "12px", ...(isRerunning ? { animation: "bwc-spin 0.8s linear infinite" } : {}) }} />
          {isRerunning ? "Running..." : "Re-run QA"}
        </button>
        <button
          onClick={() => setIsScorecardOpen(false)}
          style={{
            padding: "6px 14px",
            fontSize: "12px",
            fontWeight: 500,
            background: "#ffffff",
            color: "#414141",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ================================================================
// Sub-components
// ================================================================

function ResultSection({
  title,
  titleColor,
  results,
  selectedIds,
  onHighlight,
  onFixInChat,
  onFixInCanvas,
  onToggleSelect,
  onAutoFix,
}: {
  title: string;
  titleColor: string;
  results: QAResult[];
  selectedIds: Set<string>;
  onHighlight: (path: string | null, severity: "fail" | "warn") => void;
  onFixInChat: (suggestion: string) => void;
  onFixInCanvas: (path: string | null) => void;
  onToggleSelect: (checkId: string) => void;
  onAutoFix: (checkId: string) => void;
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{
        fontSize: "11px",
        fontWeight: 700,
        color: titleColor,
        textTransform: "uppercase" as const,
        letterSpacing: "0.5px",
        marginBottom: "8px",
      }}>
        {title}
      </div>
      {results.map((result, i) => (
        <ScorecardItem
          key={`${result.check.id}-${i}`}
          result={result}
          onHighlight={onHighlight}
          onFixInChat={onFixInChat}
          onFixInCanvas={onFixInCanvas}
          fixTier={getFixTier(result.check.id)}
          isSelected={selectedIds.has(result.check.id)}
          onToggleSelect={onToggleSelect}
          onAutoFix={onAutoFix}
        />
      ))}
    </div>
  );
}

function CollapsibleSection({
  title,
  titleColor,
  results,
  onHighlight,
  onFixInChat,
  onFixInCanvas,
}: {
  title: string;
  titleColor: string;
  results: QAResult[];
  onHighlight: (path: string | null, severity: "fail" | "warn") => void;
  onFixInChat: (suggestion: string) => void;
  onFixInCanvas: (path: string | null) => void;
}) {
  return (
    <details style={{ marginBottom: "16px" }}>
      <summary style={{
        fontSize: "11px",
        fontWeight: 700,
        color: titleColor,
        textTransform: "uppercase" as const,
        letterSpacing: "0.5px",
        marginBottom: "8px",
        cursor: "pointer",
        listStyle: "none",
        display: "flex",
        alignItems: "center",
        gap: "4px",
      }}>
        <span style={{ fontSize: "10px" }}>&#9654;</span> {title}
      </summary>
      {results.map((result, i) => (
        <ScorecardItem
          key={`${result.check.id}-${i}`}
          result={result}
          onHighlight={onHighlight}
          onFixInChat={onFixInChat}
          onFixInCanvas={onFixInCanvas}
          fixTier={getFixTier(result.check.id)}
        />
      ))}
    </details>
  );
}
