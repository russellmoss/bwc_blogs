import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

// DELETE /api/photos/[id]/assignments/[articleId] — Remove a photo-article assignment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  try {
    await requireRole("admin", "editor");
    const { id, articleId } = await params;
    const photoId = parseInt(id, 10);
    const artId = parseInt(articleId, 10);

    await prisma.articlePhoto.delete({
      where: {
        articleId_photoId: { articleId: artId, photoId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }
    // Prisma P2025 = record not found
    if (message.includes("P2025") || message.includes("Record to delete does not exist")) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Assignment not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
