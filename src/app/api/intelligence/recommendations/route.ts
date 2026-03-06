import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  try {
    await requireRole("admin", "editor", "viewer");

    const recommendations = await prisma.contentRecommendation.findMany({
      where: { status: "pending" },
      include: {
        contentMap: {
          select: {
            id: true, title: true, slug: true,
            hubName: true, articleType: true, status: true,
          },
        },
      },
      orderBy: [
        { priority: "asc" },
        { generatedAt: "desc" },
      ],
    });

    return NextResponse.json({ success: true, data: recommendations });
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
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

const PatchSchema = z.object({
  id: z.number(),
  action: z.enum(["approve", "dismiss"]),
});

export async function PATCH(request: NextRequest) {
  try {
    await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { id, action } = parsed.data;
    const status = action === "approve" ? "approved" : "dismissed";

    const updated = await prisma.contentRecommendation.update({
      where: { id },
      data: { status, resolvedAt: new Date() },
      include: {
        contentMap: {
          select: {
            id: true, title: true, slug: true,
            hubName: true, articleType: true, status: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
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
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
