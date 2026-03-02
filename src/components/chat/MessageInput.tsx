"use client";

import { useState, useCallback, useRef } from "react";
import { Send } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";

interface MessageInputProps {
  onSend: (message: string) => void;
}

export function MessageInput({ onSend }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isGenerating, selectedArticleId, activeVersionNumber } = useArticleStore();

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || isGenerating || !selectedArticleId) return;
    onSend(trimmed);
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [message, isGenerating, selectedArticleId, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
  };

  const isViewingHistory = activeVersionNumber !== null;
  const isDisabled = isGenerating || !selectedArticleId || isViewingHistory;

  return (
    <div style={{ borderTop: "1px solid #e8e6e6", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            !selectedArticleId
              ? "Select an article first..."
              : isViewingHistory
                ? "Viewing history — return to current to edit"
                : isGenerating
                  ? "Generating..."
                  : "Type your message... (Enter to send, Shift+Enter for newline)"
          }
          disabled={isDisabled}
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            borderRadius: "6px",
            border: "1px solid #cccccc",
            padding: "8px 12px",
            fontSize: "14px",
            color: "#242323",
            outline: "none",
            background: isDisabled ? "#f7f7f7" : "#ffffff",
            cursor: isDisabled ? "not-allowed" : "text",
          }}
        />
        <button
          onClick={handleSend}
          disabled={isDisabled || !message.trim()}
          style={{
            padding: "8px",
            borderRadius: "6px",
            background: isDisabled || !message.trim() ? "#d4c49e" : "#bc9b5d",
            color: "#ffffff",
            border: "none",
            cursor: isDisabled || !message.trim() ? "not-allowed" : "pointer",
            opacity: isDisabled || !message.trim() ? 0.5 : 1,
            flexShrink: 0,
          }}
          title="Send message"
        >
          <Send style={{ width: "16px", height: "16px" }} />
        </button>
      </div>
    </div>
  );
}
