"use client";

import { useState, useEffect, useRef } from "react";
import { Pen } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";
import { StyleManagerModal } from "./StyleManagerModal";

interface WritingStyleOption {
  id: number;
  name: string;
  description: string | null;
  isDefault: boolean;
}

export function StyleSelector() {
  const selectedStyleId = useArticleStore((s) => s.selectedStyleId);
  const setSelectedStyleId = useArticleStore((s) => s.setSelectedStyleId);

  const [styles, setStyles] = useState<WritingStyleOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchStyles = () => {
    fetch("/api/styles")
      .then((r) => r.json())
      .then((result) => {
        if (result.success) {
          setStyles(result.data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchStyles();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const selectedStyle = styles.find((s) => s.id === selectedStyleId);
  const displayName = selectedStyle
    ? selectedStyle.name.length > 20
      ? selectedStyle.name.slice(0, 18) + "..."
      : selectedStyle.name
    : "No Style";

  return (
    <>
      <div ref={dropdownRef} style={{ position: "relative" }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
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
            whiteSpace: "nowrap",
          }}
        >
          <Pen style={{ width: "12px", height: "12px" }} />
          <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayName}
          </span>
          <span style={{ fontSize: "10px", opacity: 0.6 }}>&#9662;</span>
        </button>

        {isOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "4px",
              width: "260px",
              background: "#ffffff",
              border: "1px solid #e8e6e6",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 200,
              overflow: "hidden",
            }}
          >
            {/* No Style option */}
            <button
              onClick={() => {
                setSelectedStyleId(null);
                setIsOpen(false);
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "12px",
                textAlign: "left",
                background: selectedStyleId === null ? "#f7f7f7" : "transparent",
                border: "none",
                borderBottom: "1px solid #f3f3f3",
                cursor: "pointer",
                color: "#414141",
                fontWeight: selectedStyleId === null ? 600 : 400,
              }}
            >
              No Style (SOP Default)
            </button>

            {/* Style options */}
            {styles.map((style) => (
              <button
                key={style.id}
                onClick={() => {
                  setSelectedStyleId(style.id);
                  setIsOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "12px",
                  textAlign: "left",
                  background: selectedStyleId === style.id ? "#f7f7f7" : "transparent",
                  border: "none",
                  borderBottom: "1px solid #f3f3f3",
                  cursor: "pointer",
                  color: "#414141",
                  fontWeight: selectedStyleId === style.id ? 600 : 400,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {style.isDefault && (
                    <span style={{ color: "#bc9b5d", fontSize: "14px" }} title="Default style">
                      &#9733;
                    </span>
                  )}
                  <span>{style.name}</span>
                </div>
                {style.description && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#999",
                      marginTop: "2px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {style.description}
                  </div>
                )}
              </button>
            ))}

            {/* Manage Styles link */}
            <button
              onClick={() => {
                setIsOpen(false);
                setShowManager(true);
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "12px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderTop: "1px solid #e8e6e6",
                cursor: "pointer",
                color: "#bc9b5d",
                fontWeight: 500,
              }}
            >
              Manage Styles...
            </button>
          </div>
        )}
      </div>

      {showManager && (
        <StyleManagerModal
          onClose={() => {
            setShowManager(false);
            fetchStyles();
          }}
        />
      )}
    </>
  );
}
