"use client";

import { useEffect, useState, useRef } from "react";
import { ExternalLink, FileText, Info } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";
import { computeCitationMatches } from "@/lib/citation";
import type { CitationMatch } from "@/types/citation";
import type { OnyxSearchResult } from "@/types/onyx";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

function CitationTooltip({
  match,
  anchorRect,
}: {
  match: CitationMatch;
  anchorRect: DOMRect;
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: anchorRect.bottom + 8,
        left: Math.max(8, anchorRect.left),
        maxWidth: "400px",
        background: "#ffffff",
        border: "1px solid #e8e6e6",
        borderRadius: "8px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        padding: "12px",
        zIndex: 200,
        fontSize: "13px",
        lineHeight: "1.5",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "#242323",
          marginBottom: "6px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <FileText style={{ width: "14px", height: "14px", color: "#bc9b5d" }} />
        {match.source.sourceDocument}
      </div>
      <div style={{ color: "#414141", marginBottom: "8px" }}>
        {truncate(match.source.content, 200)}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            color: "#888",
          }}
        >
          Confidence: {Math.round(match.confidence * 100)}%
        </span>
        {match.source.link && (
          <a
            href={match.source.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              color: "#bc9b5d",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Open in Google Drive
            <ExternalLink style={{ width: "12px", height: "12px" }} />
          </a>
        )}
      </div>
    </div>
  );
}

