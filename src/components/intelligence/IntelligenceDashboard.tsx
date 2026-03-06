"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useIntelligenceStore } from "@/lib/store/intelligence-store";
import { PerformanceOverview } from "./PerformanceOverview";
import { GapAnalysis } from "./GapAnalysis";
import { RecommendationQueue } from "./RecommendationQueue";

type Tab = "performance" | "gaps" | "recommendations";

export function IntelligenceDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("performance");
  const recommendations = useIntelligenceStore((s) => s.recommendations);

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "performance", label: "Performance" },
    { key: "gaps", label: "Gap Analysis" },
    { key: "recommendations", label: "Recommendations", badge: recommendations.length || undefined },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#000000", margin: 0 }}>
          SEO Intelligence
        </h1>
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 12px",
            fontSize: "13px",
            color: "#414141",
            textDecoration: "none",
            border: "1px solid #e8e6e6",
            borderRadius: "4px",
            background: "#ffffff",
          }}
        >
          <ArrowLeft style={{ width: "14px", height: "14px" }} />
          Back to Composer
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", borderBottom: "1px solid #e8e6e6", marginBottom: "20px" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? "#bc9b5d" : "#414141",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.key ? "2px solid #bc9b5d" : "2px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <span
                style={{
                  padding: "1px 6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "10px",
                  background: "#bc9b5d",
                  color: "#ffffff",
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {activeTab === "performance" && <PerformanceOverview />}
        {activeTab === "gaps" && <GapAnalysis />}
        {activeTab === "recommendations" && <RecommendationQueue />}
      </div>
    </div>
  );
}
