"use client";

declare global {
  interface Window {
    __FITDEX_SYNC_DEBUG__?: unknown;
  }
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearQueue, getAllQueueItems, putQueueItem } from "@/lib/idb-queue";
import { fetchJson } from "@/lib/client-fetch";
import type { Session, SyncMutationResult, SyncQueueItem, SyncResponse, WeightLog } from "@/types/fitness";

export type LocalWeightEntry = {
  id: string;
  valueKg: number;
  timestamp: number;
  createdAt: number;
  updatedAt: number;
  serverVersion: number;
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
  serverVersion: number;
};

export type LiveSession = {
  id: string;
  gymId: string | null;
  gymName: string;
  entryAt: number;
  lastActivityAt: number;
  updatedAt: number;
  serverVersion: number;
  deviceId?: string;
};

type PendingVerification = {
  sessionId: string;
  gymId: string;
  type: "ENTRY" | "EXIT";
  queuedAt: number;
  token?: string | null;
  verifiedAt?: number | null;
};

type LocalQueueItem = SyncQueueItem & {
  entityId: string;
  nextAttemptAt: string | null;
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
const MAX_BACKOFF_MS = 90_000;
const SYNC_TICK_MS = 10_000;

const safeRandomUUID = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const toIso = (timestamp: number) => new Date(timestamp).toISOString();

const getBackoffMs = (retryCount: number) => {
  const base = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, retryCount));
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(MAX_BACKOFF_MS, base + jitter);
};

const getStorageKey = (identity: string | null) =>
  identity ? `fitdex:fitness-dashboard:${FITNESS_STORAGE_VERSION}:${identity}` : null;

function normalizeQueueItem(item: unknown): LocalQueueItem | null {
  if (!item || typeof item !== "object") return null;
  const candidate = item as Partial<LocalQueueItem>;
  const id = isUuid(candidate.id) ? candidate.id : safeRandomUUID();
  const entityId = isUuid(candidate.entityId) ? candidate.entityId : safeRandomUUID();
  if (candidate.entityType !== "session" && candidate.entityType !== "weight") return null;
  if (candidate.operation !== "create" && candidate.operation !== "update") return null;

  return {
    id,
    entityId,
    entityType: candidate.entityType,
    operation: candidate.operation,
    payload: (candidate.payload ?? {}) as LocalQueueItem["payload"],
    createdAt:
      typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
    retryCount: typeof candidate.retryCount === "number" ? candidate.retryCount : 0,
    lastAttemptAt:
      typeof candidate.lastAttemptAt === "string" || candidate.lastAttemptAt === null
        ? candidate.lastAttemptAt
        : null,
    nextAttemptAt:
      typeof candidate.nextAttemptAt === "string" || candidate.nextAttemptAt === null
        ? candidate.nextAttemptAt
        : null,
  };
}

function toLocalWeight(weight: WeightLog): LocalWeightEntry {
  return {
    id: weight.id,
    valueKg: weight.valueKg,
    timestamp: Date.parse(weight.loggedAt),
    createdAt: Date.parse(weight.createdAt),
    updatedAt: Date.parse(weight.updatedAt),
    serverVersion: weight.serverVersion,
  };
}

function toLocalSession(session: Session): LocalSession {
  const entryAt = Date.parse(session.entryAt);
  const exitAt = session.exitAt ? Date.parse(session.exitAt) : entryAt;
  return {
    id: session.id,
    gymId: session.gymId ?? null,
    gymName: session.gymName ?? "Fitdex Gym",
    entryAt,
    exitAt,
    durationMinutes: session.durationMinutes ?? 0,
    calories: session.calories ?? 0,
    validForStreak: session.validForStreak,
    endedBy: (session.endedBy ?? "EXIT_QR") as LocalSession["endedBy"],
    verificationStatus: (session.verificationStatus ?? "VERIFIED") as LocalSession["verificationStatus"],
    createdAt: Date.parse(session.createdAt),
    updatedAt: Date.parse(session.updatedAt),
    serverVersion: session.serverVersion,
  };
}

