"use client";

import { useMemo } from "react";
import { useState } from "react";
import { ArrowUp, ArrowDown, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useDashboardStore,
  getFilteredArticles,
  getSortedArticles,
} from "@/lib/store/dashboard-store";
import type { SortColumn } from "@/lib/store/dashboard-store";
import { useArticleStore } from "@/lib/store/article-store";
import { StatusBadge, TypeBadge } from "./StatusBadge";
import type { ContentMapEntry } from "@/types/content-map";

const COLUMNS: Array<{
  key: SortColumn | "targetKeywords" | "actions";
  label: string;
  sortable: boolean;
  width: string;
}> = [
  { key: "articleType", label: "Type", sortable: true, width: "70px" },
  { key: "title", label: "Title", sortable: true, width: "" },
  { key: "hubName", label: "Hub", sortable: true, width: "180px" },
  { key: "status", label: "Status", sortable: true, width: "110px" },
  { key: "targetKeywords", label: "Keywords", sortable: false, width: "150px" },
  { key: "searchVolumeEst", label: "Volume", sortable: true, width: "80px" },
  { key: "updatedAt", label: "Updated", sortable: true, width: "100px" },
  { key: "actions", label: "", sortable: false, width: "100px" },
];

export function TableView() {
  const router = useRouter();
  const fetchArticles = useDashboardStore((s) => s.fetchArticles);
  const allArticles = useDashboardStore((s) => s.articles);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const filters = useDashboardStore((s) => s.filters);
  const sortColumn = useDashboardStore((s) => s.sortColumn);
  const sortDirection = useDashboardStore((s) => s.sortDirection);
  const articles = useMemo(() => {
    const filtered = getFilteredArticles(allArticles, filters);
    return getSortedArticles(filtered, sortColumn, sortDirection);
  }, [allArticles, filters, sortColumn, sortDirection]);
  const setSort = useDashboardStore((s) => s.setSort);
  const setDetailArticleId = useDashboardStore((s) => s.setDetailArticleId);
  const setSelectedArticle = useArticleStore((s) => s.setSelectedArticle);

  function handleEditInChat(article: ContentMapEntry) {
    setSelectedArticle(article);
    router.push("/dashboard");
  }

  async function handleDelete(article: ContentMapEntry) {
    const confirmed = window.confirm(
      `Delete "${article.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(article.id);
    try {
      const res = await fetch(`/api/content-map/${article.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        await fetchArticles();
      } else {
        window.alert(data.error?.message || "Failed to delete article");
      }
    } catch {
      window.alert("Network error — please try again");
    } finally {
      setDeletingId(null);
    }
  }

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#414141",
    textAlign: "left",
    borderBottom: "2px solid #e8e6e6",
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "13px",
    color: "#242323",
    borderBottom: "1px solid #f3f3f3",
    verticalAlign: "middle",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => {
                  if (col.sortable && col.key !== "targetKeywords" && col.key !== "actions") {
                    setSort(col.key as SortColumn);
                  }
                }}
                style={{
                  ...thStyle,
                  width: col.width || "auto",
                  cursor: col.sortable ? "pointer" : "default",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  {col.label}
                  {col.sortable && sortColumn === col.key && (
                    sortDirection === "asc"
                      ? <ArrowUp style={{ width: "12px", height: "12px" }} />
                      : <ArrowDown style={{ width: "12px", height: "12px" }} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => (
            <tr
              key={article.id}
              onClick={() => setDetailArticleId(article.id)}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fcf8ed";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <td style={{ ...tdStyle, width: "70px" }}>
                <TypeBadge type={article.articleType} />
              </td>
              <td
                style={{
                  ...tdStyle,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {article.title}
              </td>
              <td
                style={{
                  ...tdStyle,
                  width: "180px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: "12px",
                  color: "#414141",
                }}
              >
                {article.hubName}
              </td>
              <td style={{ ...tdStyle, width: "110px" }}>
                <StatusBadge status={article.status} />
              </td>
              <td
                style={{
                  ...tdStyle,
                  width: "150px",
                  fontSize: "11px",
                  color: "#888",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {article.targetKeywords.slice(0, 2).join(", ")}
              </td>
              <td
                style={{
                  ...tdStyle,
                  width: "80px",
                  textAlign: "right",
                  fontSize: "12px",
                  color: "#414141",
                }}
              >
                {article.searchVolumeEst ?? "\u2014"}
              </td>
              <td
                style={{
                  ...tdStyle,
                  width: "100px",
                  fontSize: "12px",
                  color: "#888",
                }}
              >
                {new Date(article.updatedAt).toLocaleDateString()}
              </td>
              <td
                style={{ ...tdStyle, width: "100px" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    onClick={() => handleEditInChat(article)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 8px",
                      fontSize: "12px",
                      background: "transparent",
                      border: "1px solid #cccccc",
                      borderRadius: "4px",
                      cursor: "pointer",
                      color: "#bc9b5d",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#fcf8ed";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Pencil style={{ width: "12px", height: "12px" }} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(article)}
                    disabled={deletingId === article.id}
                    title="Delete article"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "4px 6px",
                      fontSize: "12px",
                      background: "transparent",
                      border: "1px solid #e8e6e6",
                      borderRadius: "4px",
                      cursor: deletingId === article.id ? "not-allowed" : "pointer",
                      color: "#b91c1c",
                      opacity: deletingId === article.id ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#fef2f2";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Trash2 style={{ width: "12px", height: "12px" }} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {articles.length === 0 && (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#888",
            fontSize: "14px",
          }}
        >
          No articles match your filters.
        </div>
      )}
    </div>
  );
}
