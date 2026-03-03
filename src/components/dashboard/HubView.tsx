"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Pencil, ChevronRight } from "lucide-react";
import {
  useDashboardStore,
  getFilteredArticles,
} from "@/lib/store/dashboard-store";
import { useArticleStore } from "@/lib/store/article-store";
import { StatusBadge, TypeBadge } from "./StatusBadge";
import type { ContentMapEntry } from "@/types/content-map";

interface HubGroup {
  hubName: string;
  hubArticle: ContentMapEntry | null;
  spokes: ContentMapEntry[];
  publishedCount: number;
  totalCount: number;
}

function groupByHub(articles: ContentMapEntry[]): HubGroup[] {
  const hubMap = new Map<string, HubGroup>();

  for (const article of articles) {
    if (!hubMap.has(article.hubName)) {
      hubMap.set(article.hubName, {
        hubName: article.hubName,
        hubArticle: null,
        spokes: [],
        publishedCount: 0,
        totalCount: 0,
      });
    }
    const group = hubMap.get(article.hubName)!;
    group.totalCount++;
    if (article.status === "published") group.publishedCount++;

    if (article.articleType === "hub") {
      group.hubArticle = article;
    } else {
      group.spokes.push(article);
    }
  }

  return Array.from(hubMap.values()).sort((a, b) =>
    a.hubName.localeCompare(b.hubName)
  );
}

function ProgressBar({
  published,
  total,
}: {
  published: number;
  total: number;
}) {
  const pct = total > 0 ? (published / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div
        style={{
          flex: 1,
          height: "8px",
          background: "#e8e6e6",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "#bc9b5d",
            borderRadius: "4px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: "12px", color: "#414141", whiteSpace: "nowrap" }}>
        {published}/{total}
      </span>
    </div>
  );
}

export function HubView() {
  const router = useRouter();
  const allArticles = useDashboardStore((s) => s.articles);
  const filters = useDashboardStore((s) => s.filters);
  const articles = useMemo(() => getFilteredArticles(allArticles, filters), [allArticles, filters]);
  const setDetailArticleId = useDashboardStore((s) => s.setDetailArticleId);
  const setSelectedArticle = useArticleStore((s) => s.setSelectedArticle);
  const groups = groupByHub(articles);

  function handleEditInChat(article: ContentMapEntry) {
    setSelectedArticle(article);
    router.push("/dashboard");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {groups.map((group) => (
        <div
          key={group.hubName}
          style={{
            border: "1px solid #e8e6e6",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {/* Hub header */}
          <div
            style={{
              padding: "16px 20px",
              background: "#fcf8ed",
              borderBottom: "1px solid #e8e6e6",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#242323",
                  }}
                >
                  {group.hubName}
                </span>
                {group.hubArticle && (
                  <StatusBadge status={group.hubArticle.status} />
                )}
              </div>
              <span
                style={{
                  fontSize: "13px",
                  color: "#414141",
                }}
              >
                {group.spokes.length} spoke{group.spokes.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Progress bar */}
            <ProgressBar
              published={group.publishedCount}
              total={group.totalCount}
            />

            {/* Hub article action */}
            {group.hubArticle && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "10px",
                  paddingTop: "10px",
                  borderTop: "1px solid #e8e6e6",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                  onClick={() => setDetailArticleId(group.hubArticle!.id)}
                >
                  <TypeBadge type="hub" />
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#242323",
                    }}
                  >
                    {group.hubArticle.title}
                  </span>
                </div>
                <button
                  onClick={() => handleEditInChat(group.hubArticle!)}
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
                  }}
                >
                  <Pencil style={{ width: "12px", height: "12px" }} />
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Spokes list */}
          {group.spokes.length > 0 && (
            <div>
              {group.spokes.map((spoke) => (
                <div
                  key={spoke.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 20px",
                    borderBottom: "1px solid #f3f3f3",
                    cursor: "pointer",
                  }}
                  onClick={() => setDetailArticleId(spoke.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fafafa";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flex: 1,
                      overflow: "hidden",
                    }}
                  >
                    <ChevronRight
                      style={{
                        width: "14px",
                        height: "14px",
                        color: "#cccccc",
                        flexShrink: 0,
                      }}
                    />
                    <TypeBadge type={spoke.articleType} />
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#242323",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {spoke.title}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexShrink: 0,
                    }}
                  >
                    <StatusBadge status={spoke.status} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditInChat(spoke);
                      }}
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
                      }}
                    >
                      <Pencil style={{ width: "12px", height: "12px" }} />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {groups.length === 0 && (
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
