"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, UserPlus, Eye, EyeOff, KeyRound } from "lucide-react";

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
          <ChangePasswordSection />
          <UserManagementSection />
        </div>
      </div>
    </div>
  );
}
