"use client";

import { useState, useEffect } from "react";
import { Monitor, Smartphone, Eye, Code, CheckCircle, AlertTriangle, XCircle, Pencil, Undo2, Redo2, Shield, ChevronDown, BookOpen } from "lucide-react";
import { useArticleStore, selectEffectiveValidation, selectCanUndo, selectCanRedo, selectQaScore } from "@/lib/store/article-store";
import { VersionNavigator } from "./VersionNavigator";
import { FinalizeButton } from "@/components/finalization/FinalizeButton";
import { PublishButton } from "@/components/finalization/PublishButton";
import { ImportButton } from "@/components/import/ImportButton";
import { StyleSelector } from "@/components/styles/StyleSelector";

function ToolbarSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon: React.ReactNode; disabled?: boolean }[];
  onChange: (value: T) => void;
}) {
  const selected = options.find((o) => o.value === value) || options[0];
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          fontSize: "12px",
          background: "#ffffff",
          color: "#414141",
          border: "1px solid #cccccc",
          borderRadius: "6px",
          cursor: "pointer",
          minWidth: "100px",
        }}
      >
        {selected.icon}
        {selected.label}
        <ChevronDown style={{ width: "12px", height: "12px", marginLeft: "auto" }} />
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
          />
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "4px",
            background: "#ffffff",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 100,
            overflow: "hidden",
            minWidth: "100%",
          }}>
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  if (!opt.disabled) {
                    onChange(opt.value);
                    setOpen(false);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px",
                  fontSize: "12px",
                  width: "100%",
                  background: opt.value === value ? "#f7f5f0" : "transparent",
                  color: opt.disabled ? "#ccc" : "#414141",
                  fontWeight: opt.value === value ? 600 : 400,
                  border: "none",
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  opacity: opt.disabled ? 0.5 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PreviewToolbar() {
  const {
    viewportMode,
    setViewportMode,
    editingMode,
    setEditingMode,
    undo,
    redo,
  } = useArticleStore();
  const validationResult = useArticleStore(selectEffectiveValidation);
  const canUndo = useArticleStore(selectCanUndo);
  const canRedo = useArticleStore(selectCanRedo);
  const qaScore = useArticleStore(selectQaScore);
  const { runQa, setIsScorecardOpen } = useArticleStore();
  const currentDocument = useArticleStore((s) => s.currentDocument);
  const lastFinalizedVersion = useArticleStore((s) => s.lastFinalizedVersion);
  const isImportedHtml = useArticleStore((s) => s.isImportedHtml);
  const onyxSources = useArticleStore((s) => s.onyxSources);
  const [showDetails, setShowDetails] = useState(false);

  // Global keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const iconSize = { width: "14px", height: "14px" };

  return (
    <div style={{
      height: "40px",
      borderBottom: "1px solid #e8e6e6",
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      gap: "12px",
      background: "#f7f7f7",
      flexShrink: 0,
      position: "relative",
    }}>
      {/* View mode dropdown */}
      <ToolbarSelect
        value={editingMode}
        options={[
          { value: "preview" as const, label: "Preview", icon: <Eye style={iconSize} /> },
          { value: "canvas" as const, label: "Canvas", icon: <Pencil style={iconSize} />, disabled: isImportedHtml },
          { value: "html" as const, label: "HTML", icon: <Code style={iconSize} /> },
          { value: "citation" as const, label: "Citations", icon: <BookOpen style={iconSize} />, disabled: onyxSources.length === 0 },
        ]}
        onChange={setEditingMode}
      />

      {/* Viewport dropdown */}
      <ToolbarSelect
        value={viewportMode}
        options={[
          { value: "desktop" as const, label: "Desktop", icon: <Monitor style={iconSize} /> },
          { value: "mobile" as const, label: "Mobile", icon: <Smartphone style={iconSize} /> },
        ]}
        onChange={setViewportMode}
      />

      {/* Writing style selector */}
      <StyleSelector />

      {/* Undo / Redo */}
      <div style={{ display: "flex", gap: "2px" }}>
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "4px 6px",
            background: "transparent",
            border: "none",
            cursor: canUndo ? "pointer" : "default",
            opacity: canUndo ? 1 : 0.3,
            color: "#414141",
          }}
        >
          <Undo2 style={iconSize} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "4px 6px",
            background: "transparent",
            border: "none",
            cursor: canRedo ? "pointer" : "default",
            opacity: canRedo ? 1 : 0.3,
            color: "#414141",
          }}
        >
          <Redo2 style={iconSize} />
        </button>
      </div>

      {/* Version history navigator */}
      <VersionNavigator />

      {/* Import button */}
      <ImportButton />

      {/* Imported HTML badge */}
      {isImportedHtml && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 8px",
            fontSize: "11px",
            fontWeight: 600,
            background: "#fefce8",
            color: "#a16207",
            borderRadius: "999px",
            border: "1px solid #fde047",
          }}
        >
          Imported HTML
        </span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* QA Scorecard button */}
      {currentDocument && (
        <button
          onClick={() => {
            if (qaScore) {
              setIsScorecardOpen(true);
            }
            runQa();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 500,
            background: qaScore
              ? qaScore.canFinalize
                ? "#f0fdf4"
                : "#fef2f2"
              : "#f7f7f7",
            color: qaScore
              ? qaScore.canFinalize
                ? "#15803d"
                : "#b91c1c"
              : "#414141",
            border: "1px solid #cccccc",
            cursor: "pointer",
          }}
        >
          <Shield style={iconSize} />
          {qaScore
            ? `QA ${qaScore.total}/${qaScore.possible}`
            : "Run QA"}
        </button>
      )}

      {/* Finalize & Publish buttons */}
      {currentDocument && <FinalizeButton />}
      {lastFinalizedVersion && <PublishButton />}

      {/* Validation badge — clickable */}
      {validationResult && (
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 500,
              background: validationResult.valid ? "#f0fdf4" : validationResult.errors.length > 0 ? "#fef2f2" : "#fefce8",
              color: validationResult.valid ? "#15803d" : validationResult.errors.length > 0 ? "#b91c1c" : "#a16207",
              border: "none",
              cursor: "pointer",
            }}
          >
            {validationResult.valid ? (
              <CheckCircle style={iconSize} />
            ) : validationResult.errors.length > 0 ? (
              <XCircle style={iconSize} />
            ) : (
              <AlertTriangle style={iconSize} />
            )}
            {validationResult.valid
              ? "Valid"
              : `${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings`}
          </button>

          {/* Dropdown detail panel */}
          {showDetails && !validationResult.valid && (
            <>
              {/* Backdrop */}
              <div
                onClick={() => setShowDetails(false)}
                style={{ position: "fixed", inset: 0, zIndex: 99 }}
              />
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "6px",
                width: "380px",
                maxHeight: "320px",
                overflowY: "auto",
                background: "#ffffff",
                border: "1px solid #e8e6e6",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                zIndex: 100,
                padding: "12px",
                fontSize: "12px",
                lineHeight: "1.5",
              }}>
                {validationResult.errors.length > 0 && (
                  <div style={{ marginBottom: validationResult.warnings.length > 0 ? "10px" : 0 }}>
                    <div style={{ fontWeight: 600, color: "#b91c1c", marginBottom: "6px" }}>
                      Errors ({validationResult.errors.length})
                    </div>
                    {validationResult.errors.map((err, i) => (
                      <div key={i} style={{
                        padding: "4px 0",
                        borderBottom: i < validationResult.errors.length - 1 ? "1px solid #f3f3f3" : "none",
                        color: "#414141",
                      }}>
                        <span style={{ color: "#b91c1c", fontWeight: 500 }}>{err.path}</span>
                        {": "}
                        {err.message}
                      </div>
                    ))}
                  </div>
                )}
                {validationResult.warnings.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, color: "#a16207", marginBottom: "6px" }}>
                      Warnings ({validationResult.warnings.length})
                    </div>
                    {validationResult.warnings.map((warn, i) => (
                      <div key={i} style={{
                        padding: "4px 0",
                        borderBottom: i < validationResult.warnings.length - 1 ? "1px solid #f3f3f3" : "none",
                        color: "#414141",
                      }}>
                        {warn}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
