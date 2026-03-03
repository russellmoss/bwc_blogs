"use client";

import { useMemo, useState } from "react";
import { X, Pencil, ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardStore, getDetailArticle } from "@/lib/store/dashboard-store";
import { useArticleStore } from "@/lib/store/article-store";
import { StatusBadge, TypeBadge } from "./StatusBadge";

export function ArticleDetailPanel() {
  const router = useRouter();
  const articles = useDashboardStore((s) => s.articles);
  const detailArticleId = useDashboardStore((s) => s.detailArticleId);
  const article = useMemo(() => getDetailArticle(articles, detailArticleId), [articles, detailArticleId]);
  const setDetailArticleId = useDashboardStore((s) => s.setDetailArticleId);
  const setSelectedArticle = useArticleStore((s) => s.setSelectedArticle);
  const fetchArticles = useDashboardStore((s) => s.fetchArticles);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!article) return null;

  async function handleDelete() {
    if (!article) return;
    const confirmed = window.confirm(
      `Delete "${article.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/content-map/${article.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDetailArticleId(null);
        await fetchArticles();
      } else {
        window.alert(data.error?.message || "Failed to delete article");
      }
    } catch {
      window.alert("Network error — please try again");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleEditInChat() {
    if (!article) return;
    setSelectedArticle(article);
    setDetailArticleId(null);
    router.push("/dashboard");
  }

  const metaRow = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", gap: "8px", padding: "6px 0" }}>
      <span
        style={{
          fontSize: "12px",
          color: "#888",
          minWidth: "100px",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "13px", color: "#242323", wordBreak: "break-word" }}>
        {value || "\u2014"}
      </span>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setDetailArticleId(null)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.2)",
          zIndex: 50,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "420px",
          maxWidth: "90vw",
          background: "#ffffff",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e8e6e6",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <TypeBadge type={article.articleType} />
              <StatusBadge status={article.status} />
            </div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#242323",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {article.title}
            </h2>
          </div>
          <button
            onClick={() => setDetailArticleId(null)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#888",
              flexShrink: 0,
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            <button
              onClick={handleEditInChat}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                background: "#bc9b5d",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              <Pencil style={{ width: "14px", height: "14px" }} />
              Edit in Chat
            </button>

            {article.publishedUrl && (
              <a
                href={article.publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 500,
                  background: "transparent",
                  color: "#bc9b5d",
                  border: "1px solid #bc9b5d",
                  borderRadius: "6px",
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                <ExternalLink style={{ width: "14px", height: "14px" }} />
                View on Site
              </a>
            )}

            {/* Spacer pushes delete to the right */}
            <div style={{ flex: 1 }} />

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 500,
                background: "transparent",
                color: "#b91c1c",
                border: "1px solid #e8e6e6",
                borderRadius: "6px",
                cursor: isDeleting ? "not-allowed" : "pointer",
                opacity: isDeleting ? 0.5 : 1,
              }}
            >
              <Trash2 style={{ width: "14px", height: "14px" }} />
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>

          {/* Metadata */}
          <div
            style={{
              borderTop: "1px solid #f3f3f3",
              paddingTop: "12px",
            }}
          >
            {metaRow("Hub", article.hubName)}
            {metaRow("Main Entity", article.mainEntity)}
            {metaRow("Audience", article.targetAudience)}
            {metaRow("Keywords",
              article.targetKeywords.length > 0
                ? article.targetKeywords.join(", ")
                : null
            )}
            {metaRow("Volume", article.searchVolumeEst?.toLocaleString())}
            {metaRow("Difficulty", article.keywordDifficulty)}
            {metaRow("Slug", article.slug)}
            {metaRow("Author", article.authorName)}
            {metaRow("Word Count", article.wordCount?.toLocaleString())}
            {metaRow("QA Score", article.qaScore)}
          </div>

          {/* Dates */}
          <div
            style={{
              borderTop: "1px solid #f3f3f3",
              marginTop: "12px",
              paddingTop: "12px",
            }}
          >
            {metaRow(
              "Scheduled",
              article.scheduledDate
                ? new Date(article.scheduledDate).toLocaleDateString()
                : null
            )}
            {metaRow(
              "Published",
              article.publishedDate
                ? new Date(article.publishedDate).toLocaleDateString()
                : null
            )}
            {metaRow(
              "Last Updated",
              new Date(article.updatedAt).toLocaleDateString()
            )}
            {metaRow(
              "Created",
              new Date(article.createdAt).toLocaleDateString()
            )}
          </div>

          {/* Content Notes */}
          {article.contentNotes && (
            <div
              style={{
                borderTop: "1px solid #f3f3f3",
                marginTop: "12px",
                paddingTop: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#888",
                  marginBottom: "4px",
                }}
              >
                Content Notes
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "#414141",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {article.contentNotes}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
