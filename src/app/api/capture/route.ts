import { NextRequest, NextResponse } from "next/server";

// POST /api/capture — Lead capture from Wix (stub for Phase 3+)
export async function POST(request: NextRequest) {
  // Stub: accept lead capture data but don't process yet
  const body = await request.json();

  return NextResponse.json({
    success: true,
    data: {
      received: true,
      message: "Lead capture endpoint is active. Full processing will be enabled in Phase 3.",
      timestamp: new Date().toISOString(),
    },
  });
}
