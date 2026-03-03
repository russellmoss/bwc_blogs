"use client";

import { useState } from "react";
import { Pencil, Sparkles, Upload, Check, X, Loader2 } from "lucide-react";

interface PhotoData {
  id: number;
  driveFileId: string | null;
  driveUrl: string | null;
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

interface PhotoCardProps {
  photo: PhotoData;
  onUpdate: (photo: PhotoData) => void;
}

export function PhotoCard({ photo, onUpdate }: PhotoCardProps) {
  const [editing, setEditing] = useState(false);
  const [describing, setDescribing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    description: photo.description || "",
    altText: photo.altText || "",
    category: photo.category || "",
    classification: photo.classification,
    vineyardName: photo.vineyardName || "",
    season: photo.season || "",
  });

  const thumbnailUrl = photo.cloudinaryUrl
    || `https://drive.google.com/thumbnail?id=${photo.driveFileId}&sz=w400`;

  async function handleAiDescribe() {
    setDescribing(true);
    try {
      const res = await fetch("/api/photos/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id }),
      });
      const data = await res.json();
      if (data.success) {
        setForm((f) => ({
          ...f,
          altText: data.data.altText,
          description: data.data.description,
          category: data.data.suggestedCategory || f.category,
        }));
        setEditing(true);
      }
    } finally {
      setDescribing(false);
    }
  }

  async function handleUploadCdn() {
    setUploading(true);
    try {
      const res = await fetch("/api/photos/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id }),
      });
      const data = await res.json();
      if (data.success) {
        onUpdate(data.data);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    const res = await fetch(`/api/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) {
      onUpdate(data.data);
      setEditing(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #e8e6e6",
        borderRadius: "8px",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", width: "100%", paddingTop: "66%", background: "#f7f7f7" }}>
        <img
          src={thumbnailUrl}
          alt={photo.altText || photo.filename}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "6px",
            right: "6px",
            background: photo.uploadedToCdn ? "#16a34a" : "#d97706",
            color: "#fff",
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: 600,
          }}
        >
          {photo.uploadedToCdn ? "CDN" : "Drive"}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "10px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {photo.filename}
        </div>
        {photo.category && (
          <span
            style={{
              display: "inline-block",
              fontSize: "10px",
              padding: "1px 6px",
              borderRadius: "4px",
              background: "#f3f0e8",
              color: "#624c40",
              marginBottom: "6px",
            }}
          >
            {photo.category}
          </span>
        )}
        <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", lineHeight: 1.4, maxHeight: "3.4em", overflow: "hidden" }}>
          {photo.description || "No description"}
        </div>

        {/* Edit Form (expanded) */}
        {editing && (
          <div style={{ borderTop: "1px solid #eee", paddingTop: "8px", marginTop: "4px" }}>
            <label style={{ fontSize: "11px", color: "#888", display: "block", marginBottom: "2px" }}>Alt Text</label>
            <textarea
              value={form.altText}
              onChange={(e) => setForm({ ...form, altText: e.target.value })}
              rows={2}
              style={{ width: "100%", fontSize: "12px", border: "1px solid #ddd", borderRadius: "4px", padding: "4px", resize: "vertical", marginBottom: "6px" }}
            />
            <label style={{ fontSize: "11px", color: "#888", display: "block", marginBottom: "2px" }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              style={{ width: "100%", fontSize: "12px", border: "1px solid #ddd", borderRadius: "4px", padding: "4px", resize: "vertical", marginBottom: "6px" }}
            />
            <label style={{ fontSize: "11px", color: "#888", display: "block", marginBottom: "2px" }}>Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              style={{ width: "100%", fontSize: "12px", border: "1px solid #ddd", borderRadius: "4px", padding: "4px", marginBottom: "6px" }}
            >
              <option value="">Select...</option>
              <option value="vineyard">Vineyard</option>
              <option value="winemaking">Winemaking</option>
              <option value="culture">Culture</option>
              <option value="team">Team</option>
              <option value="food">Food</option>
              <option value="landscape">Landscape</option>
            </select>
            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
              <button onClick={() => setEditing(false)} style={{ fontSize: "12px", padding: "4px 10px", background: "transparent", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                <X style={{ width: "12px", height: "12px" }} /> Cancel
              </button>
              <button onClick={handleSave} style={{ fontSize: "12px", padding: "4px 10px", background: "#bc9b5d", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                <Check style={{ width: "12px", height: "12px" }} /> Save
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!editing && (
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            <button
              onClick={() => setEditing(true)}
              style={{ fontSize: "11px", padding: "3px 8px", background: "transparent", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}
            >
              <Pencil style={{ width: "11px", height: "11px" }} /> Edit
            </button>
            <button
              onClick={handleAiDescribe}
              disabled={describing}
              style={{ fontSize: "11px", padding: "3px 8px", background: "#f3f0e8", border: "1px solid #e0d9c8", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", opacity: describing ? 0.6 : 1 }}
            >
              {describing ? <Loader2 style={{ width: "11px", height: "11px", animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: "11px", height: "11px" }} />}
              AI Describe
            </button>
            {!photo.uploadedToCdn && (
              <button
                onClick={handleUploadCdn}
                disabled={uploading}
                style={{ fontSize: "11px", padding: "3px 8px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", opacity: uploading ? 0.6 : 1 }}
              >
                {uploading ? <Loader2 style={{ width: "11px", height: "11px", animation: "spin 1s linear infinite" }} /> : <Upload style={{ width: "11px", height: "11px" }} />}
                Upload CDN
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
