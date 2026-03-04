"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { User, Settings, LogOut, ChevronDown, Image, ExternalLink, PenTool, LayoutGrid, BookOpen } from "lucide-react";
import Link from "next/link";
import { ArticleSelector } from "./ArticleSelector";

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  if (!session?.user) return null;

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          background: "transparent",
          border: "1px solid #e8e6e6",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "13px",
          color: "#414141",
        }}
      >
        <User style={{ width: "14px", height: "14px" }} />
        <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {session.user.email}
        </span>
        <ChevronDown style={{ width: "12px", height: "12px", opacity: 0.5 }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "4px",
            background: "#ffffff",
            border: "1px solid #e8e6e6",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 100,
            minWidth: "200px",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f3f3" }}>
            <div style={{ fontSize: "13px", fontWeight: 500, color: "#000" }}>
              {session.user.name || "User"}
            </div>
            <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
              {session.user.email}
            </div>
          </div>

          <button
            onClick={() => {
              setOpen(false);
              router.push("/dashboard/settings");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "8px 14px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              color: "#414141",
              textAlign: "left",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f7f7f7"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Settings style={{ width: "14px", height: "14px" }} />
            Settings
          </button>

          <div style={{ borderTop: "1px solid #f3f3f3" }}>
            <button
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/login" });
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "8px 14px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                color: "#b91c1c",
                textAlign: "left",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <LogOut style={{ width: "14px", height: "14px" }} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isComposer = pathname === "/dashboard";
  const isContentMap = pathname === "/dashboard/content-map";
  const isPhotos = pathname === "/dashboard/photos";
  const isGetStarted = pathname === "/dashboard/get-started";

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#ffffff" }}>
      {/* Header */}
      <header
        style={{
          height: "56px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: "16px",
          borderBottom: "1px solid #e8e6e6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px", fontFamily: "serif", fontWeight: 600, color: "#bc9b5d" }}>
            BWC
          </span>
          <span style={{ fontSize: "14px", color: "#414141" }}>Content Engine</span>
        </div>
        <div style={{ borderLeft: "1px solid #e8e6e6", height: "24px", margin: "0 8px" }} />
        <ArticleSelector />

        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            fontSize: "13px",
            color: isComposer ? "#bc9b5d" : "#414141",
            fontWeight: isComposer ? 600 : 400,
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          <PenTool style={{ width: "14px", height: "14px" }} />
          Composer
        </Link>
        <Link
          href="/dashboard/content-map"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            fontSize: "13px",
            color: isContentMap ? "#bc9b5d" : "#414141",
            fontWeight: isContentMap ? 600 : 400,
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          <LayoutGrid style={{ width: "14px", height: "14px" }} />
          Content Map
        </Link>
        <Link
          href="/dashboard/photos"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            fontSize: "13px",
            color: isPhotos ? "#bc9b5d" : "#414141",
            fontWeight: isPhotos ? 600 : 400,
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          <Image style={{ width: "14px", height: "14px" }} />
          Photos
        </Link>
        <Link
          href="/dashboard/get-started"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 12px",
            fontSize: "13px",
            fontWeight: 500,
            textDecoration: "none",
            borderRadius: "100px",
            background: isGetStarted ? "#3b2f20" : "#bc9b5d",
            color: "#ffffff",
          }}
        >
          <BookOpen style={{ width: "14px", height: "14px" }} />
          Get Started
        </Link>

        {process.env.NEXT_PUBLIC_GOOGLE_DRIVE_PHOTOS_FOLDER_URL && (
          <a
            href={process.env.NEXT_PUBLIC_GOOGLE_DRIVE_PHOTOS_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              fontSize: "13px",
              color: "#bc9b5d",
              textDecoration: "none",
            }}
          >
            <ExternalLink style={{ width: "12px", height: "12px" }} />
            Source Drive
          </a>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User menu */}
        <UserMenu />
      </header>

      {/* Main content — fills remaining viewport */}
      <main style={{ flex: 1, overflow: "hidden" }}>{children}</main>
    </div>
  );
}
