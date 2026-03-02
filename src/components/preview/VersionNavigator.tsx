"use client";

import { useState } from "react";
import { History, ChevronLeft, ChevronRight, X, RotateCcw } from "lucide-react";
import {
  useArticleStore,
  selectIsViewingHistory,
} from "@/lib/store/article-store";

export function VersionNavigator() {
  const {
    versionHistory,
    activeVersionNumber,
    viewVersion,
    viewLiveVersion,
    rollbackToVersion,
  } = useArticleStore();
  const isViewingHistory = useArticleStore(selectIsViewingHistory);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (versionHistory.length === 0) return null;

  const activeVersion = activeVersionNumber !== null
    ? versionHistory.find((v) => v.versionNumber === activeVersionNumber)
    : null;

  // Expanded mode: browsing a historical version
  if (isViewingHistory && activeVersion) {
    const currentIdx = versionHistory.findIndex(
      (v) => v.versionNumber === activeVersionNumber
    );
    const hasPrev = currentIdx > 0;
    const hasNext = currentIdx < versionHistory.length - 1;

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 4px",
          borderRadius: "6px",
          border: "1px solid #bc9b5d",
          background: "#fcf8ed",
          fontSize: "12px",
        }}
      >
        <button
          onClick={() => hasPrev && viewVersion(versionHistory[currentIdx - 1].versionNumber)}
          disabled={!hasPrev}
          title="Previous version"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "2px",
            background: "none",
            border: "none",
            cursor: hasPrev ? "pointer" : "default",
            opacity: hasPrev ? 1 : 0.3,
            color: "#414141",
          }}
        >
          <ChevronLeft style={{ width: "14px", height: "14px" }} />
        </button>

        <span
          style={{
            padding: "0 4px",
            color: "#242323",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {activeVersion.label}
        </span>

        <button
          onClick={() => hasNext && viewVersion(versionHistory[currentIdx + 1].versionNumber)}
          disabled={!hasNext}
          title="Next version"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "2px",
            background: "none",
            border: "none",
            cursor: hasNext ? "pointer" : "default",
            opacity: hasNext ? 1 : 0.3,
            color: "#414141",
          }}
        >
          <ChevronRight style={{ width: "14px", height: "14px" }} />
        </button>

        <button
          onClick={() => rollbackToVersion(activeVersionNumber!)}
          title="Restore this version"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            padding: "2px 8px",
            marginLeft: "4px",
            borderRadius: "4px",
            background: "#bc9b5d",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          <RotateCcw style={{ width: "12px", height: "12px" }} />
          Restore
        </button>

        <button
          onClick={viewLiveVersion}
          title="Return to current version"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "2px",
            marginLeft: "2px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#414141",
          }}
        >
          <X style={{ width: "14px", height: "14px" }} />
        </button>
      </div>
    );
  }

  // Compact mode: dropdown button
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          padding: "4px 10px",
          borderRadius: "6px",
          border: "1px solid #cccccc",
          background: "#ffffff",
          color: "#414141",
          fontSize: "12px",
          cursor: "pointer",
        }}
      >
        <History style={{ width: "14px", height: "14px" }} />
        History ({versionHistory.length})
      </button>

      {dropdownOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDropdownOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "4px",
              width: "260px",
              maxHeight: "280px",
              overflowY: "auto",
              background: "#ffffff",
              border: "1px solid #e8e6e6",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 100,
              padding: "4px",
              fontSize: "12px",
            }}
          >
            {[...versionHistory].reverse().map((version) => (
              <button
                key={version.versionNumber}
                onClick={() => {
                  viewVersion(version.versionNumber);
                  setDropdownOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#242323",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f7f7f7";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ fontWeight: 500 }}>{version.label}</div>
                <div style={{ color: "#414141", fontSize: "11px", marginTop: "2px" }}>
                  {new Date(version.timestamp).toLocaleTimeString()}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
