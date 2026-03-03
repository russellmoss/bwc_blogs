import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth/session";
import type { ApiResponse } from "@/types/api";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const UpdateStyleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  content: z.string().min(1).max(8000).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const styleId = parseInt(id, 10);
    if (isNaN(styleId)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid style ID" } } as ApiResponse<never>,
        { status: 400 }
      );
    }

    const style = await prisma.writingStyle.findUnique({ where: { id: styleId } });
    if (!style) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Style not found" } } as ApiResponse<never>,
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: style });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } } as ApiResponse<never>,
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } } as ApiResponse<never>,
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
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

    const body = await request.json();
    const parsed = UpdateStyleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() },
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
      updateData.slug = slugify(parsed.data.name);
    }
    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description;
    }
    if (parsed.data.content !== undefined) {
      updateData.content = parsed.data.content;
    }

    const style = await prisma.writingStyle.update({
      where: { id: styleId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: style });
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
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Style not found" } } as ApiResponse<never>,
        { status: 404 }
      );
    }
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "A style with that name already exists" } } as ApiResponse<never>,
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } } as ApiResponse<never>,
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    await prisma.writingStyle.delete({ where: { id: styleId } });

    return NextResponse.json({ success: true, data: { deleted: true } });
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
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      // Already deleted — idempotent
      return NextResponse.json({ success: true, data: { deleted: true } });
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } } as ApiResponse<never>,
      { status: 500 }
    );
  }
}
