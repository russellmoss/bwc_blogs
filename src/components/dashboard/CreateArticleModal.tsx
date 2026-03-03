"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { useDashboardStore, getUniqueHubNames } from "@/lib/store/dashboard-store";
import type { ArticleType } from "@/types/content-map";

interface CreateArticleModalProps {
  onClose: () => void;
}

export function CreateArticleModal({ onClose }: CreateArticleModalProps) {
  const articles = useDashboardStore((s) => s.articles);
  const fetchArticles = useDashboardStore((s) => s.fetchArticles);
  const hubNames = useMemo(() => getUniqueHubNames(articles), [articles]);

  const [articleType, setArticleType] = useState<ArticleType>("hub");
  const [title, setTitle] = useState("");
  const [hubName, setHubName] = useState("");
  const [mainEntity, setMainEntity] = useState("");
  const [targetKeywords, setTargetKeywords] = useState("");
  const [searchVolumeEst, setSearchVolumeEst] = useState("");
  const [keywordDifficulty, setKeywordDifficulty] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [contentNotes, setContentNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // For spoke articles, resolve parentHubId from hubName
      let parentHubId: number | undefined;
      if (articleType === "spoke") {
        const parentHub = articles.find(
          (a) => a.articleType === "hub" && a.hubName === hubName
        );
        if (parentHub) {
          parentHubId = parentHub.id;
        }
      }

      const payload: Record<string, unknown> = {
        articleType,
        title: title.trim(),
        hubName: hubName.trim(),
        mainEntity: mainEntity.trim(),
        targetKeywords: targetKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        ...(searchVolumeEst && { searchVolumeEst: parseInt(searchVolumeEst, 10) }),
        ...(keywordDifficulty && { keywordDifficulty }),
        ...(targetAudience && { targetAudience: targetAudience.trim() }),
        ...(contentNotes && { contentNotes: contentNotes.trim() }),
        ...(parentHubId && { parentHubId }),
      };

      const res = await fetch("/api/content-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Failed to create article");
        return;
      }

      await fetchArticles();
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsSubmitting(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#414141",
    marginBottom: "4px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: "13px",
    border: "1px solid #cccccc",
    borderRadius: "6px",
    outline: "none",
    color: "#242323",
    boxSizing: "border-box",
  };

  const radioGroupStyle: React.CSSProperties = {
    display: "flex",
    gap: "16px",
    marginTop: "4px",
  };

  const radioLabelStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: active ? "#bc9b5d" : "#414141",
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
  });

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
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
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "520px",
          maxWidth: "90vw",
          maxHeight: "85vh",
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
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
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#242323",
              margin: 0,
            }}
          >
            Create Article
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#888",
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* Article Type */}
          <div>
            <label style={labelStyle}>Article Type *</label>
            <div style={radioGroupStyle}>
              {(["hub", "spoke", "news"] as ArticleType[]).map((type) => (
                <label key={type} style={radioLabelStyle(articleType === type)}>
                  <input
                    type="radio"
                    name="articleType"
                    value={type}
                    checked={articleType === type}
                    onChange={() => setArticleType(type)}
                    style={{ accentColor: "#bc9b5d" }}
                  />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., The Complete Guide to Bhutanese Red Rice Wine"
              required
              style={inputStyle}
            />
          </div>

          {/* Hub Name */}
          <div>
            <label style={labelStyle}>Hub Name *</label>
            <input
              type="text"
              value={hubName}
              onChange={(e) => setHubName(e.target.value)}
              placeholder="e.g., Bhutanese Wine"
              list="hub-names-list"
              required
              style={inputStyle}
            />
            <datalist id="hub-names-list">
              {hubNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {articleType === "spoke" && (
              <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                For spoke articles, this links to the parent hub
              </div>
            )}
          </div>

          {/* Main Entity */}
          <div>
            <label style={labelStyle}>Main Entity *</label>
            <input
              type="text"
              value={mainEntity}
              onChange={(e) => setMainEntity(e.target.value)}
              placeholder="e.g., Red Rice Wine"
              required
              style={inputStyle}
            />
          </div>

          {/* Target Keywords */}
          <div>
            <label style={labelStyle}>Target Keywords</label>
            <input
              type="text"
              value={targetKeywords}
              onChange={(e) => setTargetKeywords(e.target.value)}
              placeholder="Comma-separated, e.g., bhutanese wine, red rice wine"
              style={inputStyle}
            />
          </div>

          {/* Two-column row: Volume + Difficulty */}
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Search Volume Est.</label>
              <input
                type="number"
                value={searchVolumeEst}
                onChange={(e) => setSearchVolumeEst(e.target.value)}
                placeholder="e.g., 1200"
                min="0"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Keyword Difficulty</label>
              <select
                value={keywordDifficulty}
                onChange={(e) => setKeywordDifficulty(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">— select —</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Target Audience */}
          <div>
            <label style={labelStyle}>Target Audience</label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g., Wine enthusiasts, Bhutan travelers"
              style={inputStyle}
            />
          </div>

          {/* Content Notes */}
          <div>
            <label style={labelStyle}>Content Notes</label>
            <textarea
              value={contentNotes}
              onChange={(e) => setContentNotes(e.target.value)}
              placeholder="Any special instructions, angles, or notes for this article..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "8px 12px",
                fontSize: "13px",
                color: "#b91c1c",
                background: "#fef2f2",
                borderRadius: "6px",
                border: "1px solid #fecaca",
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              paddingTop: "4px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "8px 20px",
                fontSize: "13px",
                fontWeight: 600,
                background: isSubmitting ? "#d4b87a" : "#bc9b5d",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Creating..." : "Create Article"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
