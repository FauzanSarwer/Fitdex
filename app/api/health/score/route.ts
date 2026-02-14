import { NextResponse } from "next/server";
import { jsonError, safeJson } from "@/lib/api";
import { parseAIHealthInput, runAIHealthScoreEngine } from "@/src/lib/ai-health-engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await safeJson<unknown>(request);
  if (!payload.ok) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = parseAIHealthInput(payload.data);
  if (!parsed.success) {
    return jsonError(parsed.error, 422, { issues: parsed.issues });
  }

  try {
    const output = runAIHealthScoreEngine(parsed.data);

    return NextResponse.json(
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        input: parsed.data,
        output,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return jsonError("Unable to generate health score", 500);
  }
}

export async function GET() {
  return NextResponse.json(
    {
      status: "ready",
      endpoint: "/api/health/score",
      method: "POST",
      description: "Deterministic personalized health scoring endpoint",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}

