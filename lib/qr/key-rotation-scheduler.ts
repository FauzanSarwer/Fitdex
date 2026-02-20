import { logObservabilityEvent, logServerError } from "@/lib/logger";
import { runQrSigningKeyRotationSweep } from "./qr-service";

const SCHEDULER_INTERVAL_MS = Number(
  process.env.QR_KEY_ROTATION_SCHEDULER_MS ?? 15 * 60 * 1000
);
const SCHEDULER_ENABLED = process.env.QR_KEY_ROTATION_SCHEDULER_ENABLED !== "false";
const GLOBAL_KEY = "__fitdexQrRotationSchedulerStarted__";

type SchedulerGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: boolean;
};

function getSystemActorId() {
  return process.env.QR_ROTATION_SYSTEM_ACTOR_ID ?? process.env.SYSTEM_ACTOR_ID ?? null;
}

export function ensureQrKeyRotationSchedulerStarted() {
  const state = globalThis as SchedulerGlobal;
  if (state[GLOBAL_KEY]) return;

  if (!SCHEDULER_ENABLED) {
    state[GLOBAL_KEY] = true;
    logObservabilityEvent({
      event: "qr.key_rotation.scheduler_skipped",
      level: "info",
      context: { reason: "disabled" },
    });
    return;
  }
  state[GLOBAL_KEY] = true;

  const actorId = getSystemActorId();
  if (!actorId) {
    logObservabilityEvent({
      event: "qr.key_rotation.scheduler_skipped",
      level: "warn",
      context: { reason: "missing_system_actor_id" },
    });
    return;
  }

  const runSweep = async () => {
    try {
      await runQrSigningKeyRotationSweep({ actorId, force: false });
    } catch (error) {
      logServerError(error as Error, { scope: "qr/key-rotation-scheduler" });
    }
  };

  // Kick off first run asynchronously.
  void runSweep();
  const interval = setInterval(() => {
    void runSweep();
  }, Math.max(60_000, SCHEDULER_INTERVAL_MS));
  if (typeof interval.unref === "function") {
    interval.unref();
  }

  logObservabilityEvent({
    event: "qr.key_rotation.scheduler_started",
    context: {
      actorId,
      intervalMs: Math.max(60_000, SCHEDULER_INTERVAL_MS),
    },
  });
}
