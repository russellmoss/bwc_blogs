"use client";

import { useCallback, useEffect } from "react";
import { useArticleStore } from "@/lib/store/article-store";
import { renderArticle, TEMPLATE_VERSION } from "@/lib/renderer";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import type { StreamEventType } from "@/types/claude";
import type { CanonicalArticleDocument } from "@/types/article";
import type { ValidationResult } from "@/types/api";
import type { GenerateArticleResponse } from "@/types/claude";

export function ChatPanel() {
  const {
    selectedArticleId,
    selectedArticle,
    currentDocument,
    conversationHistory,
    photoManifest,
    addUserMessage,
    startGeneration,
    appendStreamingText,
    setStatusMessage,
    setDocument,
    setCurrentHtml,
    setValidationResult,
    completeGeneration,
    failGeneration,
    loadFinalizedArticle,
  } = useArticleStore();

  // Auto-load finalized/published articles when selected from content map
  useEffect(() => {
    if (
      selectedArticleId &&
      (selectedArticle?.status === "finalized" || selectedArticle?.status === "published") &&
      !currentDocument
    ) {
      loadFinalizedArticle(selectedArticleId);
    }
  }, [selectedArticleId, selectedArticle?.status, currentDocument, loadFinalizedArticle]);

  const handleSSEEvent = useCallback(
    (type: StreamEventType, data: unknown) => {
      switch (type) {
        case "status": {
          const d = data as { message: string };
          setStatusMessage(d.message);
          break;
        }
        case "text_delta": {
          const d = data as { text: string };
          appendStreamingText(d.text);
          break;
        }
        case "web_search": {
          const d = data as { query: string };
          setStatusMessage(`Searching: ${d.query}`);
          break;
        }
        case "document": {
          // Intermediate document — render for live preview
          const doc = data as CanonicalArticleDocument;
          setDocument(doc);
          try {
            const result = renderArticle({
              document: doc,
              htmlOverrides: null,
              templateVersion: TEMPLATE_VERSION,
            });
            setCurrentHtml(result.html);
          } catch {
            // Render may fail on partial doc — ignore
          }
          break;
        }
        case "validation": {
          const d = data as ValidationResult;
          setValidationResult(d);
          break;
        }
        case "complete": {
          const d = data as GenerateArticleResponse;
          completeGeneration(d);
          break;
        }
        case "error": {
          const d = data as { code: string; message: string };
          failGeneration(d.message);
          break;
        }
      }
    },
    [
      setStatusMessage,
      appendStreamingText,
      setDocument,
      setCurrentHtml,
      setValidationResult,
      completeGeneration,
      failGeneration,
    ]
  );

  const handleSend = useCallback(
    async (message: string) => {
      if (!selectedArticleId) return;

      // Add user message to conversation and start generation
      addUserMessage(message);
      startGeneration();

      try {
        const response = await fetch("/api/articles/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleId: selectedArticleId,
            userMessage: message,
            conversationHistory: conversationHistory,
            currentDocument: currentDocument,
            photoManifest,
          }),
        });

        // Pre-stream errors come as JSON, not SSE
        if (!response.ok) {
          const errorData = await response.json();
          failGeneration(
            errorData?.error?.message ?? `HTTP ${response.status}`
          );
          return;
        }

        // Consume SSE stream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            let eventType = "";
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) eventType = line.slice(7);
              if (line.startsWith("data: ")) data = line.slice(6);
            }
            if (eventType && data) {
              handleSSEEvent(
                eventType as StreamEventType,
                JSON.parse(data)
              );
            }
          }
        }
      } catch (err) {
        failGeneration(
          err instanceof Error ? err.message : "Network error"
        );
      }
    },
    [
      selectedArticleId,
      currentDocument,
      conversationHistory,
      addUserMessage,
      startGeneration,
      failGeneration,
      handleSSEEvent,
    ]
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#ffffff" }}>
      <MessageList />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
