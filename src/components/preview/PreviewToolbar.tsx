"use client";

import { useState } from "react";
import { Monitor, Smartphone, Eye, Code, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useArticleStore, selectEffectiveValidation } from "@/lib/store/article-store";
import { VersionNavigator } from "./VersionNavigator";

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        fontSize: "12px",
        background: active ? "#bc9b5d" : "#ffffff",
        color: active ? "#ffffff" : "#414141",
        border: "none",
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function PreviewToolbar() {
  const {
    previewMode,
    setPreviewMode,
    viewportMode,
    setViewportMode,
  } = useArticleStore();
  const validationResult = useArticleStore(selectEffectiveValidation);
  const [showDetails, setShowDetails] = useState(false);

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
      {/* Preview / HTML toggle */}
      <div style={{ display: "flex", borderRadius: "6px", border: "1px solid #cccccc", overflow: "hidden" }}>
        <ToggleButton
          active={previewMode === "preview"}
          onClick={() => setPreviewMode("preview")}
          icon={<Eye style={iconSize} />}
          label="Preview"
        />
        <ToggleButton
          active={previewMode === "html"}
          onClick={() => setPreviewMode("html")}
          icon={<Code style={iconSize} />}
          label="HTML"
        />
      </div>

      {/* Desktop / Mobile toggle */}
      <div style={{ display: "flex", borderRadius: "6px", border: "1px solid #cccccc", overflow: "hidden" }}>
        <ToggleButton
          active={viewportMode === "desktop"}
          onClick={() => setViewportMode("desktop")}
          icon={<Monitor style={iconSize} />}
          label="Desktop"
        />
        <ToggleButton
          active={viewportMode === "mobile"}
          onClick={() => setViewportMode("mobile")}
          icon={<Smartphone style={iconSize} />}
          label="Mobile"
        />
      </div>

      {/* Version history navigator */}
      <VersionNavigator />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

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
