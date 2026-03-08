"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, UserPlus, Eye, EyeOff, KeyRound, Activity, ChevronLeft, ChevronRight, X, Database, RefreshCw } from "lucide-react";

function PasswordInput({ value, onChange, placeholder, required, minLength, style }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  style?: React.CSSProperties;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        style={{ ...style, paddingRight: "36px" }}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        tabIndex={-1}
        style={{
          position: "absolute",
          right: "8px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#888",
          display: "flex",
          alignItems: "center",
          padding: "2px",
        }}
      >
        {visible ? <EyeOff style={{ width: "16px", height: "16px" }} /> : <Eye style={{ width: "16px", height: "16px" }} />}
      </button>
    </div>
  );
}

interface UserRecord {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

// ── Change Password Section ──────────────────────────────────────────

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: "Password updated successfully" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ type: "error", text: data.error?.message || "Failed to update password" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e8e6e6", borderRadius: "8px", padding: "24px" }}>
      <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#000", margin: "0 0 16px 0" }}>
        Change Password
      </h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px" }}>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#414141", marginBottom: "4px" }}>
            Current Password
          </label>
          <PasswordInput
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "6px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#414141", marginBottom: "4px" }}>
            New Password
          </label>
          <PasswordInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "6px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#414141", marginBottom: "4px" }}>
            Confirm New Password
          </label>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "6px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {message && (
          <p style={{
            fontSize: "13px",
            color: message.type === "success" ? "#15803d" : "#b91c1c",
            margin: 0,
          }}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "8px 16px",
            background: "#000",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
            alignSelf: "flex-start",
          }}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

// ── User Management Section ──────────────────────────────────────────

