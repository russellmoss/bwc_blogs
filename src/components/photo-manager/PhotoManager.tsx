"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Search, Upload, Loader2, ExternalLink, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PhotoCard } from "./PhotoCard";

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

export function PhotoManager() {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cdnFilter, setCdnFilter] = useState<"all" | "cdn" | "drive">("all");

  // Catalog form state
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogForm, setCatalogForm] = useState({ driveFileId: "", driveUrl: "", filename: "", category: "" });
  const [cataloging, setCataloging] = useState(false);

  // Direct upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [directUploading, setDirectUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetchPhotos();
  }, []);

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

  function handlePhotoUpdate(updated: PhotoData) {
    setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handlePhotoDelete(id: number) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleCatalog() {
    setCataloging(true);
    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catalogForm),
      });
      const data = await res.json();
      if (data.success) {
        setPhotos((prev) => [data.data, ...prev]);
        setShowCatalog(false);
        setCatalogForm({ driveFileId: "", driveUrl: "", filename: "", category: "" });
      }
    } finally {
      setCataloging(false);
    }
  }

  async function handleDirectUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files).slice(0, 10); // Cap at 10
    setDirectUploading(true);
    setUploadError(null);
    setUploadProgress({ current: 0, total: fileList.length });

    for (let i = 0; i < fileList.length; i++) {
      setUploadProgress({ current: i + 1, total: fileList.length });
      try {
        // Step 1: Get a signed upload token from our API
        const signRes = await fetch("/api/photos/sign-upload", { method: "POST" });
        if (!signRes.ok) {
          const errText = await signRes.text();
          throw new Error(`Sign failed (${signRes.status}): ${errText}`);
        }
        const signData = await signRes.json();
        if (!signData.success) {
          throw new Error(signData.error?.message || "Failed to get upload signature");
        }
        const { signature, timestamp, folder, apiKey, cloudName } = signData.data;

        // Step 2: Upload directly to Cloudinary (bypasses Vercel 4.5MB body limit)
        const formData = new FormData();
        formData.append("file", fileList[i]);
        formData.append("signature", signature);
        formData.append("timestamp", String(timestamp));
        formData.append("folder", folder);
        formData.append("api_key", apiKey);

        const cldRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: "POST", body: formData }
        );
        if (!cldRes.ok) {
          const errText = await cldRes.text();
          throw new Error(`Cloudinary upload failed (${cldRes.status}): ${errText}`);
        }
        const cldData = await cldRes.json();

        // Step 3: Catalog in our DB + run AI describe (small JSON payload)
        const catalogRes = await fetch("/api/photos/drive-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cloudinaryPublicId: cldData.public_id,
            cloudinaryUrl: cldData.secure_url,
            width: cldData.width,
            height: cldData.height,
            filename: fileList[i].name,
          }),
        });
        if (!catalogRes.ok) {
          const errText = await catalogRes.text();
          throw new Error(`Catalog failed (${catalogRes.status}): ${errText}`);
        }
        const catalogData = await catalogRes.json();
        if (catalogData.success) {
          setPhotos((prev) => [catalogData.data, ...prev]);
        } else {
          throw new Error(catalogData.error?.message || "Catalog failed");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Upload error for ${fileList[i].name}:`, msg);
        setUploadError(`Failed to upload ${fileList[i].name}: ${msg}`);
      }
    }

    setDirectUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Filter logic
  const filtered = photos.filter((p) => {
    if (search && !p.filename.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (cdnFilter === "cdn" && !p.uploadedToCdn) return false;
    if (cdnFilter === "drive" && p.uploadedToCdn) return false;
    return true;
  });

  const cdnCount = photos.filter((p) => p.uploadedToCdn).length;
  const needsDescCount = photos.filter((p) => !p.altText).length;

  const driveUrl = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_PHOTOS_FOLDER_URL;

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            href="/dashboard"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              border: "1px solid #ddd",
              color: "#555",
              textDecoration: "none",
            }}
            title="Back to Composer"
          >
            <ArrowLeft style={{ width: "16px", height: "16px" }} />
          </Link>
          <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: 0, color: "#000" }}>
            Photo Library
          </h1>
          <p style={{ fontSize: "13px", color: "#666", margin: "4px 0 0" }}>
            {photos.length} photos &middot; {cdnCount} on CDN &middot; {needsDescCount} need description
          </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                fontSize: "13px",
                color: "#bc9b5d",
                border: "1px solid #bc9b5d",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              <ExternalLink style={{ width: "13px", height: "13px" }} /> Source Drive
            </a>
          )}
          <button
            onClick={() => setShowCatalog(!showCatalog)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 12px",
              fontSize: "13px",
              background: "transparent",
              border: "1px solid #ddd",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <Plus style={{ width: "13px", height: "13px" }} /> Add from Drive
          </button>

          {/* Direct Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleDirectUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={directUploading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 12px",
              fontSize: "13px",
              background: "#bc9b5d",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              opacity: directUploading ? 0.6 : 1,
            }}
          >
            {directUploading ? (
              <Loader2 style={{ width: "13px", height: "13px", animation: "spin 1s linear infinite" }} />
            ) : (
              <Upload style={{ width: "13px", height: "13px" }} />
            )}
            {directUploading
              ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
              : "Upload Photos"}
          </button>
        </div>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "10px 14px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#991b1b" }}>{uploadError}</span>
          <button onClick={() => setUploadError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontSize: "16px" }}>&times;</button>
        </div>
      )}

      {/* Catalog Form */}
      {showCatalog && (
        <div style={{ background: "#f9f8f4", border: "1px solid #e0d9c8", borderRadius: "8px", padding: "14px", marginBottom: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "10px" }}>Catalog from Google Drive</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div>
              <label style={{ fontSize: "11px", color: "#888" }}>Drive File ID *</label>
              <input
                value={catalogForm.driveFileId}
                onChange={(e) => setCatalogForm({ ...catalogForm, driveFileId: e.target.value })}
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                style={{ width: "100%", fontSize: "12px", border: "1px solid #ddd", borderRadius: "4px", padding: "6px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#888" }}>Drive URL *</label>
              <input
                value={catalogForm.driveUrl}
                onChange={(e) => setCatalogForm({ ...catalogForm, driveUrl: e.target.value })}
                placeholder="https://drive.google.com/file/d/.../view"
                style={{ width: "100%", fontSize: "12px", border: "1px solid #ddd", borderRadius: "4px", padding: "6px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#888" }}>Filename *</label>
              <input
                value={catalogForm.filename}
                onChange={(e) => setCatalogForm({ ...catalogForm, filename: e.target.value })}
                placeholder="bajo-harvest-2024.jpg"
                style={{ width: "100%", fontSize: "12px", border: "1px solid #ddd", borderRadius: "4px", padding: "6px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#888" }}>Category</label>
              <select
                value={catalogForm.category}
                onChange={(e) => setCatalogForm({ ...catalogForm, category: e.target.value })}
                style={{ width: "100%", fontSize: "12px", border: "1px solid #ddd", borderRadius: "4px", padding: "6px" }}
              >
                <option value="">Select...</option>
                <option value="vineyard">Vineyard</option>
                <option value="winemaking">Winemaking</option>
                <option value="culture">Culture</option>
                <option value="team">Team</option>
                <option value="food">Food</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
            <button onClick={() => setShowCatalog(false)} style={{ fontSize: "12px", padding: "5px 12px", background: "transparent", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer" }}>
              Cancel
            </button>
            <button
              onClick={handleCatalog}
              disabled={cataloging || !catalogForm.driveFileId || !catalogForm.driveUrl || !catalogForm.filename}
              style={{ fontSize: "12px", padding: "5px 12px", background: "#bc9b5d", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", opacity: cataloging ? 0.6 : 1 }}
            >
              {cataloging ? "Cataloging..." : "Catalog Photo"}
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: "300px" }}>
          <Search style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", color: "#999" }} />
          <input
            placeholder="Search by filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: "30px", padding: "6px 8px 6px 30px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "6px" }}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ fontSize: "13px", border: "1px solid #ddd", borderRadius: "6px", padding: "6px 8px" }}
        >
          <option value="">All categories</option>
          <option value="vineyard">Vineyard</option>
          <option value="winemaking">Winemaking</option>
          <option value="culture">Culture</option>
          <option value="team">Team</option>
          <option value="food">Food</option>
          <option value="landscape">Landscape</option>
        </select>
        <select
          value={cdnFilter}
          onChange={(e) => setCdnFilter(e.target.value as "all" | "cdn" | "drive")}
          style={{ fontSize: "13px", border: "1px solid #ddd", borderRadius: "6px", padding: "6px 8px" }}
        >
          <option value="all">All status</option>
          <option value="cdn">On CDN</option>
          <option value="drive">Drive only</option>
        </select>
      </div>

      {/* Photo Grid — Available Library */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>
          <Loader2 style={{ width: "24px", height: "24px", animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
          Loading photo library...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>
          {photos.length === 0
            ? "No photos cataloged yet. Click \"Upload Photo\" or \"Add from Drive\" to get started."
            : "No photos match your filters."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "14px",
          }}
        >
          {filtered.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} onUpdate={handlePhotoUpdate} onDelete={handlePhotoDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
