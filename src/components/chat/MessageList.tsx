"use client";

import { useEffect, useRef } from "react";
import { useArticleStore } from "@/lib/store/article-store";
import { StreamingMessage } from "./StreamingMessage";

export function MessageList() {
  const { conversationHistory, isGenerating } = useArticleStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory.length, isGenerating]);

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {/* Welcome message when empty */}
      {conversationHistory.length === 0 && !isGenerating && (
        <div style={{ padding: "32px 16px", textAlign: "center" }}>
          <p style={{ color: "#414141", fontSize: "14px" }}>
            Select an article from the dropdown above, then type a message to start generating.
          </p>
        </div>
      )}

      {/* Conversation messages */}
      {conversationHistory.map((message, index) => (
        <div
          key={index}
          style={{
            padding: "12px 16px",
            background: message.role === "user" ? "#ffffff" : "#f7f7f7",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 500,
                flexShrink: 0,
                background: message.role === "user" ? "#bc9b5d" : "#316142",
                color: "#ffffff",
              }}
            >
              {message.role === "user" ? "U" : "E"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", color: "#414141", marginBottom: "4px" }}>
                {message.role === "user" ? "You" : "Engine"}
              </div>
              <div style={{ fontSize: "14px", color: "#242323", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {message.content}
              </div>
            </div>
          </div>
        </div>
      ))}

      <StreamingMessage />
      <div ref={bottomRef} />
    </div>
  );
}
