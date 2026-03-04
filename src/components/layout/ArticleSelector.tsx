"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";
import type { ContentMapEntry } from "@/types/content-map";

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "planned", label: "Planned" },
  { value: "drafting", label: "Drafting" },
  { value: "finalized", label: "Finalized" },
  { value: "published", label: "Published" },
  { value: "needs_update", label: "Needs Update" },
];

export function ArticleSelector() {
  const [articles, setArticles] = useState<ContentMapEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { selectedArticle, setSelectedArticle } = useArticleStore();
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the DOM has rendered
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Status counts from the full article list (not search-filtered)
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: articles.length };
    for (const a of articles) {
      counts[a.status] = (counts[a.status] || 0) + 1;
    }
    return counts;
  }, [articles]);

  // Filtered articles (status + search)
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return articles.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (query) {
        return (
          a.title.toLowerCase().includes(query) ||
          a.hubName.toLowerCase().includes(query) ||
          a.mainEntity.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [articles, searchQuery, statusFilter]);

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
            maxHeight: "440px",
            display: "flex",
            flexDirection: "column",
            background: "#ffffff",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,.1)",
            zIndex: 50,
          }}>
            {/* Sticky header: search + tabs */}
            <div style={{ flexShrink: 0, borderBottom: "1px solid #e8e6e6" }}>
              {/* Search input */}
              <div style={{ padding: "8px 10px 4px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Search style={{ width: "14px", height: "14px", color: "#414141", flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filtered.length > 0) {
                      setSelectedArticle(filtered[0]);
                      setIsOpen(false);
                    }
                  }}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    fontSize: "13px",
                    color: "#242323",
                    background: "transparent",
                    padding: "4px 0",
                  }}
                />
              </div>

              {/* Status filter tabs */}
              <div style={{
                display: "flex",
                gap: "4px",
                padding: "4px 10px 8px",
                flexWrap: "wrap",
              }}>
                {STATUS_TABS.map((tab) => {
                  const count = statusCounts[tab.value] || 0;
                  const isActive = statusFilter === tab.value;
                  // Hide tabs with 0 count (except "All")
                  if (tab.value !== "all" && count === 0) return null;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setStatusFilter(tab.value)}
                      style={{
                        fontSize: "11px",
                        fontWeight: isActive ? 600 : 400,
                        padding: "2px 8px",
                        borderRadius: "10px",
                        border: "1px solid",
                        borderColor: isActive ? "#bc9b5d" : "#e8e6e6",
                        background: isActive ? "#bc9b5d" : "transparent",
                        color: isActive ? "#ffffff" : "#414141",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tab.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable article list */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "24px 12px", textAlign: "center", color: "#414141", fontSize: "13px" }}>
                  No articles match your search.
                </div>
              ) : (
                filtered.map((article) => (
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
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
