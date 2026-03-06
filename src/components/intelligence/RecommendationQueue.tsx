"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIntelligenceStore } from "@/lib/store/intelligence-store";
import type { ContentRecommendation } from "@/types/intelligence";

const typeBadgeColors: Record<string, { bg: string; color: string }> = {
  update: { bg: "#dbeafe", color: "#1e40af" },
  new_spoke: { bg: "#dcfce7", color: "#166534" },
  gap: { bg: "#fef3c7", color: "#92400e" },
  meta_rewrite: { bg: "#ede9fe", color: "#5b21b6" },
  title_update: { bg: "#fce7f3", color: "#9d174d" },
};

const priorityBadgeColors: Record<string, { bg: string; color: string }> = {
  high: { bg: "#fee2e2", color: "#991b1b" },
  medium: { bg: "#ffedd5", color: "#9a3412" },
  low: { bg: "#f3f4f6", color: "#374151" },
};

function formatType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RecommendationQueue() {
  const router = useRouter();
  const {
    recommendations,
    isLoadingRecommendations,
    isAnalyzing,
    fetchRecommendations,
    runAnalysis,
    approveRecommendation,
    dismissRecommendation,
  } = useIntelligenceStore();

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  async function handleApprove(rec: ContentRecommendation) {
    await approveRecommendation(rec);
    if (rec.contentMapId) {
      router.push("/dashboard");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={() => runAnalysis()}
          disabled={isAnalyzing}
          style={{
            padding: "6px 16px",
            fontSize: "13px",
            fontWeight: 500,
            border: "none",
            borderRadius: "4px",
            background: isAnalyzing ? "#d1d5db" : "#bc9b5d",
            color: "#ffffff",
            cursor: isAnalyzing ? "wait" : "pointer",
          }}
        >
          {isAnalyzing ? "Analyzing..." : "Run Analysis"}
        </button>
        {isAnalyzing && (
          <span style={{ fontSize: "12px", color: "#414141" }}>
            Claude is analyzing performance data...
          </span>
        )}
      </div>

      {/* Recommendations */}
      {isLoadingRecommendations ? (
        <div style={{ padding: "32px", textAlign: "center", color: "#414141" }}>Loading recommendations...</div>
      ) : recommendations.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", color: "#414141" }}>
          No pending recommendations. Run analysis to generate insights.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {recommendations.map((rec) => {
            const typeBadge = typeBadgeColors[rec.recommendationType] ?? typeBadgeColors.update;
            const priBadge = priorityBadgeColors[rec.priority] ?? priorityBadgeColors.medium;

            return (
              <div
                key={rec.id}
                style={{
                  padding: "16px",
                  border: "1px solid #e8e6e6",
                  borderRadius: "8px",
                  background: "#ffffff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: 500,
                      borderRadius: "4px",
                      background: typeBadge.bg,
                      color: typeBadge.color,
                    }}
                  >
                    {formatType(rec.recommendationType)}
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: 500,
                      borderRadius: "4px",
                      background: priBadge.bg,
                      color: priBadge.color,
                    }}
                  >
                    {rec.priority}
                  </span>
                  {rec.contentMap && (
                    <span style={{ fontSize: "12px", color: "#414141" }}>
                      {rec.contentMap.title}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px", color: "#000000" }}>
                  {rec.title}
                </div>
                <div style={{ fontSize: "13px", color: "#414141", marginBottom: "12px" }}>
                  {rec.rationale}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleApprove(rec)}
                    style={{
                      padding: "4px 12px",
                      fontSize: "13px",
                      fontWeight: 500,
                      border: "none",
                      borderRadius: "4px",
                      background: "#16a34a",
                      color: "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => dismissRecommendation(rec.id)}
                    style={{
                      padding: "4px 12px",
                      fontSize: "13px",
                      fontWeight: 500,
                      border: "1px solid #e8e6e6",
                      borderRadius: "4px",
                      background: "#ffffff",
                      color: "#414141",
                      cursor: "pointer",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
