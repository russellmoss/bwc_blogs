"use client";

import { useIntelligenceStore } from "@/lib/store/intelligence-store";

export function QueryBreakdown() {
  const { queryData, isLoadingQueryData, selectedPageForQueries, setSelectedPageForQueries } = useIntelligenceStore();

  if (!selectedPageForQueries) return null;

  if (isLoadingQueryData) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: "16px", textAlign: "center", color: "#414141", fontSize: "13px", background: "#fafafa" }}>
          Loading queries...
        </td>
      </tr>
    );
  }

  if (queryData.length === 0) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: "16px", textAlign: "center", color: "#414141", fontSize: "13px", background: "#fafafa" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>No query data for this page. Run &quot;Sync Queries&quot; to fetch query-level data.</span>
            <button onClick={() => setSelectedPageForQueries(null)}
              style={{ padding: "2px 8px", fontSize: "12px", border: "1px solid #e8e6e6", borderRadius: "4px", background: "#fff", color: "#414141", cursor: "pointer" }}>
              Close
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={6} style={{ padding: "0", background: "#fafafa" }}>
        <div style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#000" }}>
              Top Queries ({queryData.length})
            </span>
            <button onClick={() => setSelectedPageForQueries(null)}
              style={{ padding: "2px 8px", fontSize: "12px", border: "1px solid #e8e6e6", borderRadius: "4px", background: "#fff", color: "#414141", cursor: "pointer" }}>
              Close
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e8e6e6" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#414141", fontWeight: 500 }}>Query</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#414141", fontWeight: 500 }}>Impressions</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#414141", fontWeight: 500 }}>Clicks</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#414141", fontWeight: 500 }}>CTR</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#414141", fontWeight: 500 }}>Avg Position</th>
              </tr>
            </thead>
            <tbody>
              {queryData.map((row) => {
                const isTop10 = row.avgPosition > 0 && row.avgPosition <= 10;
                const isOpportunity = row.avgPosition > 10 && row.avgPosition <= 20 && row.totalImpressions > 10;
                const bg = isTop10 ? "#fefce8" : isOpportunity ? "#fffbeb" : undefined;
                return (
                  <tr key={`${row.query}-${row.page}`} style={{ borderBottom: "1px solid #f0f0f0", background: bg }}>
                    <td style={{ padding: "6px 8px", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.query}>
                      {row.query}
                      {isTop10 && <span style={{ marginLeft: "6px", fontSize: "10px", color: "#bc9b5d", fontWeight: 600 }}>TOP 10</span>}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.totalImpressions.toLocaleString()}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.totalClicks.toLocaleString()}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{(row.avgCtr * 100).toFixed(2)}%</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.avgPosition.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}
