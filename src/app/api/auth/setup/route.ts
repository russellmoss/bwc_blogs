import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { z } from "zod";

const SetupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

// GET /api/auth/setup — Check if setup is needed (no users exist)
export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({
      success: true,
      data: { needsSetup: userCount === 0 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

// POST /api/auth/setup — Create first user (only works when zero users exist)
export async function POST(request: NextRequest) {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        { success: false, error: { code: "SETUP_COMPLETE", message: "Setup already complete. Users already exist." } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = SetupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { email, name, password } = parsed.data;

    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: passCheck.message } },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name,
        passwordHash,
        role: "admin",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
