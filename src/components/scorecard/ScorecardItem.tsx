"use client";

import { CheckCircle, XCircle, AlertTriangle, MessageSquare, Pencil, Zap } from "lucide-react";
import type { QAResult } from "@/types/qa";
import type { FixTier } from "@/types/qa-fix";

interface ScorecardItemProps {
  result: QAResult;
  onHighlight: (elementPath: string | null, severity: "fail" | "warn") => void;
  onFixInChat: (suggestion: string) => void;
  onFixInCanvas: (elementPath: string | null) => void;
  fixTier: FixTier;
  isSelected?: boolean;
  onToggleSelect?: (checkId: string) => void;
  onAutoFix?: (checkId: string) => void;
}

export function ScorecardItem({
  result,
  onHighlight,
  onFixInChat,
  onFixInCanvas,
  fixTier,
  isSelected,
  onToggleSelect,
  onAutoFix,
}: ScorecardItemProps) {
  const { check, passed, message, elementPath, fixSuggestion } = result;

  const bgColor = passed
    ? "#f0fdf4"
    : check.severity === "fail"
      ? "#fef2f2"
      : "#fefce8";

  const iconColor = passed
    ? "#15803d"
    : check.severity === "fail"
      ? "#b91c1c"
      : "#a16207";

  const iconSize = { width: "14px", height: "14px" };

  return (
    <div
      style={{
        padding: "8px 12px",
        background: bgColor,
        borderRadius: "6px",
        marginBottom: "4px",
        cursor: elementPath ? "pointer" : "default",
      }}
      onClick={() => {
        if (elementPath && !passed) {
          onHighlight(elementPath, check.severity as "fail" | "warn");
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        {/* Checkbox for non-passed items */}
        {!passed && onToggleSelect && (
          <div style={{ flexShrink: 0, marginTop: "1px" }}>
            <input
              type="checkbox"
              checked={isSelected ?? false}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(check.id);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ cursor: "pointer", accentColor: "#bc9b5d" }}
            />
          </div>
        )}
        <div style={{ flexShrink: 0, marginTop: "1px" }}>
          {passed ? (
            <CheckCircle style={{ ...iconSize, color: iconColor }} />
          ) : check.severity === "fail" ? (
            <XCircle style={{ ...iconSize, color: iconColor }} />
          ) : (
            <AlertTriangle style={{ ...iconSize, color: iconColor }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{
              fontSize: "10px",
              fontWeight: 600,
              color: iconColor,
              background: passed ? "#dcfce7" : check.severity === "fail" ? "#fecaca" : "#fef08a",
              padding: "1px 5px",
              borderRadius: "3px",
            }}>
              {check.id}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#242323" }}>
              {check.name}
            </span>
            {/* Tier badge for non-passed items */}
            {!passed && (
              <span style={{
                fontSize: "9px",
                fontWeight: 600,
                color: fixTier === 1 ? "#15803d" : "#1d4ed8",
                background: fixTier === 1 ? "#dcfce7" : "#dbeafe",
                padding: "1px 5px",
                borderRadius: "3px",
                textTransform: "uppercase" as const,
                letterSpacing: "0.3px",
              }}>
                {fixTier === 1 ? "Auto" : "AI"}
              </span>
            )}
          </div>
          <div style={{ fontSize: "11px", color: "#414141", marginTop: "2px", lineHeight: "1.4" }}>
            {message}
          </div>
          {!passed && (
            <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
              {fixTier === 1 && onAutoFix ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAutoFix(check.id);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    fontSize: "10px",
                    fontWeight: 500,
                    background: "#dcfce7",
                    border: "1px solid #86efac",
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: "#15803d",
                  }}
                >
                  <Zap style={{ width: "10px", height: "10px" }} />
                  Auto Fix
                </button>
              ) : fixSuggestion ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFixInChat(fixSuggestion);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    fontSize: "10px",
                    fontWeight: 500,
                    background: "#ffffff",
                    border: "1px solid #cccccc",
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: "#414141",
                  }}
                >
                  <MessageSquare style={{ width: "10px", height: "10px" }} />
                  Fix in Chat
                </button>
              ) : null}
              {elementPath && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFixInCanvas(elementPath);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    fontSize: "10px",
                    fontWeight: 500,
                    background: "#ffffff",
                    border: "1px solid #cccccc",
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: "#414141",
                  }}
                >
                  <Pencil style={{ width: "10px", height: "10px" }} />
                  Fix in Canvas
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
