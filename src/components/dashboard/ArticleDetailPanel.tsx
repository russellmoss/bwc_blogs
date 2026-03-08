"use client";

import { useMemo, useState, useCallback } from "react";
import { X, Pencil, ExternalLink, Trash2, Save, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardStore, getDetailArticle, getUniqueHubNames } from "@/lib/store/dashboard-store";
import { useArticleStore } from "@/lib/store/article-store";
import { StatusBadge, TypeBadge } from "./StatusBadge";
import type { ArticleType, ArticleStatus } from "@/types/content-map";

const ARTICLE_TYPES: ArticleType[] = ["hub", "spoke", "news"];
const STATUSES: ArticleStatus[] = ["planned", "drafting", "finalized", "published", "needs_update"];
const DIFFICULTIES = ["", "low", "medium", "high"];

export function ArticleDetailPanel() {
  const router = useRouter();
  const articles = useDashboardStore((s) => s.articles);
  const detailArticleId = useDashboardStore((s) => s.detailArticleId);
  const article = useMemo(() => getDetailArticle(articles, detailArticleId), [articles, detailArticleId]);
  const setDetailArticleId = useDashboardStore((s) => s.setDetailArticleId);
  const setSelectedArticle = useArticleStore((s) => s.setSelectedArticle);
  const fetchArticles = useDashboardStore((s) => s.fetchArticles);
  const hubNames = useMemo(() => getUniqueHubNames(articles), [articles]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editArticleType, setEditArticleType] = useState<ArticleType>("hub");
  const [editStatus, setEditStatus] = useState<ArticleStatus>("planned");
  const [editHubName, setEditHubName] = useState("");
  const [editMainEntity, setEditMainEntity] = useState("");
  const [editTargetAudience, setEditTargetAudience] = useState("");
  const [editTargetKeywords, setEditTargetKeywords] = useState("");
  const [editSearchVolume, setEditSearchVolume] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editContentNotes, setEditContentNotes] = useState("");
  const [editScheduledDate, setEditScheduledDate] = useState("");

  const enterEditMode = useCallback(() => {
    if (!article) return;
    setEditTitle(article.title);
    setEditArticleType(article.articleType);
    setEditStatus(article.status);
    setEditHubName(article.hubName);
    setEditMainEntity(article.mainEntity);
    setEditTargetAudience(article.targetAudience || "");
    setEditTargetKeywords(article.targetKeywords.join(", "));
    setEditSearchVolume(article.searchVolumeEst?.toString() || "");
    setEditDifficulty(article.keywordDifficulty || "");
    setEditSlug(article.slug || "");
    setEditAuthor(article.authorName || "");
    setEditContentNotes(article.contentNotes || "");
    setEditScheduledDate(
      article.scheduledDate
        ? new Date(article.scheduledDate).toISOString().split("T")[0]
        : ""
    );
    setSaveError(null);
    setIsEditing(true);
  }, [article]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setSaveError(null);
  }, []);

  async function handleSave() {
    if (!article) return;
    setIsSaving(true);
    setSaveError(null);

    const payload: Record<string, unknown> = {
      title: editTitle.trim(),
      articleType: editArticleType,
      status: editStatus,
      hubName: editHubName.trim(),
      mainEntity: editMainEntity.trim(),
      targetAudience: editTargetAudience.trim() || null,
      targetKeywords: editTargetKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      searchVolumeEst: editSearchVolume ? parseInt(editSearchVolume, 10) : null,
      keywordDifficulty: editDifficulty || null,
      slug: editSlug.trim() || null,
      authorName: editAuthor.trim() || null,
      contentNotes: editContentNotes.trim() || null,
      scheduledDate: editScheduledDate
        ? new Date(editScheduledDate).toISOString()
        : null,
    };

    // Resolve parentHubId for spoke articles
    if (editArticleType === "spoke") {
      const parentHub = articles.find(
        (a) => a.articleType === "hub" && a.hubName === editHubName.trim()
      );
      if (parentHub) {
        payload.parentHubId = parentHub.id;
      }
    }

    try {
      const res = await fetch(`/api/content-map/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditing(false);
        await fetchArticles();
      } else {
        setSaveError(data.error?.message || "Failed to save changes");
      }
    } catch {
      setSaveError("Network error — please try again");
    } finally {
      setIsSaving(false);
    }
  }

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

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#888",
    minWidth: "100px",
    flexShrink: 0,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "5px 8px",
    fontSize: "13px",
    border: "1px solid #cccccc",
    borderRadius: "4px",
    outline: "none",
    color: "#242323",
    boxSizing: "border-box",
  };

  const metaRow = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", gap: "8px", padding: "6px 0" }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ fontSize: "13px", color: "#242323", wordBreak: "break-word" }}>
        {value || "\u2014"}
      </span>
    </div>
  );

  const editRow = (label: string, input: React.ReactNode) => (
    <div style={{ display: "flex", gap: "8px", padding: "4px 0", alignItems: "center" }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ flex: 1 }}>{input}</div>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => {
          if (!isEditing) setDetailArticleId(null);
        }}
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
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{
                  ...inputStyle,
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              />
            ) : (
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
            )}
          </div>
          <button
            onClick={() => {
              if (isEditing) {
                cancelEdit();
              } else {
                setDetailArticleId(null);
              }
            }}
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
              flexWrap: "wrap",
            }}
          >
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    background: isSaving ? "#d4b87a" : "#bc9b5d",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: isSaving ? "not-allowed" : "pointer",
                  }}
                >
                  <Save style={{ width: "14px", height: "14px" }} />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={isSaving}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 500,
                    background: "transparent",
                    color: "#414141",
                    border: "1px solid #cccccc",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  <XCircle style={{ width: "14px", height: "14px" }} />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={enterEditMode}
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
                  Edit Details
                </button>
                <button
                  onClick={handleEditInChat}
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
              </>
            )}
          </div>

          {/* Save error */}
          {saveError && (
            <div
              style={{
                padding: "8px 12px",
                fontSize: "13px",
                color: "#b91c1c",
                background: "#fef2f2",
                borderRadius: "6px",
                border: "1px solid #fecaca",
                marginBottom: "12px",
              }}
            >
              {saveError}
            </div>
          )}

          {/* Metadata */}
          <div
            style={{
              borderTop: "1px solid #f3f3f3",
              paddingTop: "12px",
            }}
          >
            {isEditing ? (
              <>
                {editRow(
                  "Type",
                  <select
                    value={editArticleType}
                    onChange={(e) => setEditArticleType(e.target.value as ArticleType)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    {ARTICLE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                )}
                {editRow(
                  "Status",
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as ArticleStatus)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
                      </option>
                    ))}
                  </select>
                )}
                {editRow(
                  "Hub",
                  <>
                    <input
                      type="text"
                      value={editHubName}
                      onChange={(e) => setEditHubName(e.target.value)}
                      list="edit-hub-names"
                      style={inputStyle}
                    />
                    <datalist id="edit-hub-names">
                      {hubNames.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </>
                )}
                {editRow(
                  "Main Entity",
                  <input
                    type="text"
                    value={editMainEntity}
                    onChange={(e) => setEditMainEntity(e.target.value)}
                    style={inputStyle}
                  />
                )}
                {editRow(
                  "Audience",
                  <input
                    type="text"
                    value={editTargetAudience}
                    onChange={(e) => setEditTargetAudience(e.target.value)}
                    placeholder="e.g., Wine enthusiasts"
                    style={inputStyle}
                  />
                )}
                {editRow(
                  "Keywords",
                  <input
                    type="text"
                    value={editTargetKeywords}
                    onChange={(e) => setEditTargetKeywords(e.target.value)}
                    placeholder="Comma-separated"
                    style={inputStyle}
                  />
                )}
                {editRow(
                  "Volume",
                  <input
                    type="number"
                    value={editSearchVolume}
                    onChange={(e) => setEditSearchVolume(e.target.value)}
                    placeholder="e.g., 1200"
                    min="0"
                    style={inputStyle}
                  />
                )}
                {editRow(
                  "Difficulty",
                  <select
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d ? d.charAt(0).toUpperCase() + d.slice(1) : "— none —"}
                      </option>
                    ))}
                  </select>
                )}
                {editRow(
                  "Slug",
                  <input
                    type="text"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    style={inputStyle}
                  />
                )}
                {editRow(
                  "Author",
                  <input
                    type="text"
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    style={inputStyle}
                  />
                )}
                {metaRow("Word Count", article.wordCount?.toLocaleString())}
                {metaRow("QA Score", article.qaScore)}
              </>
            ) : (
              <>
                {metaRow("Hub", article.hubName)}
                {metaRow("Main Entity", article.mainEntity)}
                {metaRow("Audience", article.targetAudience)}
                {metaRow(
                  "Keywords",
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
              </>
            )}
          </div>

          {/* Dates */}
          <div
            style={{
              borderTop: "1px solid #f3f3f3",
              marginTop: "12px",
              paddingTop: "12px",
            }}
          >
            {isEditing ? (
              <>
                {editRow(
                  "Scheduled",
                  <input
                    type="date"
                    value={editScheduledDate}
                    onChange={(e) => setEditScheduledDate(e.target.value)}
                    style={inputStyle}
                  />
                )}
                {metaRow(
                  "Published",
                  article.publishedDate
                    ? new Date(article.publishedDate).toLocaleDateString()
                    : null
                )}
              </>
            ) : (
              <>
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
              </>
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
            {isEditing ? (
              <textarea
                value={editContentNotes}
                onChange={(e) => setEditContentNotes(e.target.value)}
                placeholder="Any special instructions, angles, or notes for this article..."
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            ) : (
              <div
                style={{
                  fontSize: "13px",
                  color: "#414141",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {article.contentNotes || "\u2014"}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
