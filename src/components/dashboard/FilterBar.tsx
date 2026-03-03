"use client";

import { useMemo } from "react";
import { Search, X } from "lucide-react";
import { useDashboardStore, getUniqueHubNames } from "@/lib/store/dashboard-store";
import type { ArticleType, ArticleStatus } from "@/types/content-map";

const ARTICLE_TYPES: ArticleType[] = ["hub", "spoke", "news"];
const ARTICLE_STATUSES: ArticleStatus[] = [
  "planned", "drafting", "finalized", "published", "needs_update",
];

export function FilterBar() {
  const filters = useDashboardStore((s) => s.filters);
  const setFilter = useDashboardStore((s) => s.setFilter);
  const clearFilters = useDashboardStore((s) => s.clearFilters);
  const articles = useDashboardStore((s) => s.articles);
  const hubNames = useMemo(() => getUniqueHubNames(articles), [articles]);

  const hasActiveFilters =
    filters.hubName || filters.articleType || filters.status || filters.searchQuery;

  const selectStyle: React.CSSProperties = {
    padding: "6px 10px",
    fontSize: "13px",
    border: "1px solid #cccccc",
    borderRadius: "6px",
    background: "#ffffff",
    color: "#242323",
    cursor: "pointer",
    minWidth: "120px",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      {/* Search */}
      <div style={{ position: "relative", flex: "1 1 200px", maxWidth: "300px" }}>
        <Search
          style={{
            position: "absolute",
            left: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "14px",
            height: "14px",
            color: "#888",
          }}
        />
        <input
          type="text"
          placeholder="Search articles..."
          value={filters.searchQuery}
          onChange={(e) => setFilter("searchQuery", e.target.value || null)}
          style={{
            ...selectStyle,
            width: "100%",
            paddingLeft: "32px",
          }}
        />
      </div>

      {/* Hub filter */}
      <select
        value={filters.hubName || ""}
        onChange={(e) => setFilter("hubName", e.target.value || null)}
        style={selectStyle}
      >
        <option value="">All Hubs</option>
        {hubNames.map((hub) => (
          <option key={hub} value={hub}>
            {hub}
          </option>
        ))}
      </select>

      {/* Type filter */}
      <select
        value={filters.articleType || ""}
        onChange={(e) =>
          setFilter("articleType", (e.target.value as ArticleType) || null)
        }
        style={selectStyle}
      >
        <option value="">All Types</option>
        {ARTICLE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={filters.status || ""}
        onChange={(e) =>
          setFilter("status", (e.target.value as ArticleStatus) || null)
        }
        style={selectStyle}
      >
        <option value="">All Statuses</option>
        {ARTICLE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px 10px",
            fontSize: "13px",
            background: "transparent",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            cursor: "pointer",
            color: "#b91c1c",
          }}
        >
          <X style={{ width: "12px", height: "12px" }} />
          Clear
        </button>
      )}
    </div>
  );
}
