"use client";

import type { ArticleStatus, ArticleType } from "@/types/content-map";

const STATUS_STYLES: Record<ArticleStatus, { bg: string; color: string; label: string }> = {
  planned: { bg: "#e8e6e6", color: "#414141", label: "Planned" },
  drafting: { bg: "#c8eef5", color: "#0e6f82", label: "Drafting" },
  finalized: { bg: "#fef3c7", color: "#92400e", label: "Finalized" },
  published: { bg: "#d1fae5", color: "#065f46", label: "Published" },
  needs_update: { bg: "#fee2e2", color: "#991b1b", label: "Needs Update" },
};

const TYPE_STYLES: Record<ArticleType, { bg: string; color: string; label: string }> = {
  hub: { bg: "#bc9b5d", color: "#ffffff", label: "Hub" },
  spoke: { bg: "#e8e6e6", color: "#414141", label: "Spoke" },
  news: { bg: "#f6ebe4", color: "#624c40", label: "News" },
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.planned;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 500,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: ArticleType }) {
  const s = TYPE_STYLES[type] || TYPE_STYLES.spoke;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 500,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
