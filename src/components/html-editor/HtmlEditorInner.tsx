"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Copy, Check } from "lucide-react";
import { EditorView, lineNumbers, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { html } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { useArticleStore, selectEffectiveHtml } from "@/lib/store/article-store";

export function HtmlEditorInner() {
  const currentHtml = useArticleStore(selectEffectiveHtml);
  const { applyHtmlOverride, pushUndo } = useArticleStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPushedUndoRef = useRef(false);

  const handleCopy = useCallback(async () => {
    const content = viewRef.current?.state.doc.toString() || currentHtml;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentHtml]);

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        // Push undo once per editing session (not per keystroke)
        if (!hasPushedUndoRef.current) {
          pushUndo("HTML edit");
          hasPushedUndoRef.current = true;
        }

        // Debounce the override application
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const newHtml = update.state.doc.toString();
          applyHtmlOverride({
            path: "__full_html",
            html: newHtml,
            reason: "HTML mode edit",
          });
        }, 500);
      }
    });

    const state = EditorState.create({
      doc: currentHtml,
      extensions: [
        lineNumbers(),
        html(),
        oneDark,
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      view.destroy();
      hasPushedUndoRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only create editor once

  // Update editor content when currentHtml changes externally (e.g., after generation)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentContent = view.state.doc.toString();
    if (currentContent !== currentHtml) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: currentHtml,
        },
      });
      hasPushedUndoRef.current = false;
    }
  }, [currentHtml]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 12px",
        background: "#242323",
        borderBottom: "1px solid #414141",
      }}>
        <span style={{ fontSize: "11px", color: "#94a3b8" }}>HTML Source Editor</span>
        <button
          onClick={handleCopy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#e8e6e6",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          title="Copy HTML"
        >
          {copied ? (
            <><Check style={{ width: "14px", height: "14px" }} /> Copied</>
          ) : (
            <><Copy style={{ width: "14px", height: "14px" }} /> Copy HTML</>
          )}
        </button>
      </div>
      <div ref={editorRef} style={{ flex: 1, overflow: "auto" }} />
    </div>
  );
}
