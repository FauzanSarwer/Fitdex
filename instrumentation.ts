import { ensureQrKeyRotationSchedulerStarted } from "@/lib/qr/key-rotation-scheduler";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  ensureQrKeyRotationSchedulerStarted();
}
