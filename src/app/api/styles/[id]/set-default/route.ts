import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import type { ApiResponse } from "@/types/api";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin", "editor");
    const { id } = await params;
    const styleId = parseInt(id, 10);
    if (isNaN(styleId)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid style ID" } } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // Verify style exists
    const style = await prisma.writingStyle.findUnique({ where: { id: styleId } });
    if (!style) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Style not found" } } as ApiResponse<never>,
        { status: 404 }
      );
    }

    // Transaction: clear all defaults, then set the target
    await prisma.$transaction([
      prisma.writingStyle.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      }),
      prisma.writingStyle.update({
        where: { id: styleId },
        data: { isDefault: true },
      }),
    ]);

    const updated = await prisma.writingStyle.findUnique({ where: { id: styleId } });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } } as ApiResponse<never>,
        { status: 401 }
      );
    }
    if (message === "AUTH_FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin or editor role required" } } as ApiResponse<never>,
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } } as ApiResponse<never>,
      { status: 500 }
    );
  }
}
