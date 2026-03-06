"use client";

import { useEffect, useMemo, useState } from "react";
import { useIntelligenceStore } from "@/lib/store/intelligence-store";

interface ContentMapEntry {
  id: number;
  title: string;
  slug: string | null;
  hubName: string;
  articleType: string;
  targetKeywords: string[];
  publishedUrl: string | null;
  status: string;
}

export function GapAnalysis() {
  const { performanceData, isLoadingPerformance } = useIntelligenceStore();
  const [publishedArticles, setPublishedArticles] = useState<ContentMapEntry[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);

  useEffect(() => {
    async function loadArticles() {
      try {
        const res = await fetch("/api/content-map");
        const data = await res.json();
        if (data.success) {
          setPublishedArticles(
            data.data.filter((a: ContentMapEntry) => a.status === "published")
          );
        }
      } catch (error) {
        console.error("[GapAnalysis] Failed to load articles:", error);
      } finally {
        setIsLoadingArticles(false);
      }
    }
    loadArticles();
  }, []);

  const indexedIds = useMemo(
    () => new Set(performanceData.map((r) => r.contentMapId)),
    [performanceData]
  );

  const unindexed = useMemo(
    () => publishedArticles.filter((a) => !indexedIds.has(a.id)),
    [publishedArticles, indexedIds]
  );

  const keywordGaps = useMemo(() => {
    const gaps: { article: ContentMapEntry; missingKeywords: string[] }[] = [];
    for (const article of publishedArticles) {
      if (!article.targetKeywords.length) continue;
      const perf = performanceData.find((r) => r.contentMapId === article.id);
      if (!perf || perf.clicks === 0) {
        gaps.push({ article, missingKeywords: article.targetKeywords });
      }
    }
    return gaps;
  }, [publishedArticles, performanceData]);

  const isLoading = isLoadingPerformance || isLoadingArticles;

  if (isLoading) {
    return <div style={{ padding: "32px", textAlign: "center", color: "#414141" }}>Loading gap analysis...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Unindexed Articles */}
      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "8px", color: "#000000" }}>
          Unindexed Articles ({unindexed.length})
        </h3>
        <p style={{ fontSize: "13px", color: "#414141", marginBottom: "12px" }}>
          These articles are published but have no Google Search Console data yet.
        </p>
        {unindexed.length === 0 ? (
          <div style={{ padding: "16px", background: "#f0fdf4", borderRadius: "8px", fontSize: "13px", color: "#166534" }}>
            All published articles have GSC data.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e8e6e6" }}>
                  <th style={{ textAlign: "left", padding: "8px", color: "#414141", fontWeight: 500 }}>Article</th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#414141", fontWeight: 500 }}>Hub</th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#414141", fontWeight: 500 }}>Type</th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#414141", fontWeight: 500 }}>Target Keywords</th>
                </tr>
              </thead>
              <tbody>
                {unindexed.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #e8e6e6" }}>
                    <td style={{ padding: "8px" }}>{a.title}</td>
                    <td style={{ padding: "8px", color: "#414141" }}>{a.hubName}</td>
                    <td style={{ padding: "8px", color: "#414141" }}>{a.articleType}</td>
                    <td style={{ padding: "8px", color: "#414141" }}>
                      {a.targetKeywords.slice(0, 3).join(", ")}
                      {a.targetKeywords.length > 3 && ` +${a.targetKeywords.length - 3}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Keyword Gaps */}
      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "8px", color: "#000000" }}>
          Keyword Gaps ({keywordGaps.length})
        </h3>
        <p style={{ fontSize: "13px", color: "#414141", marginBottom: "12px" }}>
          Published articles with target keywords that have zero clicks in the current period.
        </p>
        {keywordGaps.length === 0 ? (
          <div style={{ padding: "16px", background: "#f0fdf4", borderRadius: "8px", fontSize: "13px", color: "#166534" }}>
            No keyword gaps detected.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e8e6e6" }}>
                  <th style={{ textAlign: "left", padding: "8px", color: "#414141", fontWeight: 500 }}>Article</th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#414141", fontWeight: 500 }}>Hub</th>
                  <th style={{ textAlign: "left", padding: "8px", color: "#414141", fontWeight: 500 }}>Missing Keywords</th>
                </tr>
              </thead>
              <tbody>
                {keywordGaps.map(({ article, missingKeywords }) => (
                  <tr key={article.id} style={{ borderBottom: "1px solid #e8e6e6" }}>
                    <td style={{ padding: "8px" }}>{article.title}</td>
                    <td style={{ padding: "8px", color: "#414141" }}>{article.hubName}</td>
                    <td style={{ padding: "8px", color: "#414141" }}>
                      {missingKeywords.slice(0, 4).join(", ")}
                      {missingKeywords.length > 4 && ` +${missingKeywords.length - 4}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
