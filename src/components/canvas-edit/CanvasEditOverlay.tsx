"use client";

import { useEffect, useRef, useCallback } from "react";
import { useArticleStore } from "@/lib/store/article-store";

const DEBOUNCE_MS = 300;

export function CanvasEditOverlay() {
  const { applyCanvasEdit, pushUndo, setIsCanvasEditing } = useArticleStore();
  const editingMode = useArticleStore((s) => s.editingMode);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEditPathRef = useRef<string | null>(null);

  const handleInput = useCallback(
    (e: Event) => {
      const target = e.target as HTMLElement;
      const cadPath = target.getAttribute("data-cad-path");
      if (!cadPath) return;

      // Debounce the sync
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Push undo only on first edit of a new element (not every keystroke)
      if (lastEditPathRef.current !== cadPath) {
        pushUndo("Canvas edit");
        lastEditPathRef.current = cadPath;
      }

      debounceRef.current = setTimeout(() => {
        const newText = target.innerHTML;
        applyCanvasEdit(cadPath, newText);
      }, DEBOUNCE_MS);
    },
    [applyCanvasEdit, pushUndo]
  );

  const handleFocus = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute("data-cad-path")) {
      target.style.outline = "2px solid #3b82f6";
      target.style.outlineOffset = "2px";
    }
  }, []);

  const handleBlur = useCallback(
    (e: Event) => {
      const target = e.target as HTMLElement;
      target.style.outline = "";
      target.style.outlineOffset = "";

      // Flush any pending debounced edit
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        const cadPath = target.getAttribute("data-cad-path");
        if (cadPath) {
          applyCanvasEdit(cadPath, target.innerHTML);
        }
      }
      lastEditPathRef.current = null;
    },
    [applyCanvasEdit]
  );

  useEffect(() => {
    if (editingMode !== "canvas") return;

    setIsCanvasEditing(true);

    // Wait for iframe to be available
    const setupInterval = setInterval(() => {
      const iframe = (window as unknown as Record<string, unknown>).__bwcIframeRef as HTMLIFrameElement | null;
      if (!iframe?.contentDocument) return;
      clearInterval(setupInterval);

      const doc = iframe.contentDocument;

      // Inject contenteditable on all elements with data-cad-path
      const editableElements = doc.querySelectorAll("[data-cad-path]");
      editableElements.forEach((el) => {
        (el as HTMLElement).contentEditable = "true";
        (el as HTMLElement).style.cursor = "text";
      });

      // Add event listeners on the document (captures all editable elements)
      doc.addEventListener("input", handleInput, true);
      doc.addEventListener("focusin", handleFocus, true);
      doc.addEventListener("focusout", handleBlur, true);

      // Add locked overlay styles for non-editable elements
      const style = doc.createElement("style");
      style.textContent = `
        [data-cad-path]:focus {
          outline: 2px solid #3b82f6 !important;
          outline-offset: 2px !important;
        }
        [data-cad-path] {
          cursor: text;
          transition: outline 150ms;
        }
        figure:hover, img:hover {
          outline: 2px dashed #94a3b8;
          outline-offset: 2px;
          cursor: not-allowed;
        }
      `;
      doc.head.appendChild(style);
    }, 100);

    return () => {
      clearInterval(setupInterval);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Clean up: remove contenteditable, event listeners
      const iframe = (window as unknown as Record<string, unknown>).__bwcIframeRef as HTMLIFrameElement | null;
      if (iframe?.contentDocument) {
        const doc = iframe.contentDocument;
        doc.removeEventListener("input", handleInput, true);
        doc.removeEventListener("focusin", handleFocus, true);
        doc.removeEventListener("focusout", handleBlur, true);

        const editableElements = doc.querySelectorAll("[data-cad-path]");
        editableElements.forEach((el) => {
          (el as HTMLElement).contentEditable = "false";
          (el as HTMLElement).style.cursor = "";
        });
      }

      setIsCanvasEditing(false);
    };
  }, [editingMode, handleInput, handleFocus, handleBlur, setIsCanvasEditing]);

  // This component is invisible — it just manages the iframe's editing state
  if (editingMode !== "canvas") return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        padding: "8px 12px",
        background: "rgba(59, 130, 246, 0.9)",
        color: "#ffffff",
        fontSize: "11px",
        fontWeight: 500,
        borderRadius: "0 0 0 6px",
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      Canvas Edit Mode — click any text to edit
    </div>
  );
}
