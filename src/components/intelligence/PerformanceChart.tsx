"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartGranularity } from "@/lib/store/intelligence-store";

export interface TimeseriesPoint {
  date: string;
  clicks: number;
  impressions: number;
}

interface Props {
  data: TimeseriesPoint[];
  granularity: ChartGranularity;
}

interface BucketedPoint {
  label: string;
  clicks: number;
  impressions: number;
}

function bucketData(data: TimeseriesPoint[], granularity: ChartGranularity): BucketedPoint[] {
  if (data.length === 0) return [];

  if (granularity === "daily") {
    return data.map((d) => ({ label: d.date, clicks: d.clicks, impressions: d.impressions }));
  }

  const buckets = new Map<string, { clicks: number; impressions: number }>();

  for (const d of data) {
    const dt = new Date(d.date);
    let key: string;
    if (granularity === "weekly") {
      const day = dt.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(dt);
      monday.setDate(dt.getDate() + diff);
      key = monday.toISOString().split("T")[0];
    } else {
      key = d.date.slice(0, 7);
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.clicks += d.clicks;
      existing.impressions += d.impressions;
    } else {
      buckets.set(key, { clicks: d.clicks, impressions: d.impressions });
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, vals]) => ({ label, ...vals }));
}

function formatTick(label: string, granularity: ChartGranularity): string {
  if (granularity === "monthly") {
    const [y, m] = label.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
  }
  const parts = label.split("-");
  return `${parts[1]}/${parts[2]}`;
}

function formatTooltipLabel(label: string, granularity: ChartGranularity): string {
  if (granularity === "monthly") {
    const [y, m] = label.split("-");
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  }
  if (granularity === "weekly") {
    return `Week of ${label}`;
  }
  return label;
}

export function PerformanceChart({ data, granularity }: Props) {
  const bucketed = useMemo(() => bucketData(data, granularity), [data, granularity]);

  if (bucketed.length === 0) {
    return (
      <div style={{ height: "240px", display: "flex", alignItems: "center", justifyContent: "center", color: "#414141", fontSize: "13px" }}>
        No chart data available for this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={bucketed} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8e6e6" />
        <XAxis
          dataKey="label"
          tickFormatter={(v) => formatTick(v, granularity)}
          tick={{ fontSize: 11, fill: "#999" }}
          tickLine={false}
          axisLine={{ stroke: "#e8e6e6" }}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          yAxisId="impressions"
          tick={{ fontSize: 11, fill: "#999" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
          width={48}
        />
        <YAxis
          yAxisId="clicks"
          orientation="right"
          tick={{ fontSize: 11, fill: "#999" }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          labelFormatter={(v) => formatTooltipLabel(String(v), granularity)}
          contentStyle={{ fontSize: "13px", borderRadius: "6px", border: "1px solid #e8e6e6" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((value: any, name: any) => [
            Number(value ?? 0).toLocaleString(),
            name === "impressions" ? "Impressions" : "Clicks",
          ]) as any}
        />
        <Legend
          wrapperStyle={{ fontSize: "12px" }}
          formatter={(value) => (value === "impressions" ? "Impressions" : "Clicks")}
        />
        <Line yAxisId="impressions" type="monotone" dataKey="impressions" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line yAxisId="clicks" type="monotone" dataKey="clicks" stroke="#bc9b5d" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