function UserManagementSection() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New user form
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  // Reset password
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        setError(data.error?.message || "Failed to load users");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setCreating(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          password: newPassword,
          role: "editor",
        }),
      });
      const data = await res.json();

      if (data.success) {
        setNewEmail("");
        setNewName("");
        setNewPassword("");
        setShowForm(false);
        fetchUsers();
      } else {
        setFormError(data.error?.message || "Failed to create user");
      }
    } catch {
      setFormError("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(userId: number, email: string) {
    if (!confirm(`Deactivate user ${email}? They will no longer be able to log in.`)) return;

    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error?.message || "Failed to deactivate user");
      }
    } catch {
      alert("Network error");
    }
  }

  async function handleReactivate(userId: number) {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error?.message || "Failed to reactivate user");
      }
    } catch {
      alert("Network error");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUserId) return;
    setResetMessage(null);

    if (resetPassword.length < 8) {
      setResetMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    setResetting(true);
    try {
      const res = await fetch(`/api/users/${resetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setResetMessage({ type: "success", text: "Password reset successfully" });
        setResetPassword("");
        setTimeout(() => {
          setResetUserId(null);
          setResetMessage(null);
        }, 2000);
      } else {
        setResetMessage({ type: "error", text: data.error?.message || "Failed to reset password" });
      }
    } catch {
      setResetMessage({ type: "error", text: "Network error" });
    } finally {
      setResetting(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e8e6e6", borderRadius: "8px", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#000", margin: 0 }}>
          Users
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            background: showForm ? "#f7f7f7" : "#000",
            color: showForm ? "#414141" : "#fff",
            border: showForm ? "1px solid #ccc" : "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <UserPlus style={{ width: "14px", height: "14px" }} />
          {showForm ? "Cancel" : "Add User"}
        </button>
      </div>

      {/* New user form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "flex-end",
            flexWrap: "wrap",
            padding: "12px",
            background: "#f7f7f7",
            borderRadius: "6px",
            marginBottom: "16px",
          }}
        >
          <div style={{ flex: "1 1 180px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#888", marginBottom: "4px" }}>Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              placeholder="user@example.com"
              style={{ width: "100%", padding: "6px 10px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#888", marginBottom: "4px" }}>Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              placeholder="Full name"
              style={{ width: "100%", padding: "6px 10px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#888", marginBottom: "4px" }}>Password</label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min 8 chars"
              style={{ width: "100%", padding: "6px 10px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            style={{
              padding: "6px 16px",
              background: "#15803d",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: creating ? "not-allowed" : "pointer",
              opacity: creating ? 0.5 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {creating ? "Creating..." : "Create"}
          </button>
          {formError && (
            <p style={{ width: "100%", fontSize: "12px", color: "#b91c1c", margin: "4px 0 0 0" }}>{formError}</p>
          )}
        </form>
      )}

      {/* User list */}
      {loading ? (
        <p style={{ fontSize: "13px", color: "#888" }}>Loading users...</p>
      ) : error ? (
        <p style={{ fontSize: "13px", color: "#b91c1c" }}>{error}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e8e6e6" }}>
              <th style={{ textAlign: "left", padding: "8px 4px", color: "#888", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Email</th>
              <th style={{ textAlign: "left", padding: "8px 4px", color: "#888", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Name</th>
              <th style={{ textAlign: "left", padding: "8px 4px", color: "#888", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Status</th>
              <th style={{ textAlign: "right", padding: "8px 4px", color: "#888", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <React.Fragment key={user.id}>
                <tr style={{ borderBottom: resetUserId === user.id ? "none" : "1px solid #f3f3f3" }}>
                  <td style={{ padding: "8px 4px", color: "#000" }}>{user.email}</td>
                  <td style={{ padding: "8px 4px", color: "#414141" }}>{user.name}</td>
                  <td style={{ padding: "8px 4px" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 500,
                      background: user.isActive ? "#f0fdf4" : "#fef2f2",
                      color: user.isActive ? "#15803d" : "#b91c1c",
                    }}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 4px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <button
                        onClick={() => {
                          if (resetUserId === user.id) {
                            setResetUserId(null);
                            setResetPassword("");
                            setResetMessage(null);
                          } else {
                            setResetUserId(user.id);
                            setResetPassword("");
                            setResetMessage(null);
                          }
                        }}
                        title="Reset password"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "4px 8px",
                          background: resetUserId === user.id ? "#f7f7f7" : "transparent",
                          border: "1px solid #e8e6e6",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                          color: "#414141",
                        }}
                      >
                        <KeyRound style={{ width: "12px", height: "12px" }} />
                        Reset Password
                      </button>
                      {user.isActive ? (
                        <button
                          onClick={() => handleDelete(user.id, user.email)}
                          title="Deactivate user"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            background: "transparent",
                            border: "1px solid #e8e6e6",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                            color: "#b91c1c",
                          }}
                        >
                          <Trash2 style={{ width: "12px", height: "12px" }} />
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(user.id)}
                          title="Reactivate user"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            background: "transparent",
                            border: "1px solid #e8e6e6",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                            color: "#15803d",
                          }}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {resetUserId === user.id && (
                  <tr style={{ borderBottom: "1px solid #f3f3f3" }}>
                    <td colSpan={4} style={{ padding: "8px 4px 12px" }}>
                      <form
                        onSubmit={handleResetPassword}
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                          padding: "10px 12px",
                          background: "#f7f7f7",
                          borderRadius: "6px",
                        }}
                      >
                        <span style={{ fontSize: "12px", color: "#414141", whiteSpace: "nowrap" }}>
                          New password for <strong>{user.email}</strong>:
                        </span>
                        <PasswordInput
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          required
                          minLength={8}
                          placeholder="Min 8 chars"
                          style={{
                            width: "200px",
                            padding: "6px 10px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                        <button
                          type="submit"
                          disabled={resetting}
                          style={{
                            padding: "6px 14px",
                            background: "#000",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 500,
                            cursor: resetting ? "not-allowed" : "pointer",
                            opacity: resetting ? 0.5 : 1,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {resetting ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setResetUserId(null); setResetPassword(""); setResetMessage(null); }}
                          style={{
                            padding: "6px 14px",
                            background: "transparent",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer",
                            color: "#414141",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Cancel
                        </button>
                        {resetMessage && (
                          <span style={{
                            fontSize: "12px",
                            color: resetMessage.type === "success" ? "#15803d" : "#b91c1c",
                          }}>
                            {resetMessage.text}
                          </span>
                        )}
                      </form>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Activity Log Section ─────────────────────────────────────────────

interface ActivityLogEntry {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "LOGIN", label: "Login" },
  { value: "ARTICLE_FINALIZED", label: "Article Finalized" },
  { value: "ARTICLE_PUBLISHED", label: "Article Published" },
  { value: "USER_CREATED", label: "User Created" },
  { value: "USER_DEACTIVATED", label: "User Deactivated" },
  { value: "USER_REACTIVATED", label: "User Reactivated" },
  { value: "USER_PASSWORD_RESET", label: "Password Reset (Admin)" },
  { value: "PASSWORD_CHANGED", label: "Password Changed" },
];

const ACTION_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  LOGIN:               { bg: "#f0fdf4", color: "#15803d", label: "Login" },
  ARTICLE_FINALIZED:   { bg: "#eff6ff", color: "#1d4ed8", label: "Finalized" },
  ARTICLE_PUBLISHED:   { bg: "#f5f3ff", color: "#6d28d9", label: "Published" },
  USER_CREATED:        { bg: "#f0fdf4", color: "#166534", label: "User Created" },
  USER_DEACTIVATED:    { bg: "#fef2f2", color: "#b91c1c", label: "Deactivated" },
  USER_REACTIVATED:    { bg: "#ecfdf5", color: "#065f46", label: "Reactivated" },
  USER_PASSWORD_RESET: { bg: "#fff7ed", color: "#9a3412", label: "Password Reset" },
  PASSWORD_CHANGED:    { bg: "#fafaf9", color: "#44403c", label: "Password Changed" },
};

function formatDetails(action: string, metadata: Record<string, unknown> | null): string {
  if (!metadata) return "";
  switch (action) {
    case "ARTICLE_FINALIZED":
      return `Finalized "${metadata.articleTitle}"${metadata.version ? ` (v${metadata.version}, ${metadata.articleType})` : ""}`;
    case "ARTICLE_PUBLISHED":
      return `Published "${metadata.articleTitle}"${metadata.publishedUrl ? ` → ${metadata.publishedUrl}` : ""}`;
    case "USER_CREATED":
      return `Created ${metadata.role} account for ${metadata.targetEmail}`;
    case "USER_DEACTIVATED":
      return `Deactivated ${metadata.targetEmail}`;
    case "USER_REACTIVATED":
      return `Reactivated ${metadata.targetEmail}`;
    case "USER_PASSWORD_RESET":
      return `Reset password for ${metadata.targetEmail}`;
    case "LOGIN":
      return "Logged in";
    case "PASSWORD_CHANGED":
      return "Changed own password";
    default:
      return JSON.stringify(metadata);
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    + ", "
    + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function ActivityLogSection() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterUserId, setFilterUserId] = useState<number | "">("");
  const [filterAction, setFilterAction] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Users for filter dropdown
  const [users, setUsers] = useState<{ id: number; name: string; email: string }[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUsers(data.data);
      })
      .catch(() => {});
  }, []);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterUserId) params.set("userId", String(filterUserId));
      if (filterAction) params.set("action", filterAction);
      if (filterDateFrom) params.set("dateFrom", filterDateFrom);
      if (filterDateTo) params.set("dateTo", filterDateTo);
      params.set("page", String(page));
      params.set("pageSize", "25");

      const res = await fetch(`/api/activity-log?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.data.entries);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      } else {
        setError(data.error?.message || "Failed to load activity log");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [page, filterUserId, filterAction, filterDateFrom, filterDateTo]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // Reset to page 1 when filters change
  const updateFilter = (setter: (v: any) => void, value: any) => {
    setPage(1);
    setter(value);
  };

  const hasFilters = filterUserId !== "" || filterAction !== "" || filterDateFrom !== "" || filterDateTo !== "";

  const selectStyle: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "13px",
    background: "#fff",
    color: "#242323",
    minWidth: "140px",
  };

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "13px",
    width: "140px",
    color: "#242323",
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e8e6e6", borderRadius: "8px", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Activity style={{ width: "18px", height: "18px", color: "#bc9b5d" }} />
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#000", margin: 0 }}>
          Activity Log
        </h2>
      </div>

      {/* Filter bar */}
      <div style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        flexWrap: "wrap",
        padding: "12px",
        background: "#f7f7f7",
        borderRadius: "6px",
        marginBottom: "16px",
      }}>
        <select
          value={filterUserId}
          onChange={(e) => updateFilter(setFilterUserId, e.target.value ? parseInt(e.target.value, 10) : "")}
          style={selectStyle}
        >
          <option value="">All Users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <select
          value={filterAction}
          onChange={(e) => updateFilter(setFilterAction, e.target.value)}
          style={selectStyle}
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => updateFilter(setFilterDateFrom, e.target.value)}
          style={inputStyle}
          title="From date"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => updateFilter(setFilterDateTo, e.target.value)}
          style={inputStyle}
          title="To date"
        />

        {hasFilters && (
          <button
            onClick={() => {
              setPage(1);
              setFilterUserId("");
              setFilterAction("");
              setFilterDateFrom("");
              setFilterDateTo("");
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 10px",
              background: "transparent",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "12px",
              cursor: "pointer",
              color: "#414141",
            }}
          >
            <X style={{ width: "12px", height: "12px" }} />
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ fontSize: "13px", color: "#888" }}>Loading activity...</p>
      ) : error ? (
        <p style={{ fontSize: "13px", color: "#b91c1c" }}>{error}</p>
      ) : entries.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#888" }}>No activity found.</p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e8e6e6" }}>
                <th style={{ textAlign: "left", padding: "8px 4px", color: "#888", fontWeight: 500, fontSize: "11px", textTransform: "uppercase", width: "160px" }}>Date/Time</th>
                <th style={{ textAlign: "left", padding: "8px 4px", color: "#888", fontWeight: 500, fontSize: "11px", textTransform: "uppercase", width: "140px" }}>User</th>
                <th style={{ textAlign: "left", padding: "8px 4px", color: "#888", fontWeight: 500, fontSize: "11px", textTransform: "uppercase", width: "130px" }}>Action</th>
                <th style={{ textAlign: "left", padding: "8px 4px", color: "#888", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const badge = ACTION_BADGES[entry.action] || { bg: "#f7f7f7", color: "#414141", label: entry.action };
                return (
                  <tr key={entry.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                    <td style={{ padding: "8px 4px", color: "#414141", fontSize: "12px", whiteSpace: "nowrap" }}>
                      {formatDate(entry.createdAt)}
                    </td>
                    <td style={{ padding: "8px 4px" }}>
                      <div style={{ color: "#000", fontSize: "13px" }}>{entry.userName}</div>
                      <div style={{ color: "#888", fontSize: "11px" }}>{entry.userEmail}</div>
                    </td>
                    <td style={{ padding: "8px 4px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 500,
                        background: badge.bg,
                        color: badge.color,
                        whiteSpace: "nowrap",
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: "8px 4px", color: "#414141", fontSize: "12px" }}>
                      {formatDetails(entry.action, entry.metadata)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "12px",
            fontSize: "12px",
            color: "#888",
          }}>
            <span>
              Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  background: page <= 1 ? "#f7f7f7" : "#fff",
                  border: "1px solid #e8e6e6",
                  borderRadius: "4px",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  color: page <= 1 ? "#ccc" : "#414141",
                }}
              >
                <ChevronLeft style={{ width: "12px", height: "12px" }} />
                Prev
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  background: page >= totalPages ? "#f7f7f7" : "#fff",
                  border: "1px solid #e8e6e6",
                  borderRadius: "4px",
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  color: page >= totalPages ? "#ccc" : "#414141",
                }}
              >
                Next
                <ChevronRight style={{ width: "12px", height: "12px" }} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Knowledge Base Section ───────────────────────────────────────────

