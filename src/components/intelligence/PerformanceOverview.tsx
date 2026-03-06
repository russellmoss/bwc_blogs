"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useIntelligenceStore, classifyPageType } from "@/lib/store/intelligence-store";
import type { DateRange, ChartGranularity, PageType } from "@/lib/store/intelligence-store";
import type { PerformanceWithContentMap } from "@/types/intelligence";
import { PerformanceChart } from "./PerformanceChart";

type SortKey = "clicks" | "impressions" | "ctr" | "position";

const rangeOptions: { key: DateRange; label: string }[] = [
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

const granularityOptions: { key: ChartGranularity; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const pageTypeOptions: { key: PageType; label: string }[] = [
  { key: "blog", label: "Blog" },
  { key: "product", label: "Products" },
  { key: "static", label: "Static" },
];

export function PerformanceOverview() {
  const store = useIntelligenceStore();
  const {
    performanceData, timeseries,
    isLoadingPerformance, isLoadingTimeseries,
    dateRange, setDateRange,
    customStartDate, customEndDate, setCustomDateRange,
    chartGranularity, setChartGranularity,
    pageTypes, togglePageType,
    fetchPerformance, fetchTimeseries,
    triggerSync, isSyncing, latestDataDate,
  } = store;

  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [localStart, setLocalStart] = useState(customStartDate);
  const [localEnd, setLocalEnd] = useState(customEndDate);
  const [initialized, setInitialized] = useState(false);

  // Serialize pageTypes Set for stable useEffect dependency
  const pageTypesKey = Array.from(pageTypes).sort().join(",");

  const fetchAll = useCallback(() =>
    Promise.all([fetchPerformance(), fetchTimeseries()]),
    [fetchPerformance, fetchTimeseries]
  );

  // On first load: fetch "all" to detect date boundaries, then apply user's default range
  useEffect(() => {
    if (!initialized) {
      const s = useIntelligenceStore.getState();
      const savedRange = s.dateRange;
      useIntelligenceStore.setState({ dateRange: "all" });
      Promise.all([fetchPerformance(), fetchTimeseries()]).then(() => {
        useIntelligenceStore.setState({ dateRange: savedRange });
        setInitialized(true);
      });
      return;
    }
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, dateRange, customStartDate, customEndDate, pageTypesKey]);

  const summary = useMemo(() => {
    const totalClicks = performanceData.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = performanceData.reduce((s, r) => s + r.impressions, 0);
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition = performanceData.length > 0
      ? performanceData.reduce((s, r) => s + r.position, 0) / performanceData.length : 0;
    return { totalClicks, totalImpressions, avgCtr, avgPosition };
  }, [performanceData]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...performanceData].sort((a, b) => ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * dir);
  }, [performanceData, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function getRowBg(row: PerformanceWithContentMap): string | undefined {
    if (row.impressions > 100 && row.clicks === 0) return "#fffbeb";
    if (row.position >= 4 && row.position <= 10) return "#eff6ff";
    return undefined;
  }

  function getPageLabel(row: PerformanceWithContentMap): string {
    if (row.contentMap?.title) return row.contentMap.title;
    const path = row.page.replace("https://www.bhutanwine.com", "");
    return path || "/";
  }

  function getPageType(row: PerformanceWithContentMap): string {
    if (row.contentMap) return "Blog";
    const type = classifyPageType(row.page);
    if (type === "product") return "Product";
    if (type === "blog") return "Blog";
    return "Static";
  }

  function getPageTypeBadge(row: PerformanceWithContentMap): { label: string; bg: string; color: string } {
    const type = getPageType(row);
    switch (type) {
      case "Product": return { label: "Product", bg: "#fef3c7", color: "#92400e" };
      case "Blog": return { label: "Blog", bg: "#dbeafe", color: "#1e40af" };
      default: return { label: "Static", bg: "#f3f4f6", color: "#374151" };
    }
  }

  function exportCsv() {
    const header = "Page,Type,URL,Clicks,Impressions,CTR,Position";
    const rows = sorted.map((r) => {
      const label = getPageLabel(r).replace(/,/g, " ");
      const type = getPageType(r);
      const ctr = (r.ctr * 100).toFixed(2) + "%";
      const pos = r.position.toFixed(1);
      return `"${label}","${type}","${r.page}",${r.clicks},${r.impressions},${ctr},${pos}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gsc-performance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const btn = (active: boolean) => ({
    padding: "4px 12px" as const,
    fontSize: "13px" as const,
    border: "1px solid #e8e6e6" as const,
    borderRadius: "4px" as const,
    background: active ? "#bc9b5d" : "#ffffff",
    color: active ? "#ffffff" : "#414141",
    cursor: "pointer" as const,
    whiteSpace: "nowrap" as const,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Row 1: Date range + Sync */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {rangeOptions.map((opt) => (
              <button key={opt.key} onClick={() => setDateRange(opt.key)} style={btn(dateRange === opt.key)}>
                {opt.label}
              </button>
            ))}
          </div>
          {dateRange === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="date" value={localStart} onChange={(e) => setLocalStart(e.target.value)}
                style={{ padding: "3px 8px", fontSize: "13px", border: "1px solid #e8e6e6", borderRadius: "4px", color: "#414141" }} />
              <span style={{ fontSize: "13px", color: "#414141" }}>to</span>
              <input type="date" value={localEnd} onChange={(e) => setLocalEnd(e.target.value)}
                style={{ padding: "3px 8px", fontSize: "13px", border: "1px solid #e8e6e6", borderRadius: "4px", color: "#414141" }} />
              <button onClick={() => setCustomDateRange(localStart, localEnd)} style={btn(true)}>Apply</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {latestDataDate && (
            <span style={{ fontSize: "11px", color: "#999" }}>Data through {latestDataDate}</span>
          )}
          <button onClick={() => triggerSync()} disabled={isSyncing}
            style={{ ...btn(false), opacity: isSyncing ? 0.6 : 1, cursor: isSyncing ? "wait" : "pointer" }}>
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      </div>

      {/* Row 2: Page type toggles */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "12px", color: "#999", fontWeight: 500 }}>Show:</span>
        <div style={{ display: "flex", gap: "4px" }}>
          {pageTypeOptions.map((opt) => {
            const active = pageTypes.has(opt.key);
            return (
              <button key={opt.key} onClick={() => togglePageType(opt.key)}
                style={{
                  padding: "3px 12px", fontSize: "12px", border: "1px solid #e8e6e6", borderRadius: "12px",
                  background: active ? "#bc9b5d" : "#fff", color: active ? "#fff" : "#414141",
                  cursor: "pointer", fontWeight: active ? 600 : 400, transition: "all 0.15s",
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        {[
          { label: "Total Clicks", value: summary.totalClicks.toLocaleString() },
          { label: "Total Impressions", value: summary.totalImpressions.toLocaleString() },
          { label: "Avg CTR", value: (summary.avgCtr * 100).toFixed(2) + "%" },
          { label: "Avg Position", value: summary.avgPosition.toFixed(1) },
        ].map((card) => (
          <div key={card.label} style={{ padding: "16px", background: "#f7f7f7", borderRadius: "8px", border: "1px solid #e8e6e6" }}>
            <div style={{ fontSize: "12px", color: "#414141", marginBottom: "4px" }}>{card.label}</div>
            <div style={{ fontSize: "24px", fontWeight: 600, color: "#000000" }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ border: "1px solid #e8e6e6", borderRadius: "8px", padding: "16px", background: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#000" }}>Clicks &amp; Impressions Over Time</span>
          <div style={{ display: "flex", gap: "4px" }}>
            {granularityOptions.map((opt) => (
              <button key={opt.key} onClick={() => setChartGranularity(opt.key)}
                style={{ padding: "2px 10px", fontSize: "12px", border: "1px solid #e8e6e6", borderRadius: "4px",
                  background: chartGranularity === opt.key ? "#bc9b5d" : "#fff",
                  color: chartGranularity === opt.key ? "#fff" : "#414141", cursor: "pointer" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {isLoadingTimeseries ? (
          <div style={{ height: "260px", display: "flex", alignItems: "center", justifyContent: "center", color: "#414141", fontSize: "13px" }}>
            Loading chart...
          </div>
        ) : (
          <PerformanceChart data={timeseries} granularity={chartGranularity} />
        )}
      </div>

      {/* Table header: count + CSV export */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#000" }}>Pages</span>
          {!isLoadingPerformance && (
            <span style={{ fontSize: "12px", color: "#999" }}>
              {performanceData.length} pages
            </span>
          )}
        </div>
        {performanceData.length > 0 && (
          <button onClick={exportCsv} style={{ ...btn(false), fontSize: "12px", padding: "3px 10px" }}>
            Export CSV
          </button>
        )}
      </div>

      {/* Table */}
      {isLoadingPerformance ? (
        <div style={{ padding: "32px", textAlign: "center", color: "#414141" }}>Loading...</div>
      ) : performanceData.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", color: "#414141" }}>
          No performance data yet. Click &quot;Sync Now&quot; to fetch data from Google Search Console.
        </div>
      ) : (
        <div style={{ overflow: "auto", border: "1px solid #e8e6e6", borderRadius: "8px", maxHeight: "420px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "40%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "2px solid #e8e6e6", position: "sticky", top: 0, background: "#fafafa", zIndex: 1 }}>
                <th style={{ textAlign: "left", padding: "10px 12px", color: "#414141", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Page</th>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "#414141", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Type</th>
                {(["clicks", "impressions", "ctr", "position"] as SortKey[]).map((key) => (
                  <th key={key} onClick={() => handleSort(key)}
                    style={{ textAlign: "right", padding: "10px 12px", color: "#414141", fontWeight: 600, fontSize: "12px",
                      textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                    {key === "ctr" ? "CTR" : key.charAt(0).toUpperCase() + key.slice(1)}
                    {sortKey === key ? (sortDir === "asc" ? " \u2191" : " \u2193") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const badge = getPageTypeBadge(row);
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f0f0f0", background: getRowBg(row) }}>
                    <td style={{ padding: "10px 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.page}>
                      {getPageLabel(row)}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{ padding: "2px 8px", fontSize: "11px", fontWeight: 500, borderRadius: "4px",
                        background: badge.bg, color: badge.color, whiteSpace: "nowrap" }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.clicks.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.impressions.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{(row.ctr * 100).toFixed(2)}%</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.position.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