function HighlightedParagraph({
  html,
  match,
}: {
  html: string;
  match: CitationMatch;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => {
        if (match.source.link) {
          window.open(match.source.link, "_blank", "noopener,noreferrer");
        }
      }}
      style={{
        background: "rgba(188, 155, 93, 0.15)",
        borderLeft: "3px solid #bc9b5d",
        padding: "8px 12px",
        borderRadius: "0 4px 4px 0",
        cursor: match.source.link ? "pointer" : "default",
        transition: "background 0.15s",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "15px",
          lineHeight: "1.7",
          color: "#000000",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {showTooltip && ref.current && (
        <CitationTooltip
          match={match}
          anchorRect={ref.current.getBoundingClientRect()}
        />
      )}
    </div>
  );
}

function SourceSummary({ sources }: { sources: OnyxSearchResult[] }) {
  // Deduplicate by documentId
  const unique = Array.from(
    new Map(sources.map((s) => [s.documentId, s])).values()
  );

  if (unique.length === 0) return null;

  return (
    <div
      style={{
        marginTop: "32px",
        padding: "16px",
        background: "#f7f7f7",
        borderRadius: "8px",
        border: "1px solid #e8e6e6",
      }}
    >
      <h3
        style={{
          margin: "0 0 12px 0",
          fontSize: "14px",
          fontWeight: 600,
          color: "#242323",
        }}
      >
        Knowledge Base Sources ({unique.length})
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {unique.map((source) => (
          <div
            key={source.documentId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              fontSize: "13px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "#414141",
                minWidth: 0,
              }}
            >
              <FileText
                style={{
                  width: "14px",
                  height: "14px",
                  flexShrink: 0,
                  color: "#bc9b5d",
                }}
              />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {source.sourceDocument}
              </span>
            </div>
            {source.link && (
              <a
                href={source.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "12px",
                  color: "#bc9b5d",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Open
                <ExternalLink style={{ width: "12px", height: "12px" }} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CitationView() {
  const currentDocument = useArticleStore((s) => s.currentDocument);
  const onyxSources = useArticleStore((s) => s.onyxSources);
  const citationMatches = useArticleStore((s) => s.citationMatches);
  const setCitationMatches = useArticleStore((s) => s.setCitationMatches);

  // Compute matches on mount if needed
  useEffect(() => {
    if (
      citationMatches === null &&
      onyxSources.length > 0 &&
      currentDocument
    ) {
      const matches = computeCitationMatches(currentDocument, onyxSources);
      setCitationMatches(matches);
    }
  }, [citationMatches, onyxSources, currentDocument, setCitationMatches]);

  if (!currentDocument) {
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
        No article loaded
      </div>
    );
  }

  if (onyxSources.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          color: "#888",
          fontSize: "14px",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <Info style={{ width: "32px", height: "32px", color: "#cccccc" }} />
        <div>
          <div style={{ fontWeight: 500, color: "#414141", marginBottom: "4px" }}>
            No knowledge base sources available
          </div>
          <div style={{ fontSize: "13px" }}>
            Citations are generated when articles use Onyx RAG context during
            generation.
          </div>
        </div>
      </div>
    );
  }

  // Build a lookup: sectionId + nodeIndex -> CitationMatch
  const matchMap = new Map<string, CitationMatch>();
  if (citationMatches) {
    for (const m of citationMatches) {
      matchMap.set(`${m.sectionId}:${m.nodeIndex}`, m);
    }
  }

  const matchedSourceIds = new Set(
    citationMatches?.map((m) => m.source.documentId) ?? []
  );
  const matchedSources = onyxSources.filter((s) =>
    matchedSourceIds.has(s.documentId)
  );

  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        padding: "24px 32px",
        maxWidth: "780px",
        margin: "0 auto",
      }}
    >
      {/* Article title */}
      <h1
        style={{
          fontSize: "32px",
          fontWeight: 600,
          color: "#bc9b5d",
          marginBottom: "8px",
          fontFamily: "'Cormorant Garamond', serif",
        }}
      >
        {currentDocument.title}
      </h1>

      {/* Citation stats */}
      {citationMatches && (
        <div
          style={{
            fontSize: "12px",
            color: "#888",
            marginBottom: "24px",
            padding: "8px 12px",
            background: "rgba(188, 155, 93, 0.08)",
            borderRadius: "6px",
          }}
        >
          {citationMatches.length} paragraph
          {citationMatches.length !== 1 ? "s" : ""} matched to{" "}
          {matchedSources.length} source
          {matchedSources.length !== 1 ? "s" : ""} from the knowledge base.
          Hover highlighted paragraphs for details.
        </div>
      )}

      {/* Sections */}
      {currentDocument.sections.map((section) => (
        <div key={section.id} style={{ marginBottom: "24px" }}>
          {section.headingLevel === 2 ? (
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 400,
                color: "#242323",
                marginBottom: "12px",
                fontFamily: "'Fraunces', serif",
              }}
            >
              {section.heading}
            </h2>
          ) : (
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#000000",
                marginBottom: "8px",
                fontFamily: "'Cormorant Garamond', serif",
              }}
            >
              {section.heading}
            </h3>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {section.content.map((node, nodeIndex) => {
              const matchKey = `${section.id}:${nodeIndex}`;
              const match = matchMap.get(matchKey);

              if (node.type === "paragraph") {
                if (match) {
                  return (
                    <HighlightedParagraph
                      key={node.id}
                      html={node.text}
                      match={match}
                    />
                  );
                }
                return (
                  <p
                    key={node.id}
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      lineHeight: "1.7",
                      color: "#000000",
                      padding: "0 12px",
                    }}
                    dangerouslySetInnerHTML={{ __html: node.text }}
                  />
                );
              }

              if (node.type === "pullQuote") {
                return (
                  <blockquote
                    key={node.id}
                    style={{
                      margin: "8px 0",
                      padding: "8px 16px",
                      borderLeft: "3px solid #e8e6e6",
                      fontStyle: "italic",
                      color: "#624c40",
                      fontSize: "15px",
                    }}
                  >
                    {node.text}
                    {node.attribution && (
                      <footer
                        style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}
                      >
                        — {node.attribution}
                      </footer>
                    )}
                  </blockquote>
                );
              }

              if (node.type === "list") {
                const Tag = node.ordered ? "ol" : "ul";
                return (
                  <Tag
                    key={node.id}
                    style={{
                      margin: "4px 0",
                      paddingLeft: "28px",
                      fontSize: "15px",
                      lineHeight: "1.7",
                      color: "#000000",
                    }}
                  >
                    {node.items.map((item, i) => (
                      <li
                        key={i}
                        dangerouslySetInnerHTML={{ __html: item }}
                      />
                    ))}
                  </Tag>
                );
              }

              // Other node types: render as simple text placeholder
              return (
                <div
                  key={node.id}
                  style={{
                    padding: "4px 12px",
                    fontSize: "13px",
                    color: "#888",
                    fontStyle: "italic",
                  }}
                >
                  [{node.type}]
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Source summary */}
      <SourceSummary sources={matchedSources} />
    </div>
  );
}
