"use client";

import { useCallback, useRef, useState } from "react";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export function SplitPane({ left, right }: SplitPaneProps) {
  const [leftWidth, setLeftWidth] = useState(40); // percentage
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(60, Math.max(25, pct)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        width: "100%",
      }}
    >
      {/* Left panel */}
      <div style={{ width: `${leftWidth}%`, height: "100%", overflow: "hidden", flexShrink: 0 }}>
        {left}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: "6px",
          cursor: "col-resize",
          background: "#e8e6e6",
          flexShrink: 0,
          transition: "background 150ms",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#bc9b5d"; }}
        onMouseLeave={(e) => { if (!dragging.current) e.currentTarget.style.background = "#e8e6e6"; }}
      />

      {/* Right panel */}
      <div style={{ flex: 1, height: "100%", overflow: "hidden" }}>
        {right}
      </div>
    </div>
  );
}
