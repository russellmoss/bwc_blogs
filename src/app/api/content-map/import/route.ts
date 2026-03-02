import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { parseCSV, mapCSVRow, importToDatabase } from "@/lib/content-map";

// POST /api/content-map/import — Import content map from CSV text
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin");

    const body = await request.json();

    if (!body.csv || typeof body.csv !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body must include a 'csv' field with CSV text",
          },
        },
        { status: 400 }
      );
    }

    // Parse CSV
    const rawRows = parseCSV(body.csv);

    if (rawRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "CSV contains no data rows",
          },
        },
        { status: 400 }
      );
    }

    // Map rows
    const mappedRows = rawRows.map(mapCSVRow);

    // Import to database (hubs first, then spokes)
    const result = await importToDatabase(mappedRows, prisma);

    return NextResponse.json(
      {
        success: true,
        data: {
          imported: result.hubs + result.spokes,
          hubs: result.hubs,
          spokes: result.spokes,
        },
      },
      { status: 201 }
    );
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