interface KbHealth {
  provider: string;
  healthy: boolean;
  documentCount: number;
  chunkCount: number;
  lastSyncAt: string | null;
  lastSyncPageToken: string | null;
}

interface SyncResult {
  filesProcessed: number;
  filesDeleted: number;
  chunksCreated: number;
  errors: string[];
  durationMs: number;
}

function KnowledgeBaseSection() {
  const [health, setHealth] = useState<KbHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/rag/health");
      const data = await res.json();
      if (data.success) {
        setHealth(data.data);
        setError("");
      } else {
        setError(data.error?.message || "Failed to load KB status");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError("");
    try {
      const res = await fetch("/api/rag/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncResult(data.data);
        // Refresh health stats
        fetchHealth();
      } else {
        setError(data.error?.message || "Sync failed");
      }
    } catch {
      setError("Network error during sync");
    } finally {
      setSyncing(false);
    }
  }

  function formatSyncTime(iso: string | null): string {
    if (!iso) return "Never";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      + ", "
      + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e8e6e6", borderRadius: "8px", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Database style={{ width: "18px", height: "18px", color: "#bc9b5d" }} />
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#000", margin: 0 }}>
            Knowledge Base
          </h2>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            background: syncing ? "#f7f7f7" : "#000",
            color: syncing ? "#888" : "#fff",
            border: syncing ? "1px solid #ccc" : "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: syncing ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw style={{
            width: "14px",
            height: "14px",
            animation: syncing ? "spin 1s linear infinite" : "none",
          }} />
          {syncing ? "Syncing..." : "Sync Knowledge Base"}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {loading ? (
        <p style={{ fontSize: "13px", color: "#888" }}>Loading KB status...</p>
      ) : error && !health ? (
        <p style={{ fontSize: "13px", color: "#b91c1c" }}>{error}</p>
      ) : health ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Stats row */}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ padding: "12px 16px", background: "#f7f7f7", borderRadius: "6px", minWidth: "120px" }}>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Documents</div>
              <div style={{ fontSize: "24px", fontWeight: 600, color: "#000" }}>{health.documentCount}</div>
            </div>
            <div style={{ padding: "12px 16px", background: "#f7f7f7", borderRadius: "6px", minWidth: "120px" }}>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Chunks</div>
              <div style={{ fontSize: "24px", fontWeight: 600, color: "#000" }}>{health.chunkCount}</div>
            </div>
            <div style={{ padding: "12px 16px", background: "#f7f7f7", borderRadius: "6px", minWidth: "120px" }}>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <span style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: health.healthy ? "#15803d" : "#b91c1c",
                  display: "inline-block",
                }} />
                <span style={{ fontSize: "14px", fontWeight: 500, color: health.healthy ? "#15803d" : "#b91c1c" }}>
                  {health.healthy ? "Healthy" : "Unhealthy"}
                </span>
              </div>
            </div>
            <div style={{ padding: "12px 16px", background: "#f7f7f7", borderRadius: "6px", minWidth: "160px" }}>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Last Sync</div>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "#414141", marginTop: "6px" }}>
                {formatSyncTime(health.lastSyncAt)}
              </div>
            </div>
          </div>

          <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
            Syncs changed files from Google Drive. Only new or modified documents are re-indexed.
          </p>

          {/* Sync result */}
          {syncResult && (
            <div style={{
              padding: "12px 16px",
              background: syncResult.errors.length > 0 ? "#fef2f2" : "#f0fdf4",
              borderRadius: "6px",
              fontSize: "13px",
            }}>
              <div style={{ fontWeight: 500, color: syncResult.errors.length > 0 ? "#b91c1c" : "#15803d", marginBottom: "4px" }}>
                Sync completed in {(syncResult.durationMs / 1000).toFixed(1)}s
              </div>
              <div style={{ color: "#414141", fontSize: "12px" }}>
                {syncResult.filesProcessed} file{syncResult.filesProcessed !== 1 ? "s" : ""} updated,{" "}
                {syncResult.chunksCreated} chunk{syncResult.chunksCreated !== 1 ? "s" : ""} created,{" "}
                {syncResult.filesDeleted} deleted
              </div>
              {syncResult.errors.length > 0 && (
                <div style={{ marginTop: "8px", color: "#b91c1c", fontSize: "12px" }}>
                  {syncResult.errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error from sync attempt */}
          {error && (
            <p style={{ fontSize: "13px", color: "#b91c1c", margin: 0 }}>{error}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Settings Page ────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div style={{ height: "100%", overflow: "auto", background: "#f7f7f7" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
        {/* Back link */}
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            color: "#414141",
            marginBottom: "20px",
            padding: 0,
          }}
        >
          <ArrowLeft style={{ width: "14px", height: "14px" }} />
          Back to Dashboard
        </button>

        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "#000", margin: "0 0 24px 0" }}>
          Settings
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <KnowledgeBaseSection />
          <ChangePasswordSection />
          <UserManagementSection />
          <ActivityLogSection />
        </div>
      </div>
    </div>
  );
}
