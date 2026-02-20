type HookResult = {
  ok: boolean;
  reason?: string;
};

async function callHook(endpoint: string, payload: Record<string, unknown>): Promise<HookResult> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, reason: `Hook rejected (${response.status})` };
    }
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
    if (body.ok === false) return { ok: false, reason: body.reason ?? "Hook rejected" };
    return { ok: true };
  } catch {
    return { ok: true, reason: "Hook unavailable" };
  }
}

export async function validateGpsHook(params: {
  gymId: string;
  userId: string;
  latitude: number;
  longitude: number;
  type: string;
}): Promise<HookResult> {
  const endpoint = process.env.QR_GPS_VALIDATION_HOOK_URL;
  if (!endpoint) return { ok: true, reason: "GPS hook disabled" };
  return callHook(endpoint, params);
}

export async function validateDeviceBindingHook(params: {
  gymId: string;
  userId: string;
  type: string;
  deviceId?: string | null;
  tokenHash: string;
}): Promise<HookResult> {
  const endpoint = process.env.QR_DEVICE_BINDING_HOOK_URL;
  if (!endpoint) return { ok: true, reason: "Device-binding hook disabled" };
  return callHook(endpoint, params);
}
