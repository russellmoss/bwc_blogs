import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getCloudinaryClient } from "@/lib/cloudinary/client";
import { env } from "@/lib/env";

/**
 * POST /api/photos/sign-upload
 * Returns a Cloudinary signature so the browser can upload directly
 * to Cloudinary without sending file data through Vercel (4.5MB limit).
 */
export async function POST() {
  try {
    await requireRole("admin", "editor");

    const timestamp = Math.round(Date.now() / 1000);
    const folder = "blog";
    const cld = getCloudinaryClient();

    const signature = cld.utils.api_sign_request(
      { timestamp, folder },
      env.CLOUDINARY_API_SECRET
    );

    return NextResponse.json({
      success: true,
      data: {
        signature,
        timestamp,
        folder,
        apiKey: env.CLOUDINARY_API_KEY,
        cloudName: env.CLOUDINARY_CLOUD_NAME,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
