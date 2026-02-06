import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    console.info("[analytics]", payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[analytics-error]", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
