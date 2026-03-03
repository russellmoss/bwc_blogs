"use client";

import { useState, useEffect } from "react";
import { X, Check, Image } from "lucide-react";

interface PhotoData {
  id: number;
  driveFileId: string;
  driveUrl: string;
  cloudinaryPublicId: string | null;
  cloudinaryUrl: string | null;
  filename: string;
  category: string | null;
  description: string | null;
  altText: string | null;
  classification: "informative" | "decorative";
  vineyardName: string | null;
  season: string | null;
  widthPx: number | null;
  heightPx: number | null;
  uploadedToCdn: boolean;
}

interface PhotoSelection {
  photoId: number;
  position: string;
}

interface PhotoSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selections: PhotoSelection[]) => void;
  existingSelections?: PhotoSelection[];
}

export function PhotoSelector({ isOpen, onClose, onConfirm, existingSelections = [] }: PhotoSelectorProps) {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [selections, setSelections] = useState<PhotoSelection[]>(existingSelections);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchPhotos();
      setSelections(existingSelections);
    }
  }, [isOpen, existingSelections]);

  async function fetchPhotos() {
    setLoading(true);
    try {
      const res = await fetch("/api/photos");
      const data = await res.json();
      if (data.success) {
        setPhotos(data.data);
      }
    } finally {
      setLoading(false);
    }
  }

  function togglePhoto(photoId: number) {
    setSelections((prev) => {
      const existing = prev.find((s) => s.photoId === photoId);
      if (existing) {
        return prev.filter((s) => s.photoId !== photoId);
      }
      const position = prev.length === 0 ? "hero" : `inline-${prev.length}`;
      return [...prev, { photoId, position }];
    });
  }

  function isSelected(photoId: number) {
    return selections.some((s) => s.photoId === photoId);
  }

  function getPosition(photoId: number) {
    return selections.find((s) => s.photoId === photoId)?.position || "";
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          width: "90vw",
          maxWidth: "900px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #eee" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Image style={{ width: "16px", height: "16px", color: "#bc9b5d" }} />
            <span style={{ fontSize: "15px", fontWeight: 600 }}>Select Photos for Article</span>
            <span style={{ fontSize: "12px", color: "#888" }}>({selections.length} selected)</span>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px" }}>
            <X style={{ width: "18px", height: "18px", color: "#666" }} />
          </button>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: "auto", padding: "14px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>Loading photos...</div>
          ) : photos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>No photos available. Go to the Photo Library to add some.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
              {photos.map((photo) => {
                const selected = isSelected(photo.id);
                const thumbnailUrl = photo.cloudinaryUrl
                  || `https://drive.google.com/thumbnail?id=${photo.driveFileId}&sz=w300`;
                return (
                  <div
                    key={photo.id}
                    onClick={() => togglePhoto(photo.id)}
                    style={{
                      border: selected ? "2px solid #bc9b5d" : "2px solid transparent",
                      borderRadius: "8px",
                      overflow: "hidden",
                      cursor: "pointer",
                      background: selected ? "#faf7f0" : "#fff",
                      position: "relative",
                    }}
                  >
                    <div style={{ width: "100%", paddingTop: "66%", position: "relative", background: "#f7f7f7" }}>
                      <img
                        src={thumbnailUrl}
                        alt={photo.altText || photo.filename}
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      {selected && (
                        <div
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            background: "#bc9b5d",
                            color: "#fff",
                            borderRadius: "50%",
                            width: "22px",
                            height: "22px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Check style={{ width: "13px", height: "13px" }} />
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "6px 8px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {photo.filename}
                      </div>
                      {selected && (
                        <div style={{ fontSize: "10px", color: "#bc9b5d", fontWeight: 600, marginTop: "2px" }}>
                          {getPosition(photo.id)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 16px", borderTop: "1px solid #eee" }}>
          <button onClick={onClose} style={{ fontSize: "13px", padding: "6px 14px", background: "transparent", border: "1px solid #ddd", borderRadius: "6px", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selections)}
            style={{ fontSize: "13px", padding: "6px 14px", background: "#bc9b5d", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            Confirm ({selections.length})
          </button>
        </div>
      </div>
    </div>
  );
}
