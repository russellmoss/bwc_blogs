"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { ImportHtmlModal } from "./ImportHtmlModal";

export function ImportButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Import HTML"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          fontSize: "12px",
          background: "#ffffff",
          color: "#414141",
          border: "1px solid #cccccc",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        <Upload style={{ width: "14px", height: "14px" }} />
        Import HTML
      </button>

      {isOpen && <ImportHtmlModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
