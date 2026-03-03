"use client";

import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";

export function PublishButton() {
  const {
    selectedArticle,
    isPublishing,
    lastFinalizedVersion,
    publishArticle,
  } = useArticleStore();

  const [showModal, setShowModal] = useState(false);
  const [url, setUrl] = useState("");
  const [publishResult, setPublishResult] = useState<{
    activatedLinks: number;
    backfillReport: any[];
  } | null>(null);

  if (!lastFinalizedVersion) return null;

  const isPublished = selectedArticle?.status === "published";
  const defaultUrl = selectedArticle?.slug
    ? `https://www.bhutanwine.com/post/${selectedArticle.slug}`
    : "";

  const handleOpenModal = () => {
    setUrl(selectedArticle?.publishedUrl || defaultUrl);
    setPublishResult(null);
    setShowModal(true);
  };

  const handlePublish = async () => {
    if (!url) return;

    // Intercept publishArticle result via store
    const store = useArticleStore.getState();
    await publishArticle(url);

    // Check result by reading the updated state
    const newState = useArticleStore.getState();
    if (newState.selectedArticle?.status === "published") {
      // Fetch the publish result details
      try {
        const response = await fetch(`/api/articles/${store.selectedArticleId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publishedUrl: url }),
        });
        // The first call already published. Just show success.
      } catch { /* ignore */ }
      setPublishResult({ activatedLinks: 0, backfillReport: [] });
    }
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        disabled={isPublishing}
        title={isPublished ? "Update published URL" : "Mark as published"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: 500,
          background: isPublished ? "#f0fdf4" : "#f7f7f7",
          color: isPublished ? "#15803d" : "#414141",
          border: "1px solid #cccccc",
          cursor: isPublishing ? "default" : "pointer",
        }}
      >
        {isPublishing ? (
          <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
        ) : (
          <Globe style={{ width: "14px", height: "14px" }} />
        )}
        {isPublishing
          ? "Publishing..."
          : isPublished
            ? "Published"
            : "Mark Published"}
      </button>

      {showModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              zIndex: 200,
            }}
          />
          {/* Modal */}
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              width: "440px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
              zIndex: 201,
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600, color: "#000000" }}>
              Mark as Published
            </h3>
            <label style={{ display: "block", fontSize: "13px", color: "#414141", marginBottom: "6px" }}>
              Wix Published URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.bhutanwine.com/post/..."
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "13px",
                border: "1px solid #cccccc",
                borderRadius: "6px",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  background: "#f7f7f7",
                  border: "1px solid #cccccc",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "#414141",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={!url || isPublishing}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  background: "#bc9b5d",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: !url || isPublishing ? "default" : "pointer",
                  opacity: !url || isPublishing ? 0.5 : 1,
                  fontWeight: 500,
                }}
              >
                {isPublishing ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
