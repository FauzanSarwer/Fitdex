"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAllQueueItems, putQueueItem, clearQueue } from "@/lib/idb-queue";
import { fetchJson } from "@/lib/client-fetch";
import type { SyncQueueItem, SyncResponse } from "@/types/fitness";

export type LocalWeightEntry = {
  id: string;
  valueKg: number;
  timestamp: number;
  createdAt: number;
  updatedAt: number;
};

export type LocalSession = {
  id: string;
  gymId: string | null;
  gymName: string;
  entryAt: number;
  exitAt: number;
  durationMinutes: number;
  calories: number;
  validForStreak: boolean;
  endedBy: "EXIT_QR" | "INACTIVITY_TIMEOUT" | "MANUAL";
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  createdAt: number;
  updatedAt: number;
};

export type LiveSession = {
  id: string;
  gymId: string | null;
  gymName: string;
  entryAt: number;
  lastActivityAt: number;
  deviceId?: string;
};

type PendingVerification = {
  token: string;
  verifiedAt: number;
  gymId: string;
  type: "ENTRY" | "EXIT";
};

type LocalQueueItem = SyncQueueItem & {
  entityId: string;
};

type PersistedFitnessState = {
  weights: LocalWeightEntry[];
  sessions: LocalSession[];
  liveSession: LiveSession | null;
  queue: LocalQueueItem[];
  lastSyncedAt: string | null;
  dismissedWeightPromptDate: string | null;
  lastWorkoutLoggedAt: number | null;
  deviceId: string;
  pendingVerification: PendingVerification | null;
};

type SyncStatus = {
  syncing: boolean;
  online: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
};

const FITNESS_STORAGE_VERSION = "v2";
const MAX_QUEUE_BATCH = 30;
const BASE_BACKOFF_MS = 1200;
const MAX_BACKOFF_MS = 60000;

const safeRandomUUID = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
};

const getBackoffMs = (retryCount: number) =>
  Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, retryCount));

function getStorageKey(identity: string | null) {
  return identity ? `fitdex:fitness-dashboard:${FITNESS_STORAGE_VERSION}:${identity}` : null;
}

