import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(
      {
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? "unknown",
      },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  } catch {
    return jsonError("Health check failed", 500);
  }
}
