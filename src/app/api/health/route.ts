import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'bwc-content-engine',
    timestamp: new Date().toISOString(),
    env: {
      hasDatabase: !!process.env.DATABASE_URL,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasOnyx: !!process.env.ONYX_API_KEY,
      hasCloudinary: !!process.env.CLOUDINARY_URL,
    },
  });
}
