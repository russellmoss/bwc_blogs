"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { AggregatedQueryRow } from "@/types/intelligence";

type SortKey = "query" | "totalImpressions" | "totalClicks" | "avgCtr" | "avgPosition";

function positionBadge(pos: number): { label: string; bg: string; color: string } {
  if (pos <= 3) return { label: "Top 3", bg: "#dcfce7", color: "#166534" };
  if (pos <= 10) return { label: "Page 1", bg: "#fefce8", color: "#854d0e" };
  if (pos <= 20) return { label: "Page 2", bg: "#fff7ed", color: "#9a3412" };
  return { label: `Page ${Math.ceil(pos / 10)}`, bg: "#f3f4f6", color: "#374151" };
}

export function KeywordRankings() {
  const [data, setData] = useState<AggregatedQueryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalImpressions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/intelligence/query-performance?groupBy=query&limit=200");
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (error) {
        console.error("[KeywordRankings] Failed to load:", error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "query" ? "asc" : "desc"); }
  }

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    const base = q ? data.filter((r) => r.query.toLowerCase().includes(q)) : data;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sortKey === "query") return a.query.localeCompare(b.query) * dir;
      return ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * dir;
    });
  }, [data, filter, sortKey, sortDir]);

  const summary = useMemo(() => {
    const top3 = data.filter((r) => r.avgPosition <= 3).length;
    const page1 = data.filter((r) => r.avgPosition > 3 && r.avgPosition <= 10).length;
    const page2 = data.filter((r) => r.avgPosition > 10 && r.avgPosition <= 20).length;
    const beyond = data.filter((r) => r.avgPosition > 20).length;
    return { total: data.length, top3, page1, page2, beyond };
  }, [data]);

  function sortArrow(key: SortKey) {
    return sortKey === key ? (sortDir === "asc" ? " \u2191" : " \u2193") : "";
  }

  const thStyle = (_key: SortKey, align: "left" | "right" = "right"): React.CSSProperties => ({
    textAlign: align,
    padding: "10px 12px",
    color: "#414141",
    fontWeight: 600,
    fontSize: "12px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    cursor: "pointer",
    userSelect: "none" as const,
    whiteSpace: "nowrap",
  });

  if (isLoading) {
    return <div style={{ padding: "32px", textAlign: "center", color: "#414141" }}>Loading keyword data...</div>;
  }

  if (data.length === 0) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "#414141" }}>
        No keyword data yet. Go to <strong>Performance</strong> and click <strong>&quot;Sync Queries&quot;</strong> to fetch query-level data from Google Search Console.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
        {[
          { label: "Total Keywords", value: summary.total.toLocaleString(), bg: "#f7f7f7" },
          { label: "Top 3", value: summary.top3.toLocaleString(), bg: "#dcfce7" },
          { label: "Page 1 (4-10)", value: summary.page1.toLocaleString(), bg: "#fefce8" },
          { label: "Page 2 (11-20)", value: summary.page2.toLocaleString(), bg: "#fff7ed" },
          { label: "Page 3+", value: summary.beyond.toLocaleString(), bg: "#f3f4f6" },
        ].map((card) => (
          <div key={card.label} style={{ padding: "14px", background: card.bg, borderRadius: "8px", border: "1px solid #e8e6e6" }}>
            <div style={{ fontSize: "12px", color: "#414141", marginBottom: "4px" }}>{card.label}</div>
            <div style={{ fontSize: "22px", fontWeight: 600, color: "#000000" }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Search filter */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter keywords..."
          style={{
            padding: "6px 12px", fontSize: "13px", border: "1px solid #e8e6e6",
            borderRadius: "4px", color: "#414141", width: "280px",
          }}
        />
        <span style={{ fontSize: "12px", color: "#999" }}>
          {filtered.length} of {data.length} keywords
        </span>
      </div>

      {/* Table */}
      <div style={{ overflow: "auto", border: "1px solid #e8e6e6", borderRadius: "8px", maxHeight: "520px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "35%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "2px solid #e8e6e6", position: "sticky", top: 0, background: "#fafafa", zIndex: 1 }}>
              <th onClick={() => handleSort("query")} style={thStyle("query", "left")}>
                Keyword{sortArrow("query")}
              </th>
              <th style={{ ...thStyle("query", "left"), cursor: "default" }}>Pages</th>
              <th onClick={() => handleSort("totalImpressions")} style={thStyle("totalImpressions")}>
                Impressions{sortArrow("totalImpressions")}
              </th>
              <th onClick={() => handleSort("totalClicks")} style={thStyle("totalClicks")}>
                Clicks{sortArrow("totalClicks")}
              </th>
              <th onClick={() => handleSort("avgCtr")} style={thStyle("avgCtr")}>
                CTR{sortArrow("avgCtr")}
              </th>
              <th onClick={() => handleSort("avgPosition")} style={thStyle("avgPosition")}>
                Position{sortArrow("avgPosition")}
              </th>
              <th style={{ textAlign: "center", padding: "10px 8px", color: "#414141", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Rank
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const badge = positionBadge(row.avgPosition);
              const opportunityBg = row.avgPosition > 10 && row.avgPosition <= 20 && row.totalImpressions > 20 ? "#fffbeb" : undefined;
              return (
                <tr key={row.query} style={{ borderBottom: "1px solid #f0f0f0", background: opportunityBg }}>
                  <td style={{ padding: "10px 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.query}>
                    {row.query}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: "12px", color: "#414141" }}>{row.page}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.totalImpressions.toLocaleString()}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.totalClicks.toLocaleString()}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{(row.avgCtr * 100).toFixed(2)}%</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{row.avgPosition.toFixed(1)}</td>
                  <td style={{ padding: "10px 8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", fontSize: "11px", fontWeight: 500, borderRadius: "4px", background: badge.bg, color: badge.color, whiteSpace: "nowrap" }}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
