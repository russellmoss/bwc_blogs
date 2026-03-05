"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useArticleStore } from "@/lib/store/article-store";

export interface LinkToolbarState {
  visible: boolean;
  top: number;
  left: number;
  /** The cad-path of the parent editable element */
  cadPath: string;
  /** If selection is inside an existing <a>, its href */
  existingHref: string | null;
  /** The Range object for the current selection */
  range: Range | null;
  /** The <a> element if the selection is inside one */
  anchorEl: HTMLAnchorElement | null;
}

const INITIAL_STATE: LinkToolbarState = {
  visible: false,
  top: 0,
  left: 0,
  cadPath: "",
  existingHref: null,
  range: null,
  anchorEl: null,
};

interface LinkToolbarProps {
  state: LinkToolbarState;
  iframeRef: HTMLIFrameElement | null;
  onDismiss: () => void;
}

export function LinkToolbar({ state, iframeRef, onDismiss }: LinkToolbarProps) {
  const { applyCanvasEdit, pushUndo } = useArticleStore();
  const [urlInput, setUrlInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync URL input with existing href when state changes
  useEffect(() => {
    if (state.existingHref) {
      setUrlInput(state.existingHref);
      setIsEditing(false);
    } else {
      setUrlInput("");
      setIsEditing(true);
    }
  }, [state.existingHref, state.visible]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const syncBack = useCallback(() => {
    if (!iframeRef?.contentDocument || !state.cadPath) return;
    const doc = iframeRef.contentDocument;
    const el = doc.querySelector(`[data-cad-path="${state.cadPath}"]`);
    if (el) {
      pushUndo("Link edit");
      applyCanvasEdit(state.cadPath, el.innerHTML);
    }
  }, [iframeRef, state.cadPath, applyCanvasEdit, pushUndo]);

  const handleAddLink = useCallback(() => {
    if (!urlInput.trim() || !state.range || !iframeRef?.contentDocument) return;

    const doc = iframeRef.contentDocument;
    const sel = doc.getSelection();
    if (!sel) return;

    // Restore the saved range
    sel.removeAllRanges();
    sel.addRange(state.range);

    const anchor = doc.createElement("a");
    anchor.href = urlInput.trim();
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";

    try {
      state.range.surroundContents(anchor);
    } catch {
      // If surroundContents fails (selection crosses element boundaries),
      // extract and wrap
      const fragment = state.range.extractContents();
      anchor.appendChild(fragment);
      state.range.insertNode(anchor);
    }

    syncBack();
    onDismiss();
  }, [urlInput, state.range, iframeRef, syncBack, onDismiss]);

  const handleUnlink = useCallback(() => {
    if (!state.anchorEl || !iframeRef?.contentDocument) return;

    const parent = state.anchorEl.parentNode;
    if (!parent) return;

    // Replace <a> with its children
    while (state.anchorEl.firstChild) {
      parent.insertBefore(state.anchorEl.firstChild, state.anchorEl);
    }
    parent.removeChild(state.anchorEl);

    syncBack();
    onDismiss();
  }, [state.anchorEl, iframeRef, syncBack, onDismiss]);

  const handleUpdateLink = useCallback(() => {
    if (!state.anchorEl || !urlInput.trim()) return;
    state.anchorEl.href = urlInput.trim();
    syncBack();
    onDismiss();
  }, [state.anchorEl, urlInput, syncBack, onDismiss]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (state.existingHref) {
          handleUpdateLink();
        } else {
          handleAddLink();
        }
      }
      if (e.key === "Escape") {
        onDismiss();
      }
    },
    [state.existingHref, handleUpdateLink, handleAddLink, onDismiss]
  );

  if (!state.visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: state.top,
        left: state.left,
        zIndex: 50,
        background: "#1e293b",
        color: "#f8fafc",
        borderRadius: "8px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        padding: "8px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
        minWidth: "280px",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {state.existingHref && !isEditing ? (
        <>
          <a
            href={state.existingHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#60a5fa",
              maxWidth: "180px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textDecoration: "underline",
            }}
            title={state.existingHref}
          >
            {state.existingHref}
          </a>
          <button
            onClick={() => setIsEditing(true)}
            style={btnStyle}
            title="Edit URL"
          >
            Edit
          </button>
          <button
            onClick={handleUnlink}
            style={{ ...btnStyle, background: "#dc2626" }}
            title="Remove link"
          >
            Unlink
          </button>
        </>
      ) : (
        <>
          <input
            ref={inputRef}
            type="url"
            placeholder="https://..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: "#334155",
              border: "1px solid #475569",
              borderRadius: "4px",
              color: "#f8fafc",
              padding: "4px 8px",
              fontSize: "13px",
              outline: "none",
              minWidth: 0,
            }}
          />
          <button
            onClick={state.existingHref ? handleUpdateLink : handleAddLink}
            disabled={!urlInput.trim()}
            style={{
              ...btnStyle,
              opacity: urlInput.trim() ? 1 : 0.5,
            }}
          >
            {state.existingHref ? "Update" : "Link"}
          </button>
          {state.existingHref && (
            <button
              onClick={handleUnlink}
              style={{ ...btnStyle, background: "#dc2626" }}
            >
              Unlink
            </button>
          )}
          <button
            onClick={onDismiss}
            style={{ ...btnStyle, background: "#475569" }}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 500,
  whiteSpace: "nowrap",
};

export { INITIAL_STATE as LINK_TOOLBAR_INITIAL_STATE };
