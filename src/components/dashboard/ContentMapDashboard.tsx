"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Table, RefreshCw, Plus, Upload, PenTool } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardStore, getFilteredArticles } from "@/lib/store/dashboard-store";
import { FilterBar } from "./FilterBar";
import { TableView } from "./TableView";
import { HubView } from "./HubView";
import { ArticleDetailPanel } from "./ArticleDetailPanel";
import { CreateArticleModal } from "./CreateArticleModal";
import { CSVImportModal } from "./CSVImportModal";

export function ContentMapDashboard() {
  const router = useRouter();
  const fetchArticles = useDashboardStore((s) => s.fetchArticles);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const articles = useDashboardStore((s) => s.articles);
  const filters = useDashboardStore((s) => s.filters);
  const filtered = useMemo(() => getFilteredArticles(articles, filters), [articles, filters]);
  const view = useDashboardStore((s) => s.view);
  const setView = useDashboardStore((s) => s.setView);
  const detailArticleId = useDashboardStore((s) => s.detailArticleId);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Stats
  const totalArticles = articles.length;
  const hubCount = articles.filter((a) => a.articleType === "hub").length;
  const spokeCount = articles.filter((a) => a.articleType === "spoke").length;
  const newsCount = articles.filter((a) => a.articleType === "news").length;
  const publishedCount = articles.filter((a) => a.status === "published").length;
  const draftingCount = articles.filter((a) => a.status === "drafting").length;

  function handleSyncOnyx() {
    window.alert(
      'You are being re-directed to Onyx. To sync your knowledge base click "manage" in the upper right and "re-index". The process will take about 5-10 minutes depending upon size and quantity of files.'
    );
    window.location.href = "https://rmoss-onyx.xyz/admin/connector/2?page=1";
  }

  const viewButtonStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 12px",
    fontSize: "13px",
    fontWeight: active ? 600 : 400,
    background: active ? "#fcf8ed" : "transparent",
    color: active ? "#bc9b5d" : "#414141",
    border: `1px solid ${active ? "#bc9b5d" : "#cccccc"}`,
    borderRadius: "6px",
    cursor: "pointer",
  });

  if (isLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#888",
          fontSize: "14px",
        }}
      >
        Loading content map...
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 600,
              color: "#242323",
              margin: 0,
            }}
          >
            Content Map
          </h1>
          <div
            style={{
              fontSize: "13px",
              color: "#888",
              marginTop: "4px",
              display: "flex",
              gap: "12px",
            }}
          >
            <span>{totalArticles} articles</span>
            <span>{hubCount} hubs</span>
            <span>{spokeCount} spokes</span>
            {newsCount > 0 && <span>{newsCount} news</span>}
            <span style={{ color: "#065f46" }}>{publishedCount} published</span>
            {draftingCount > 0 && (
              <span style={{ color: "#0e6f82" }}>{draftingCount} drafting</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Back to Composer */}
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              background: "transparent",
              color: "#414141",
              border: "1px solid #cccccc",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <PenTool style={{ width: "14px", height: "14px" }} />
            Composer
          </button>

          {/* Create Article button */}
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 600,
              background: "#bc9b5d",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <Plus style={{ width: "14px", height: "14px" }} />
            Create
          </button>

          {/* Import CSV button */}
          <button
            onClick={() => setShowImportModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              background: "transparent",
              color: "#414141",
              border: "1px solid #cccccc",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <Upload style={{ width: "14px", height: "14px" }} />
            Import CSV
          </button>

          {/* Sync Knowledge Base button */}
          <button
            onClick={handleSyncOnyx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              background: "transparent",
              color: "#bc9b5d",
              border: "1px solid #bc9b5d",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <RefreshCw style={{ width: "14px", height: "14px" }} />
            Sync Knowledge Base
          </button>

          {/* View toggle */}
          <button
            onClick={() => setView("table")}
            style={viewButtonStyle(view === "table")}
          >
            <Table style={{ width: "14px", height: "14px" }} />
            Table
          </button>
          <button
            onClick={() => setView("hub")}
            style={viewButtonStyle(view === "hub")}
          >
            <LayoutGrid style={{ width: "14px", height: "14px" }} />
            Hub
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: "16px" }}>
        <FilterBar />
      </div>

      {/* Filtered count */}
      {filtered.length !== totalArticles && (
        <div
          style={{
            fontSize: "12px",
            color: "#888",
            marginBottom: "12px",
          }}
        >
          Showing {filtered.length} of {totalArticles} articles
        </div>
      )}

      {/* View */}
      {view === "table" ? <TableView /> : <HubView />}

      {/* Detail panel overlay */}
      {detailArticleId && <ArticleDetailPanel />}

      {/* Modals */}
      {showCreateModal && (
        <CreateArticleModal onClose={() => setShowCreateModal(false)} />
      )}
      {showImportModal && (
        <CSVImportModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
}