function parsePersistedFitnessState(raw: string | null, deviceId: string): PersistedFitnessState {
  if (!raw) {
    return {
      weights: [],
      sessions: [],
      liveSession: null,
      queue: [],
      lastSyncedAt: null,
      dismissedWeightPromptDate: null,
      lastWorkoutLoggedAt: null,
      deviceId,
      pendingVerification: null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedFitnessState>;
    return {
      weights: Array.isArray(parsed.weights) ? (parsed.weights as LocalWeightEntry[]) : [],
      sessions: Array.isArray(parsed.sessions) ? (parsed.sessions as LocalSession[]) : [],
      liveSession: parsed.liveSession ?? null,
      queue: Array.isArray(parsed.queue) ? (parsed.queue as LocalQueueItem[]) : [],
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
      dismissedWeightPromptDate:
        typeof parsed.dismissedWeightPromptDate === "string" ? parsed.dismissedWeightPromptDate : null,
      lastWorkoutLoggedAt:
        typeof parsed.lastWorkoutLoggedAt === "number" ? parsed.lastWorkoutLoggedAt : null,
      deviceId: typeof parsed.deviceId === "string" ? parsed.deviceId : deviceId,
      pendingVerification: parsed.pendingVerification ?? null,
    };
  } catch {
    return {
      weights: [],
      sessions: [],
      liveSession: null,
      queue: [],
      lastSyncedAt: null,
      dismissedWeightPromptDate: null,
      lastWorkoutLoggedAt: null,
      deviceId,
      pendingVerification: null,
    };
  }
}

function shouldAttempt(item: LocalQueueItem, now: number): boolean {
  if (!item.lastAttemptAt) return true;
  const last = new Date(item.lastAttemptAt).getTime();
  return now - last >= getBackoffMs(item.retryCount);
}

export function useFitnessSync(identity: string | null) {
    // Sync health state
    const [syncHealth, setSyncHealth] = useState({
      lastSuccessfulSyncAt: null as string | null,
      consecutiveFailures: 0,
      isStale: false,
      dataAtRisk: false,
      showSyncWarning: false,
      showDataAtRiskWarning: false,
    });
  const storageKey = useMemo(() => getStorageKey(identity), [identity]);
  const deviceIdRef = useRef<string>(safeRandomUUID());
  const [state, setState] = useState<PersistedFitnessState>(() =>
    parsePersistedFitnessState(null, deviceIdRef.current)
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    syncing: false,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    lastError: null,
    lastSyncAt: null,
  });
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!storageKey) return;
    const raw = window.localStorage.getItem(storageKey);
    const restored = parsePersistedFitnessState(raw, deviceIdRef.current);
    // Hydrate queue from IndexedDB, fallback to localStorage if needed
    (async () => {
      const idbQueue = await getAllQueueItems();
      setState({
        ...restored,
        queue: (idbQueue && idbQueue.length > 0) ? idbQueue : restored.queue,
      });
    })();
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
    // Persist queue to IndexedDB
    (async () => {
      await clearQueue();
      for (const item of state.queue) {
        await putQueueItem(item);
      }
    })();
  }, [state.queue, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      setSyncStatus((prev) => ({ ...prev, online: true }));
      void syncNow();
    };
    const handleOffline = () => setSyncStatus((prev) => ({ ...prev, online: false }));
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  });

  const enqueueMutation = useCallback((item: Omit<LocalQueueItem, "createdAt" | "retryCount" | "lastAttemptAt">) => {
    setState((prev) => {
      const existingIndex = prev.queue.findIndex(
        (queueItem) =>
          queueItem.entityId === item.entityId &&
          queueItem.entityType === item.entityType &&
          queueItem.operation === item.operation
      );
      const nextItem: LocalQueueItem = {
        ...item,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        lastAttemptAt: null,
      };
      if (existingIndex >= 0) {
        const nextQueue = [...prev.queue];
        nextQueue[existingIndex] = { ...nextQueue[existingIndex], ...nextItem };
        return { ...prev, queue: nextQueue };
      }
      return { ...prev, queue: [nextItem, ...prev.queue] };
    });
  }, []);

  const applyServerChanges = useCallback((changes: SyncResponse["changes"]) => {
    setState((prev) => {
      const sessionMap = new Map(prev.sessions.map((session) => [session.id, session]));
      let serverActive: LocalSession | null = null;
      for (const session of changes.sessions) {
        // Normalize ISO string to number at hydration
        const updatedAt = Date.parse(session.updatedAt);
        const existing = sessionMap.get(session.id);
        if (existing && existing.updatedAt >= updatedAt) continue;
        const localSession: LocalSession = {
          id: session.id,
          gymId: session.gymId ?? null,
          gymName: (session as any).gymName ?? existing?.gymName ?? "Fitdex Gym",
          entryAt: Date.parse(session.entryAt),
          exitAt: session.exitAt ? Date.parse(session.exitAt) : Date.parse(session.entryAt),
          durationMinutes: session.durationMinutes ?? 0,
          calories: session.calories ?? 0,
          validForStreak: session.validForStreak,
          endedBy: (session.endedBy ?? "EXIT_QR") as LocalSession["endedBy"],
          verificationStatus: (session.verificationStatus ?? "VERIFIED") as LocalSession["verificationStatus"],
          createdAt: Date.parse(session.createdAt),
          updatedAt,
        };
        sessionMap.set(session.id, localSession);
        if (!session.exitAt) {
          serverActive = localSession;
        }
      }

      const weightMap = new Map(prev.weights.map((weight) => [weight.id, weight]));
      for (const weight of changes.weights) {
        // Normalize ISO string to number at hydration
        const updatedAt = Date.parse(weight.updatedAt);
        const existing = weightMap.get(weight.id);
        if (existing && existing.updatedAt >= updatedAt) continue;
        weightMap.set(weight.id, {
          id: weight.id,
          valueKg: weight.valueKg,
          timestamp: Date.parse(weight.loggedAt),
          createdAt: Date.parse(weight.createdAt),
          updatedAt,
        });
      }

      // Hydrate liveSession from server if newer or missing
      let liveSession = prev.liveSession;
      if (serverActive) {
        if (!liveSession || serverActive.updatedAt > liveSession.updatedAt) {
          liveSession = serverActive;
        }
      } else if (liveSession && !sessionMap.has(liveSession.id)) {
        liveSession = null;
      }

      return {
        ...prev,
        sessions: Array.from(sessionMap.values()).sort((a, b) => b.exitAt - a.exitAt).slice(0, 200),
        weights: Array.from(weightMap.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 200),
        liveSession,
      };
    });
  }, []);

  const syncNow = useCallback(async () => {
    if (!identity || syncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    syncingRef.current = true;
    setSyncStatus((prev) => ({ ...prev, syncing: true, lastError: null }));

    const now = Date.now();
    const pendingQueue = state.queue.filter((item) => shouldAttempt(item, now));
    const mutations = pendingQueue.slice(0, MAX_QUEUE_BATCH).map((item) => ({
      id: item.id,
      entityType: item.entityType,
      operation: item.operation,
      payload: item.payload,
      createdAt: item.createdAt,
      retryCount: item.retryCount,
      lastAttemptAt: item.lastAttemptAt,
    }));

    try {
      const result = await fetchJson<SyncResponse>("/api/fitness/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since: state.lastSyncedAt ?? undefined, mutations }),
        retries: 0,
      });

      if (!result.ok || !result.data?.ok) {
        const errorMessage = result.error ?? "Sync failed";
        setSyncStatus((prev) => ({ ...prev, lastError: errorMessage }));
        setSyncHealth((prev) => {
          const fails = prev.consecutiveFailures + 1;
          const isStale = !!(prev.lastSuccessfulSyncAt && Date.now() - new Date(prev.lastSuccessfulSyncAt).getTime() > 60000);
          const dataAtRisk = (state.queue && state.queue.length > 0 && prev.lastSuccessfulSyncAt && Date.now() - new Date(prev.lastSuccessfulSyncAt).getTime() > 120000);
          return {
            ...prev,
            consecutiveFailures: fails,
            isStale,
            dataAtRisk,
            showSyncWarning: isStale,
            showDataAtRiskWarning: dataAtRisk,
          };
        });
        setState((prev) => {
          const attemptedIds = new Set(pendingQueue.map((item) => item.id));
          const updatedQueue = prev.queue.map((item) =>
            attemptedIds.has(item.id)
              ? {
                  ...item,
                  retryCount: item.retryCount + 1,
                  lastAttemptAt: new Date().toISOString(),
                }
              : item
          );
          return { ...prev, queue: updatedQueue };
        });
      } else {
        const response = result.data;
        applyServerChanges(response.changes);

        const successIds = new Set(
          response.results.filter((r) => r.status === "applied" || r.status === "skipped").map((r) => r.id)
        );
        const failedIds = new Set(
          response.results.filter((r) => r.status === "failed").map((r) => r.id)
        );

        setState((prev) => {
          const nextQueue = prev.queue
            .filter((item) => !successIds.has(item.id))
            .map((item) =>
              failedIds.has(item.id)
                ? { ...item, retryCount: item.retryCount + 1, lastAttemptAt: new Date().toISOString() }
                : item
            );
          // Use serverTime as the new sync cursor, not client clock
          return {
            ...prev,
            queue: nextQueue,
            lastSyncedAt: response.serverTime,
          };
        });

        setSyncStatus((prev) => ({ ...prev, lastSyncAt: response.serverTime }));
        setSyncHealth((prev) => {
          return {
            ...prev,
            lastSuccessfulSyncAt: response.serverTime,
            consecutiveFailures: 0,
            isStale: false,
            dataAtRisk: false,
            showSyncWarning: false,
            showDataAtRiskWarning: false,
          };
        });
      }
    } catch (error) {
      setSyncStatus((prev) => ({
        ...prev,
        lastError: error instanceof Error ? error.message : "Sync failed",
      }));
    } finally {
      syncingRef.current = false;
      setSyncStatus((prev) => ({ ...prev, syncing: false }));
    }
  }, [identity, state.queue, state.lastSyncedAt, applyServerChanges]);
  // ENTRY QR failure handler: show error and force sync
  const handleEntryFailure = useCallback((error: string) => {
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("fitdex:entry-failure", { detail: error }));
    }
    void syncNow();
  }, [syncNow]);
  // Warn on logout or beforeunload if queue is non-empty
  useEffect(() => {
    const warnIfQueue = (e: BeforeUnloadEvent) => {
      if (state.queue && state.queue.length > 0) {
        e.preventDefault();
        e.returnValue = "You have unsynced workouts. Leaving may cause data loss.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", warnIfQueue);
    return () => window.removeEventListener("beforeunload", warnIfQueue);
  }, [state.queue]);

  useEffect(() => {
    if (!identity) return;
    const interval = window.setInterval(() => {
      void syncNow();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [identity, syncNow]);

  const updateWeights = useCallback((updater: (prev: LocalWeightEntry[]) => LocalWeightEntry[]) => {
    setState((prev) => ({ ...prev, weights: updater(prev.weights) }));
  }, []);

  const updateSessions = useCallback((updater: (prev: LocalSession[]) => LocalSession[]) => {
    setState((prev) => ({ ...prev, sessions: updater(prev.sessions) }));
  }, []);

  const updateLiveSession = useCallback((updater: (prev: LiveSession | null) => LiveSession | null) => {
    setState((prev) => ({ ...prev, liveSession: updater(prev.liveSession) }));
  }, []);

  const setDismissedWeightPromptDate = useCallback((value: string | null) => {
    setState((prev) => ({ ...prev, dismissedWeightPromptDate: value }));
  }, []);

  const setLastWorkoutLoggedAt = useCallback((value: number | null) => {
    setState((prev) => ({ ...prev, lastWorkoutLoggedAt: value }));
  }, []);

  const setPendingVerification = useCallback((value: PendingVerification | null) => {
    setState((prev) => ({ ...prev, pendingVerification: value }));
  }, []);

  // Expose sync debug info in window for debugging
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__FITDEX_SYNC_DEBUG__ = {
        syncHealth,
        queueSize: state.queue?.length ?? 0,
        lastSyncAt: syncStatus.lastSyncAt,
      };
    }
  }, [syncHealth, state.queue, syncStatus.lastSyncAt]);

  return {
    state,
    syncStatus,
    enqueueMutation,
    syncNow,
    updateWeights,
    updateSessions,
    updateLiveSession,
    setDismissedWeightPromptDate,
    setLastWorkoutLoggedAt,
    setPendingVerification,
    deviceId: state.deviceId,
    handleEntryFailure,
    syncHealth,
  };
}
