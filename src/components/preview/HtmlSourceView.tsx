"use client";

import { useCallback, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useArticleStore, selectEffectiveHtml } from "@/lib/store/article-store";

export function HtmlSourceView() {
  const currentHtml = useArticleStore(selectEffectiveHtml);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!currentHtml) return;
    await navigator.clipboard.writeText(currentHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentHtml]);

  if (!currentHtml) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f7f7" }}>
        <p className="text-[#414141] text-sm">
          HTML source will appear here after generation
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-end px-3 py-1.5 bg-[#242323] border-b border-[#414141]">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[#e8e6e6] hover:text-white transition-colors"
          title="Copy HTML"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy HTML
            </>
          )}
        </button>
      </div>
      <pre style={{ flex: 1, overflow: "auto", background: "#1a1a1a", padding: "16px", fontSize: "12px", lineHeight: "20px", color: "#e8e6e6", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {currentHtml}
      </pre>
    </div>
  );
}
