import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { downloadFromDrive } from "@/lib/cloudinary/drive-downloader";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";

// POST /api/photos/upload — Upload a photo from Drive to Cloudinary
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "editor");
    const body = await request.json();
    const photoId = body.photoId;

    if (!photoId || typeof photoId !== "number") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "photoId (number) is required" } },
        { status: 400 }
      );
    }

    // 1. Look up the photo
    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Photo not found" } },
        { status: 404 }
      );
    }

    if (photo.uploadedToCdn) {
      return NextResponse.json({ success: true, data: photo });
    }

    if (!photo.driveFileId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Photo has no Drive file ID — cannot download from Drive" } },
        { status: 400 }
      );
    }

    // 2. Download from Drive
    const buffer = await downloadFromDrive(photo.driveFileId);

    // 3. Build public ID: blog/{category}/{filename-without-extension}
    const baseName = photo.filename.replace(/\.[^.]+$/, "");
    const category = photo.category || "uncategorized";
    const publicId = `blog/${category}/${baseName}`;

    // 4. Upload to Cloudinary
    const result = await uploadToCloudinary(buffer, { publicId });

    // 5. Update database
    const updated = await prisma.photo.update({
      where: { id: photoId },
      data: {
        cloudinaryPublicId: result.publicId,
        cloudinaryUrl: result.secureUrl,
        widthPx: result.width,
        heightPx: result.height,
        uploadedToCdn: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    if (message.startsWith("CLOUDINARY_ERROR")) {
      return NextResponse.json(
        { success: false, error: { code: "CLOUDINARY_ERROR", message } },
        { status: 502 }
      );
    }
    if (message.startsWith("DRIVE_DOWNLOAD_FAILED")) {
      return NextResponse.json(
        { success: false, error: { code: "CLOUDINARY_ERROR", message } },
        { status: 502 }
      );
    }
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