function toLiveSession(session: LocalSession): LiveSession {
  return {
    id: session.id,
    gymId: session.gymId,
    gymName: session.gymName,
    entryAt: session.entryAt,
    lastActivityAt: session.exitAt > session.entryAt ? session.exitAt : session.updatedAt,
    updatedAt: session.updatedAt,
    serverVersion: session.serverVersion,
  };
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
    const migratedWeights = Array.isArray(parsed.weights)
      ? parsed.weights
          .map((weight) => ({
            id: isUuid(weight.id) ? weight.id : safeRandomUUID(),
            valueKg: typeof weight.valueKg === "number" ? weight.valueKg : 0,
            timestamp: typeof weight.timestamp === "number" ? weight.timestamp : Date.now(),
            createdAt: typeof weight.createdAt === "number" ? weight.createdAt : Date.now(),
            updatedAt: typeof weight.updatedAt === "number" ? weight.updatedAt : Date.now(),
            serverVersion:
              typeof weight.serverVersion === "number" ? weight.serverVersion : 0,
          }))
          .slice(0, 300)
      : [];

    const migratedSessions = Array.isArray(parsed.sessions)
      ? parsed.sessions
          .map((session) => ({
            id: isUuid(session.id) ? session.id : safeRandomUUID(),
            gymId: session.gymId ?? null,
            gymName: typeof session.gymName === "string" ? session.gymName : "Fitdex Gym",
            entryAt: typeof session.entryAt === "number" ? session.entryAt : Date.now(),
            exitAt:
              typeof session.exitAt === "number"
                ? session.exitAt
                : typeof session.entryAt === "number"
                  ? session.entryAt
                  : Date.now(),
            durationMinutes:
              typeof session.durationMinutes === "number" ? session.durationMinutes : 0,
            calories: typeof session.calories === "number" ? session.calories : 0,
            validForStreak: Boolean(session.validForStreak),
            endedBy:
              session.endedBy === "EXIT_QR" ||
              session.endedBy === "INACTIVITY_TIMEOUT" ||
              session.endedBy === "MANUAL"
                ? session.endedBy
                : "EXIT_QR",
            verificationStatus:
              session.verificationStatus === "PENDING" ||
              session.verificationStatus === "VERIFIED" ||
              session.verificationStatus === "REJECTED"
                ? session.verificationStatus
                : "PENDING",
            createdAt: typeof session.createdAt === "number" ? session.createdAt : Date.now(),
            updatedAt: typeof session.updatedAt === "number" ? session.updatedAt : Date.now(),
            serverVersion:
              typeof session.serverVersion === "number" ? session.serverVersion : 0,
          }))
          .slice(0, 300)
      : [];

    const migratedQueue = Array.isArray(parsed.queue)
      ? (parsed.queue.map((item) => normalizeQueueItem(item)).filter(Boolean) as LocalQueueItem[])
      : [];

    const migratedLiveSession =
      parsed.liveSession &&
      typeof parsed.liveSession === "object" &&
      isUuid(parsed.liveSession.id)
        ? {
            id: parsed.liveSession.id,
            gymId: parsed.liveSession.gymId ?? null,
            gymName:
              typeof parsed.liveSession.gymName === "string"
                ? parsed.liveSession.gymName
                : "Fitdex Gym",
            entryAt:
              typeof parsed.liveSession.entryAt === "number"
                ? parsed.liveSession.entryAt
                : Date.now(),
            lastActivityAt:
              typeof parsed.liveSession.lastActivityAt === "number"
                ? parsed.liveSession.lastActivityAt
                : Date.now(),
            updatedAt:
              typeof parsed.liveSession.updatedAt === "number"
                ? parsed.liveSession.updatedAt
                : Date.now(),
            serverVersion:
              typeof parsed.liveSession.serverVersion === "number"
                ? parsed.liveSession.serverVersion
                : 0,
            deviceId:
              typeof parsed.liveSession.deviceId === "string"
                ? parsed.liveSession.deviceId
                : undefined,
          }
        : null;

    const pendingVerification =
      parsed.pendingVerification &&
      typeof parsed.pendingVerification === "object" &&
      isUuid((parsed.pendingVerification as PendingVerification).sessionId)
        ? (parsed.pendingVerification as PendingVerification)
        : null;

    return {
      weights: migratedWeights,
      sessions: migratedSessions,
      liveSession: migratedLiveSession,
      queue: migratedQueue,
      lastSyncedAt:
        typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
      dismissedWeightPromptDate:
        typeof parsed.dismissedWeightPromptDate === "string"
          ? parsed.dismissedWeightPromptDate
          : null,
      lastWorkoutLoggedAt:
        typeof parsed.lastWorkoutLoggedAt === "number"
          ? parsed.lastWorkoutLoggedAt
          : null,
      deviceId: isUuid(parsed.deviceId) ? parsed.deviceId : deviceId,
      pendingVerification,
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
  if (item.nextAttemptAt) {
    return now >= Date.parse(item.nextAttemptAt);
  }
  if (!item.lastAttemptAt) return true;
  const last = Date.parse(item.lastAttemptAt);
  return now - last >= getBackoffMs(item.retryCount);
}

function bumpRetry(item: LocalQueueItem): LocalQueueItem {
  const retryCount = item.retryCount + 1;
  const nowIso = new Date().toISOString();
  return {
    ...item,
    retryCount,
    lastAttemptAt: nowIso,
    nextAttemptAt: new Date(Date.now() + getBackoffMs(retryCount)).toISOString(),
  };
}

function buildSessionMutationPayload(
  session: LocalSession,
  override?: Partial<LocalSession>
) {
  const merged = { ...session, ...override };
  return {
    id: merged.id,
    gymId: merged.gymId,
    entryAt: toIso(merged.entryAt),
    exitAt: merged.exitAt > merged.entryAt ? toIso(merged.exitAt) : null,
    durationMinutes: merged.durationMinutes,
    calories: merged.calories,
    validForStreak: merged.validForStreak,
    endedBy: merged.endedBy,
    verificationStatus: merged.verificationStatus,
    baseServerVersion: session.serverVersion,
    updatedAt: toIso(merged.updatedAt),
  };
}

export function useFitnessSync(identity: string | null) {
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
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    syncing: false,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    lastError: null,
    lastSyncAt: null,
  });
  const syncingRef = useRef(false);
  const inFlightMutationIdsRef = useRef(new Set<string>());
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!storageKey) {
      setHydrated(true);
      return;
    }
    const raw = window.localStorage.getItem(storageKey);
    const restored = parsePersistedFitnessState(raw, deviceIdRef.current);

    void (async () => {
      try {
        const idbQueue = await getAllQueueItems();
        const normalizedIdb = idbQueue
          .map((item) => normalizeQueueItem(item))
          .filter(Boolean) as LocalQueueItem[];
        const mergedQueue = normalizedIdb.length > 0 ? normalizedIdb : restored.queue;
        setState({ ...restored, queue: mergedQueue });
      } catch {
        setState(restored);
      }
      setHydrated(true);
    })();
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  useEffect(() => {
    void (async () => {
      try {
        await clearQueue();
        for (const item of state.queue) {
          await putQueueItem(item);
        }
      } catch {
        // Ignore IndexedDB persistence failures and keep localStorage as fallback.
      }
    })();
  }, [state.queue]);

  const enqueueMutation = useCallback(
    (item: Omit<LocalQueueItem, "createdAt" | "retryCount" | "lastAttemptAt" | "nextAttemptAt">) => {
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
          nextAttemptAt: null,
        };
        if (existingIndex >= 0) {
          const nextQueue = [...prev.queue];
          nextQueue[existingIndex] = { ...nextQueue[existingIndex], ...nextItem };
          return { ...prev, queue: nextQueue };
        }
        return { ...prev, queue: [...prev.queue, nextItem] };
      });
    },
    []
  );

  const applyCanonicalResult = useCallback((result: SyncMutationResult) => {
    if (result.canonicalSession) {
      const canonical = toLocalSession(result.canonicalSession);
      setState((prev) => {
        const sessionMap = new Map(prev.sessions.map((session) => [session.id, session]));
        const existing = sessionMap.get(canonical.id);
        if (!existing || canonical.serverVersion >= existing.serverVersion) {
          sessionMap.set(canonical.id, canonical);
        }
        return {
          ...prev,
          sessions: Array.from(sessionMap.values())
            .sort((a, b) => b.exitAt - a.exitAt)
            .slice(0, 300),
        };
      });
    }

    if (result.canonicalWeight) {
      const canonical = toLocalWeight(result.canonicalWeight);
      setState((prev) => {
        const weightMap = new Map(prev.weights.map((weight) => [weight.id, weight]));
        const existing = weightMap.get(canonical.id);
        if (!existing || canonical.serverVersion >= existing.serverVersion) {
          weightMap.set(canonical.id, canonical);
        }
        return {
          ...prev,
          weights: Array.from(weightMap.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 300),
        };
      });
    }
  }, []);

  const applyServerChanges = useCallback(
    (changes: SyncResponse["changes"], activeSession: SyncResponse["activeSession"]) => {
      setState((prev) => {
        const sessionMap = new Map(prev.sessions.map((session) => [session.id, session]));
        for (const session of changes.sessions) {
          const localSession = toLocalSession(session);
          const existing = sessionMap.get(localSession.id);
          if (!existing || localSession.serverVersion > existing.serverVersion) {
            sessionMap.set(localSession.id, localSession);
          }
        }

        const weightMap = new Map(prev.weights.map((weight) => [weight.id, weight]));
        for (const weight of changes.weights) {
          const localWeight = toLocalWeight(weight);
          const existing = weightMap.get(localWeight.id);
          if (!existing || localWeight.serverVersion > existing.serverVersion) {
            weightMap.set(localWeight.id, localWeight);
          }
        }

        let liveSession = prev.liveSession;
        if (activeSession) {
          const serverActive = toLocalSession(activeSession);
          const serverLive = toLiveSession(serverActive);
          if (
            !liveSession ||
            serverLive.serverVersion > liveSession.serverVersion ||
            serverLive.updatedAt >= liveSession.updatedAt
          ) {
            liveSession = {
              ...serverLive,
              deviceId: undefined,
            };
          }
        } else if (liveSession) {
          const hasOptimisticPending = prev.queue.some(
            (item) => item.entityType === "session" && item.entityId === liveSession!.id
          );
          if (!hasOptimisticPending) {
            liveSession = null;
          }
        }

        return {
          ...prev,
          sessions: Array.from(sessionMap.values())
            .sort((a, b) => b.exitAt - a.exitAt)
            .slice(0, 300),
          weights: Array.from(weightMap.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 300),
          liveSession,
        };
      });
    },
    []
  );

  const syncNow = useCallback(
    async (options?: { force?: boolean }) => {
      if (!identity || syncingRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      const snapshot = stateRef.current;
      const now = Date.now();
      const pendingQueue = snapshot.queue
        .filter((item) => !inFlightMutationIdsRef.current.has(item.id) && shouldAttempt(item, now))
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

      const shouldHydrate = Boolean(options?.force) || pendingQueue.length > 0 || !snapshot.lastSyncedAt;
      if (!shouldHydrate) return;

      const selected = pendingQueue.slice(0, MAX_QUEUE_BATCH);
      const mutations = selected.map((item) => ({
        id: item.id,
        entityType: item.entityType,
        operation: item.operation,
        payload: item.payload,
        createdAt: item.createdAt,
        retryCount: item.retryCount,
        lastAttemptAt: item.lastAttemptAt,
        nextAttemptAt: item.nextAttemptAt,
      }));

      selected.forEach((item) => inFlightMutationIdsRef.current.add(item.id));
      syncingRef.current = true;
      setSyncStatus((prev) => ({ ...prev, syncing: true, lastError: null }));

      try {
        const result = await fetchJson<SyncResponse>("/api/fitness/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            since: snapshot.lastSyncedAt ?? undefined,
            mutations,
          }),
          retries: 0,
        });

        if (!result.ok || !result.data?.ok) {
          const errorMessage = result.error ?? "Sync failed";
          setSyncStatus((prev) => ({ ...prev, lastError: errorMessage }));
          setSyncHealth((prev) => {
            const failures = prev.consecutiveFailures + 1;
            const isStale = Boolean(
              prev.lastSuccessfulSyncAt &&
                Date.now() - new Date(prev.lastSuccessfulSyncAt).getTime() > 60_000
            );
            const dataAtRisk = Boolean(
              stateRef.current.queue.length > 0 &&
                prev.lastSuccessfulSyncAt &&
                Date.now() - new Date(prev.lastSuccessfulSyncAt).getTime() > 120_000
            );
            return {
              ...prev,
              consecutiveFailures: failures,
              isStale,
              dataAtRisk,
              showSyncWarning: isStale,
              showDataAtRiskWarning: dataAtRisk,
            };
          });
          setState((prev) => {
            const attempted = new Set(selected.map((item) => item.id));
            return {
              ...prev,
              queue: prev.queue.map((item) => (attempted.has(item.id) ? bumpRetry(item) : item)),
            };
          });
          return;
        }

        const response = result.data;
        for (const mutationResult of response.results) {
          applyCanonicalResult(mutationResult);
        }
        applyServerChanges(response.changes, response.activeSession);

        const successIds = new Set(
          response.results
            .filter((entry) => entry.status === "applied" || entry.status === "skipped" || entry.status === "conflict")
            .map((entry) => entry.id)
        );
        const failedIds = new Set(
          response.results.filter((entry) => entry.status === "failed").map((entry) => entry.id)
        );

        setState((prev) => {
          const nextQueue = prev.queue
            .filter((item) => !successIds.has(item.id))
            .map((item) => (failedIds.has(item.id) ? bumpRetry(item) : item));
          return {
            ...prev,
            queue: nextQueue,
            lastSyncedAt: response.serverTime,
          };
        });

        setSyncStatus((prev) => ({ ...prev, lastSyncAt: response.serverTime }));
        setSyncHealth((prev) => ({
          ...prev,
          lastSuccessfulSyncAt: response.serverTime,
          consecutiveFailures: 0,
          isStale: false,
          dataAtRisk: false,
          showSyncWarning: false,
          showDataAtRiskWarning: false,
        }));
      } catch (error) {
        setSyncStatus((prev) => ({
          ...prev,
          lastError: error instanceof Error ? error.message : "Sync failed",
        }));
        setState((prev) => {
          const attempted = new Set(selected.map((item) => item.id));
          return {
            ...prev,
            queue: prev.queue.map((item) => (attempted.has(item.id) ? bumpRetry(item) : item)),
          };
        });
      } finally {
        selected.forEach((item) => inFlightMutationIdsRef.current.delete(item.id));
        syncingRef.current = false;
        setSyncStatus((prev) => ({ ...prev, syncing: false }));
      }
    },
    [identity, applyCanonicalResult, applyServerChanges]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      setSyncStatus((prev) => ({ ...prev, online: true }));
      void syncNow({ force: true });
    };
    const handleOffline = () => setSyncStatus((prev) => ({ ...prev, online: false }));
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  useEffect(() => {
    if (!identity) return;

    if (typeof Worker !== "undefined") {
      const worker = new Worker("/workers/fitness-sync-worker.js");
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<{ type?: string }>) => {
        if (event.data?.type === "tick") {
          void syncNow();
        }
      };
      worker.postMessage({ type: "start", intervalMs: SYNC_TICK_MS });
      return () => {
        worker.postMessage({ type: "stop" });
        worker.terminate();
        workerRef.current = null;
      };
    }

    const interval = window.setInterval(() => {
      void syncNow();
    }, SYNC_TICK_MS);
    return () => window.clearInterval(interval);
  }, [identity, syncNow]);

  useEffect(() => {
    if (!identity) return;
    void syncNow({ force: true });
  }, [identity, syncNow]);

  useEffect(() => {
    if (!identity) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncNow({ force: true });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [identity, syncNow]);

  useEffect(() => {
    if (!identity || !syncStatus.online) return;
    if (!state.pendingVerification) return;
    const pending = state.pendingVerification;
    const localSession =
      state.sessions.find((session) => session.id === pending.sessionId) ??
      (state.liveSession?.id === pending.sessionId
        ? {
            id: state.liveSession.id,
            gymId: state.liveSession.gymId,
            gymName: state.liveSession.gymName,
            entryAt: state.liveSession.entryAt,
            exitAt: state.liveSession.entryAt,
            durationMinutes: 0,
            calories: 0,
            validForStreak: false,
            endedBy: "EXIT_QR" as const,
            verificationStatus: "PENDING" as const,
            createdAt: state.liveSession.entryAt,
            updatedAt: state.liveSession.updatedAt,
            serverVersion: state.liveSession.serverVersion,
          }
        : null);

    if (!localSession) {
      setState((prev) => ({ ...prev, pendingVerification: null }));
      return;
    }

    const now = Date.now();
    const verifiedSession: LocalSession = {
      ...localSession,
      verificationStatus: "VERIFIED",
      updatedAt: now,
    };

    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) =>
        session.id === verifiedSession.id ? verifiedSession : session
      ),
      pendingVerification: null,
    }));

    enqueueMutation({
      id: safeRandomUUID(),
      entityId: verifiedSession.id,
      entityType: "session",
      operation: "update",
      payload: {
        ...buildSessionMutationPayload(verifiedSession, {
          verificationStatus: "VERIFIED",
          updatedAt: now,
        }),
        baseServerVersion:
          verifiedSession.serverVersion > 0 ? verifiedSession.serverVersion : undefined,
      },
    });

    void syncNow({ force: true });
  }, [identity, syncStatus.online, state.pendingVerification, state.sessions, state.liveSession, enqueueMutation, syncNow]);

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

  const handleEntryFailure = useCallback(
    (error: string) => {
      if (typeof window !== "undefined" && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent("fitdex:entry-failure", { detail: error }));
      }
      void syncNow({ force: true });
    },
    [syncNow]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__FITDEX_SYNC_DEBUG__ = {
        syncHealth,
        queueSize: state.queue.length,
        inFlightMutations: Array.from(inFlightMutationIdsRef.current),
        lastSyncAt: syncStatus.lastSyncAt,
      };
    }
  }, [syncHealth, state.queue.length, syncStatus.lastSyncAt]);

  return {
    state,
    hydrated,
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
