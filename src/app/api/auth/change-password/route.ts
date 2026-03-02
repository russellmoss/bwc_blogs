import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { hashPassword, verifyPassword, validatePassword } from "@/lib/auth/password";
import { z } from "zod";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// POST /api/auth/change-password — Authenticated user changes own password
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireAuth();

    const body = await request.json();
    const parsed = ChangePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const passCheck = validatePassword(newPassword);
    if (!passCheck.valid) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: passCheck.message } },
        { status: 400 }
      );
    }

    // Fetch user from DB to verify current password
    const user = await prisma.user.findUnique({
      where: { id: parseInt(sessionUser.id, 10) },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_PASSWORD", message: "Current password is incorrect" } },
        { status: 401 }
      );
    }

    // Update password
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true, data: { message: "Password updated successfully" } });
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
