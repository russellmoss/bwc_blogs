import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { logActivity } from "@/lib/activity/log";
import { z } from "zod";

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

// GET /api/users/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id, 10) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

// PATCH /api/users/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = UpdateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = { ...parsed.data };

    if (data.password) {
      data.passwordHash = await hashPassword(data.password as string);
      delete data.password;
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Log user management actions
    if (parsed.data.isActive === false) {
      logActivity({
        userId: parseInt(sessionUser.id, 10),
        userEmail: sessionUser.email,
        userName: sessionUser.name,
        action: "USER_DEACTIVATED",
        metadata: { targetEmail: user.email },
      });
    } else if (parsed.data.isActive === true) {
      logActivity({
        userId: parseInt(sessionUser.id, 10),
        userEmail: sessionUser.email,
        userName: sessionUser.name,
        action: "USER_REACTIVATED",
        metadata: { targetEmail: user.email },
      });
    }
    if (parsed.data.password) {
      logActivity({
        userId: parseInt(sessionUser.id, 10),
        userEmail: sessionUser.email,
        userName: sessionUser.name,
        action: "USER_PASSWORD_RESET",
        metadata: { targetEmail: user.email },
      });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] — Soft delete (deactivate)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuth();
    const { id } = await params;

    const user = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true },
    });

    logActivity({
      userId: parseInt(sessionUser.id, 10),
      userEmail: sessionUser.email,
      userName: sessionUser.name,
      action: "USER_DEACTIVATED",
      metadata: { targetEmail: user.email },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
