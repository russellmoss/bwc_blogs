import { NextResponse } from "next/server";
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

const CreateStyleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  content: z.string().min(1).max(8000),
});

export async function GET() {
  try {
    await requireAuth();

    const styles = await prisma.writingStyle.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, data: styles });
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

export async function POST(request: Request) {
  try {
    const user = await requireRole("admin", "editor");

    const body = await request.json();
    const parsed = CreateStyleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() },
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    const slug = slugify(parsed.data.name);

    const style = await prisma.writingStyle.create({
      data: {
        name: parsed.data.name,
        slug,
        description: parsed.data.description,
        content: parsed.data.content,
        createdBy: user.email,
      },
    });

    return NextResponse.json({ success: true, data: style }, { status: 201 });
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
    // Handle unique constraint violations
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
