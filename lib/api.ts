import { NextResponse } from "next/server";

export type JsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function safeJson<T = unknown>(req: Request): Promise<JsonResult<T>> {
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { ok: false, error: message };
  }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
