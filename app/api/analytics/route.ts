import { NextResponse } from "next/server";
import { jsonError, safeJson } from "@/lib/api";
import { logServerError } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = await safeJson<Record<string, unknown>>(request);
    if (!parsed.ok) {
      return jsonError("Invalid JSON body", 400);
    }
    const payload = parsed.data;

    console.info("[analytics]", payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError(error as Error, { route: "/api/analytics" });
    return jsonError("Failed to record analytics", 400);
  }
}
