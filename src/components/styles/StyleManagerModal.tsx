"use client";

import { useState, useEffect } from "react";
import { X, Plus, Star, MoreVertical, Trash2, Edit2, Check } from "lucide-react";
import { useArticleStore } from "@/lib/store/article-store";

interface WritingStyle {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  content: string;
  isDefault: boolean;
  isSeed: boolean;
}

interface StyleManagerModalProps {
  onClose: () => void;
}

export function StyleManagerModal({ onClose }: StyleManagerModalProps) {
  const selectedStyleId = useArticleStore((s) => s.selectedStyleId);
  const setSelectedStyleId = useArticleStore((s) => s.setSelectedStyleId);

  const [styles, setStyles] = useState<WritingStyle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editingStyle, setEditingStyle] = useState<WritingStyle | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formContent, setFormContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Overflow menu
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchStyles = async () => {
    try {
      const res = await fetch("/api/styles");
      const result = await res.json();
      if (result.success) {
        setStyles(result.data);
      }
    } catch {
      setError("Failed to load styles");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStyles();
  }, []);

  const startCreate = () => {
    setEditingStyle(null);
    setIsCreating(true);
    setFormName("");
    setFormDescription("");
    setFormContent("");
    setError(null);
  };

  const startEdit = (style: WritingStyle) => {
    setEditingStyle(style);
    setIsCreating(false);
    setFormName(style.name);
    setFormDescription(style.description || "");
    setFormContent(style.content);
    setMenuOpenId(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingStyle(null);
    setIsCreating(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formContent.trim()) {
      setError("Name and content are required");
      return;
    }
    setIsSaving(true);
    setError(null);

    try {
      if (isCreating) {
        const res = await fetch("/api/styles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDescription.trim() || undefined,
            content: formContent,
          }),
        });
        const result = await res.json();
        if (!result.success) {
          setError(result.error?.message || "Failed to create style");
          return;
        }
      } else if (editingStyle) {
        const res = await fetch(`/api/styles/${editingStyle.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDescription.trim() || undefined,
            content: formContent,
          }),
        });
        const result = await res.json();
        if (!result.success) {
          setError(result.error?.message || "Failed to update style");
          return;
        }
      }

      cancelEdit();
      await fetchStyles();
    } catch {
      setError("Network error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (styleId: number) => {
    setMenuOpenId(null);
    try {
      await fetch(`/api/styles/${styleId}/set-default`, { method: "POST" });
      await fetchStyles();
    } catch {
      setError("Failed to set default");
    }
  };

  const handleDelete = async (styleId: number) => {
    setDeleteConfirmId(null);
    setMenuOpenId(null);
    try {
      await fetch(`/api/styles/${styleId}`, { method: "DELETE" });
      if (selectedStyleId === styleId) {
        setSelectedStyleId(null);
      }
      await fetchStyles();
    } catch {
      setError("Failed to delete style");
    }
  };

  const tokenEstimate = Math.ceil(formContent.length / 4);
  const isEditing = isCreating || editingStyle !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "640px",
          maxHeight: "85vh",
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #e8e6e6",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
            Writing Styles
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {!isEditing && (
              <button
                onClick={startCreate}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 500,
                  background: "#bc9b5d",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                <Plus style={{ width: "14px", height: "14px" }} />
                New Style
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                color: "#414141",
              }}
            >
              <X style={{ width: "18px", height: "18px" }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {/* Error */}
          {error && (
            <div
              style={{
                padding: "8px 12px",
                marginBottom: "12px",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#b91c1c",
              }}
            >
              {error}
            </div>
          )}

          {/* Editor form */}
          {isEditing && (
            <div
              style={{
                marginBottom: "16px",
                padding: "16px",
                border: "1px solid #e8e6e6",
                borderRadius: "8px",
                background: "#f7f7f7",
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600 }}>
                {isCreating ? "New Style" : `Edit: ${editingStyle?.name}`}
              </h3>

              {/* Name */}
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px", color: "#242323" }}>
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Conversational Educator"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: "13px",
                    border: "1px solid #cccccc",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px", color: "#242323" }}>
                  Description (shown in dropdown)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  maxLength={500}
                  placeholder="Brief description of the voice"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: "13px",
                    border: "1px solid #cccccc",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Content */}
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px", color: "#242323" }}>
                  Style Content (Markdown)
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  maxLength={8000}
                  placeholder="Write style directives in markdown..."
                  style={{
                    width: "100%",
                    minHeight: "200px",
                    padding: "10px 12px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    border: "1px solid #cccccc",
                    borderRadius: "6px",
                    resize: "vertical",
                    lineHeight: "1.5",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>
                  {formContent.length.toLocaleString()} / 8,000 characters (~{tokenEstimate.toLocaleString()} tokens)
                </div>
              </div>

              {/* Form actions */}
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  onClick={cancelEdit}
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    background: "#ffffff",
                    border: "1px solid #cccccc",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: "#414141",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !formName.trim() || !formContent.trim()}
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 500,
                    background: formName.trim() && formContent.trim() ? "#bc9b5d" : "#e8e6e6",
                    color: formName.trim() && formContent.trim() ? "#ffffff" : "#999",
                    border: "none",
                    borderRadius: "6px",
                    cursor: formName.trim() && formContent.trim() ? "pointer" : "default",
                  }}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Styles list */}
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "24px", color: "#999", fontSize: "13px" }}>
              Loading styles...
            </div>
          ) : styles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "#999", fontSize: "13px" }}>
              No writing styles yet. Create one to get started.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {styles.map((style) => (
                <div
                  key={style.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    border: "1px solid #e8e6e6",
                    borderRadius: "8px",
                    background: selectedStyleId === style.id ? "#fcf8ed" : "#ffffff",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {style.isDefault && (
                        <Star style={{ width: "14px", height: "14px", color: "#bc9b5d", fill: "#bc9b5d" }} />
                      )}
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "#242323" }}>
                        {style.name}
                      </span>
                      {style.isSeed && (
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "1px 5px",
                            background: "#f7f7f7",
                            border: "1px solid #e8e6e6",
                            borderRadius: "4px",
                            color: "#999",
                          }}
                        >
                          Seed
                        </span>
                      )}
                      {selectedStyleId === style.id && (
                        <Check style={{ width: "14px", height: "14px", color: "#15803d" }} />
                      )}
                    </div>
                    {style.description && (
                      <div style={{ fontSize: "12px", color: "#999", marginTop: "2px" }}>
                        {style.description}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                    <button
                      onClick={() => startEdit(style)}
                      title="Edit"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "4px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#414141",
                      }}
                    >
                      <Edit2 style={{ width: "14px", height: "14px" }} />
                    </button>

                    {/* Overflow menu */}
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === style.id ? null : style.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "4px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "#414141",
                        }}
                      >
                        <MoreVertical style={{ width: "14px", height: "14px" }} />
                      </button>

                      {menuOpenId === style.id && (
                        <>
                          <div
                            onClick={() => setMenuOpenId(null)}
                            style={{ position: "fixed", inset: 0, zIndex: 99 }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              right: 0,
                              marginTop: "4px",
                              width: "160px",
                              background: "#ffffff",
                              border: "1px solid #e8e6e6",
                              borderRadius: "6px",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                              zIndex: 100,
                              overflow: "hidden",
                            }}
                          >
                            {!style.isDefault && (
                              <button
                                onClick={() => handleSetDefault(style.id)}
                                style={{
                                  width: "100%",
                                  padding: "8px 12px",
                                  fontSize: "12px",
                                  textAlign: "left",
                                  background: "transparent",
                                  border: "none",
                                  borderBottom: "1px solid #f3f3f3",
                                  cursor: "pointer",
                                  color: "#414141",
                                }}
                              >
                                Set as Default
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                setDeleteConfirmId(style.id);
                              }}
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                fontSize: "12px",
                                textAlign: "left",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: "#b91c1c",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Trash2 style={{ width: "12px", height: "12px" }} />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete confirmation */}
        {deleteConfirmId && (
          <>
            <div
              onClick={() => setDeleteConfirmId(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.3)",
                zIndex: 1002,
              }}
            />
            <div
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "380px",
                background: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                zIndex: 1003,
                padding: "20px",
              }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600 }}>
                Delete Style?
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#414141" }}>
                This action cannot be undone.
                {selectedStyleId === deleteConfirmId &&
                  " This style is currently selected — it will be deselected."}
              </p>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    background: "#ffffff",
                    border: "1px solid #cccccc",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: "#414141",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 500,
                    background: "#b91c1c",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
