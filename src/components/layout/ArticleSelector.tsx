"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";
import type { ContentMapEntry } from "@/types/content-map";

export function ArticleSelector() {
  const [articles, setArticles] = useState<ContentMapEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { selectedArticle, setSelectedArticle } = useArticleStore();

  useEffect(() => {
    async function fetchArticles() {
      try {
        const response = await fetch("/api/content-map");
        const data = await response.json();
        if (data.success) {
          setArticles(data.data);
        }
      } catch {
        // Silently fail — dropdown will be empty
      } finally {
        setIsLoading(false);
      }
    }
    fetchArticles();
  }, []);

  const articleTypeLabel = (type: string) => {
    switch (type) {
      case "hub": return "Hub";
      case "spoke": return "Spoke";
      case "news": return "News";
      default: return type;
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 12px",
          fontSize: "14px",
          background: "#ffffff",
          border: "1px solid #cccccc",
          borderRadius: "6px",
          cursor: isLoading ? "not-allowed" : "pointer",
          minWidth: "260px",
        }}
      >
        <span style={{ flex: 1, textAlign: "left", color: "#242323", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isLoading
            ? "Loading articles..."
            : selectedArticle
              ? selectedArticle.title
              : "Select an article..."}
        </span>
        <ChevronDown style={{ width: "16px", height: "16px", color: "#414141", flexShrink: 0 }} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            onClick={() => setIsOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
          />
          {/* Dropdown */}
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "4px",
            width: "400px",
            maxHeight: "400px",
            overflowY: "auto",
            background: "#ffffff",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,.1)",
            zIndex: 50,
          }}>
            {articles.map((article) => (
              <button
                key={article.id}
                onClick={() => {
                  setSelectedArticle(article);
                  setIsOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  borderBottom: "1px solid #e8e6e6",
                  background: selectedArticle?.id === article.id ? "#fcf8ed" : "transparent",
                  cursor: "pointer",
                  border: "none",
                  borderBlockEnd: "1px solid #e8e6e6",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#fcf8ed"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = selectedArticle?.id === article.id ? "#fcf8ed" : "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "#e8e6e6",
                    color: "#414141",
                  }}>
                    {articleTypeLabel(article.articleType)}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "#242323", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {article.title}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#414141", marginTop: "2px" }}>
                  {article.hubName} &middot; {article.status}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
