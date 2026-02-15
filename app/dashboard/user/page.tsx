"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  CheckCircle2,
  Dumbbell,
  Flame,
  ScanLine,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";
import { buildGymSlug, cn, formatPrice } from "@/lib/utils";

interface Membership {
  id: string;
  active: boolean;
  planType: string;
  basePrice: number;
  finalPrice: number;
  startedAt: string;
  expiresAt: string;
  gym: { id: string; name: string; address: string; latitude: number; longitude: number };
}

interface Duo {
  id: string;
  active: boolean;
  gym: { name: string };
  userOne: { name: string | null };
  userTwo: { name: string | null };
}

type SavedGym = {
  id: string;
  gym?: {
    id?: string;
    name?: string;
    address?: string;
  };
};

type SessionEndReason = "EXIT_QR" | "INACTIVITY_TIMEOUT";

type WeightEntry = {
  id: string;
  valueKg: number;
  timestamp: number;
};

type LiveGymSession = {
  id: string;
  gymId: string | null;
  gymName: string;
  entryAt: number;
  lastActivityAt: number;
};

type CompletedGymSession = {
  id: string;
  gymId: string | null;
  gymName: string;
  entryAt: number;
  exitAt: number;
  durationMinutes: number;
  calories: number;
  validForStreak: boolean;
  endedBy: SessionEndReason;
};

type SessionCompletionState = CompletedGymSession & {
  streakAfter: number;
  progressFill: number;
};

type PersistedFitnessState = {
  weights: WeightEntry[];
  sessions: CompletedGymSession[];
  liveSession: LiveGymSession | null;
  dismissedWeightPromptDate: string | null;
  lastWorkoutLoggedAt: number | null;
};

type ConsistencyDay = {
  key: string;
  label: string;
  trained: boolean;
};

const FITNESS_STORAGE_VERSION = "v1";
const MIN_VALID_SESSION_MINUTES = 20;
const SESSION_INACTIVITY_TIMEOUT_MS = 45 * 60 * 1000;
const DEFAULT_WEIGHT_WHOLE = 70;

function dayKeyFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayDiffFromNow(now: number, olderTimestamp: number): number {
  const a = new Date(now);
  const b = new Date(olderTimestamp);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000)));
}

function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateShort(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatDurationText(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatSessionTimer(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function estimateCalories(durationMinutes: number, weightKg: number): number {
  const baseBurnPerMinute = 4.8;
  const weightAdjustment = weightKg * 0.05;
  return Math.max(10, Math.round(durationMinutes * (baseBurnPerMinute + weightAdjustment)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeStreakDays(sessions: CompletedGymSession[], now: number): number {
  const validDaySet = new Set(
    sessions.filter((session) => session.validForStreak).map((session) => dayKeyFromTimestamp(session.exitAt))
  );

  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  while (validDaySet.has(dayKeyFromTimestamp(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function computeWeeklyConsistency(sessions: CompletedGymSession[], now: number): ConsistencyDay[] {
  const validDaySet = new Set(
    sessions.filter((session) => session.validForStreak).map((session) => dayKeyFromTimestamp(session.exitAt))
  );

  const result: ConsistencyDay[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = dayKeyFromTimestamp(date.getTime());
    result.push({
      key,
      label: date.toLocaleDateString([], { weekday: "short" }).slice(0, 1),
      trained: validDaySet.has(key),
    });
  }

  return result;
}

function computePhysiqueScore(
  weeklyConsistencyPercent: number,
  weightUpdatedToday: boolean,
  daysSinceWeightUpdate: number
): number {
  const consistencyScore = Math.round(weeklyConsistencyPercent * 0.45);
  const freshnessScore = weightUpdatedToday
    ? 38
    : daysSinceWeightUpdate <= 2
      ? 26
      : daysSinceWeightUpdate <= 6
        ? 14
        : 6;

  return clamp(22 + consistencyScore + freshnessScore, 0, 100);
}

function animateNumber(
  from: number,
  to: number,
  onUpdate: (value: number) => void,
  durationMs = 700
): () => void {
  if (from === to) {
    onUpdate(to);
    return () => undefined;
  }

  let raf = 0;
  const start = performance.now();

  const tick = (now: number) => {
    const progress = clamp((now - start) / durationMs, 0, 1);
    const eased = 1 - (1 - progress) ** 3;
    onUpdate(Math.round(from + (to - from) * eased));
    if (progress < 1) raf = window.requestAnimationFrame(tick);
  };

  raf = window.requestAnimationFrame(tick);
  return () => window.cancelAnimationFrame(raf);
}

function parsePersistedFitnessState(raw: string | null): PersistedFitnessState {
  if (!raw) {
    return {
      weights: [],
      sessions: [],
      liveSession: null,
      dismissedWeightPromptDate: null,
      lastWorkoutLoggedAt: null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedFitnessState>;

    const weights = Array.isArray(parsed.weights)
      ? parsed.weights
          .filter((item): item is WeightEntry => {
            if (!item || typeof item !== "object") return false;
            const maybeEntry = item as WeightEntry;
            return (
              typeof maybeEntry.id === "string" &&
              typeof maybeEntry.timestamp === "number" &&
              typeof maybeEntry.valueKg === "number"
            );
          })
          .slice(0, 120)
      : [];

    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions
          .filter((item): item is CompletedGymSession => {
            if (!item || typeof item !== "object") return false;
            const maybeSession = item as CompletedGymSession;
            return (
              typeof maybeSession.id === "string" &&
              typeof maybeSession.entryAt === "number" &&
              typeof maybeSession.exitAt === "number" &&
              typeof maybeSession.durationMinutes === "number" &&
              typeof maybeSession.calories === "number" &&
              typeof maybeSession.validForStreak === "boolean" &&
              (maybeSession.endedBy === "EXIT_QR" || maybeSession.endedBy === "INACTIVITY_TIMEOUT")
            );
          })
          .slice(0, 120)
      : [];

    const liveSession =
      parsed.liveSession &&
      typeof parsed.liveSession === "object" &&
      typeof parsed.liveSession.id === "string" &&
      typeof parsed.liveSession.entryAt === "number" &&
      typeof parsed.liveSession.lastActivityAt === "number" &&
      typeof parsed.liveSession.gymName === "string"
        ? {
            id: parsed.liveSession.id,
            gymId: parsed.liveSession.gymId ?? null,
            gymName: parsed.liveSession.gymName,
            entryAt: parsed.liveSession.entryAt,
            lastActivityAt: parsed.liveSession.lastActivityAt,
          }
        : null;

    return {
      weights,
      sessions,
      liveSession,
      dismissedWeightPromptDate:
        typeof parsed.dismissedWeightPromptDate === "string" ? parsed.dismissedWeightPromptDate : null,
      lastWorkoutLoggedAt:
        typeof parsed.lastWorkoutLoggedAt === "number" ? parsed.lastWorkoutLoggedAt : null,
    };
  } catch {
    return {
      weights: [],
      sessions: [],
      liveSession: null,
      dismissedWeightPromptDate: null,
      lastWorkoutLoggedAt: null,
    };
  }
}

function WheelColumn({
  values,
  selected,
  onSelect,
  formatter = (value) => String(value),
}: {
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  formatter?: (value: number) => string;
}) {
  return (
    <div className="relative h-44 overflow-y-auto rounded-2xl border border-white/10 bg-background/75">
      <div className="pointer-events-none absolute inset-x-2 top-1/2 h-10 -translate-y-1/2 rounded-lg border border-primary/30 bg-primary/10" />
      <div className="py-14">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={cn(
              "flex h-10 w-full items-center justify-center text-base tabular-nums transition-colors",
              selected === value ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {formatter(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[360px] w-full rounded-2xl" />
        <Skeleton className="h-[360px] w-full rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Skeleton className="h-[260px] w-full rounded-2xl" />
        <Skeleton className="h-[260px] w-full rounded-2xl" />
      </div>
    </div>
  );
}

function UserDashboardContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [duos, setDuos] = useState<Duo[]>([]);
  const [savedGyms, setSavedGyms] = useState<SavedGym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [sessions, setSessions] = useState<CompletedGymSession[]>([]);
  const [liveSession, setLiveSession] = useState<LiveGymSession | null>(null);
  const [dismissedWeightPromptDate, setDismissedWeightPromptDate] = useState<string | null>(null);
  const [lastWorkoutLoggedAt, setLastWorkoutLoggedAt] = useState<number | null>(null);

  const [fitnessHydrated, setFitnessHydrated] = useState(false);
  const [clockNow, setClockNow] = useState<number>(Date.now());
  const [showContextualWeightReminder, setShowContextualWeightReminder] = useState(false);

  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [weightWhole, setWeightWhole] = useState<number>(DEFAULT_WEIGHT_WHOLE);
  const [weightDecimal, setWeightDecimal] = useState<number>(0);

  const [sessionCompletion, setSessionCompletion] = useState<SessionCompletionState | null>(null);
  const [sessionCompletionFill, setSessionCompletionFill] = useState(0);

  const [displayedSessionMinutes, setDisplayedSessionMinutes] = useState(0);
  const [displayedSessionCalories, setDisplayedSessionCalories] = useState(0);
  const [animatedPhysiqueScore, setAnimatedPhysiqueScore] = useState(0);
  const physiqueScoreRef = useRef(0);

  const sessionUser = session?.user as { id?: string; email?: string } | undefined;
  const userIdentity = sessionUser?.id ?? sessionUser?.email ?? null;
  const fitnessStorageKey = userIdentity
    ? `fitdex:fitness-dashboard:${FITNESS_STORAGE_VERSION}:${userIdentity}`
    : null;

  useEffect(() => {
    let active = true;
    const joinGymId = searchParams.get("join");
    if (joinGymId) {
      router.replace(`/dashboard/user/join/${joinGymId}`);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled([
          fetchJson<{ memberships?: Membership[]; error?: string }>("/api/memberships", {
            retries: 1,
            useCache: true,
            cacheKey: "user-memberships",
            cacheTtlMs: 15000,
          }),
          fetchJson<{ duos?: Duo[]; error?: string }>("/api/duos", {
            retries: 1,
            useCache: true,
            cacheKey: "user-duos",
            cacheTtlMs: 15000,
          }),
          fetchJson<{ saved?: SavedGym[]; error?: string }>("/api/saved-gyms", {
            retries: 1,
            useCache: true,
            cacheKey: "user-saved-gyms",
            cacheTtlMs: 12000,
          }),
        ]);

        if (!active) return;

        const membershipResult = results[0].status === "fulfilled" ? results[0].value : null;
        const duoResult = results[1].status === "fulfilled" ? results[1].value : null;
        const savedResult = results[2].status === "fulfilled" ? results[2].value : null;

        if (!membershipResult?.ok || !duoResult?.ok || !savedResult?.ok) {
          setError("Failed to load your dashboard.");
        }

        setMemberships(membershipResult?.data?.memberships ?? []);
        setDuos(duoResult?.data?.duos ?? []);
        setSavedGyms(savedResult?.data?.saved ?? []);
      } catch {
        if (active) setError("Failed to load your dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [searchParams, router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!fitnessStorageKey) {
      setFitnessHydrated(true);
      return;
    }

    const raw = window.localStorage.getItem(fitnessStorageKey);
    const persisted = parsePersistedFitnessState(raw);
    setWeights(persisted.weights.sort((a, b) => b.timestamp - a.timestamp));
    setSessions(persisted.sessions.sort((a, b) => b.exitAt - a.exitAt));
    setLiveSession(persisted.liveSession);
    setDismissedWeightPromptDate(persisted.dismissedWeightPromptDate);
    setLastWorkoutLoggedAt(persisted.lastWorkoutLoggedAt);
    setFitnessHydrated(true);
  }, [fitnessStorageKey]);

  useEffect(() => {
    if (!fitnessHydrated || !fitnessStorageKey) return;

    const payload: PersistedFitnessState = {
      weights: weights.slice(0, 120),
      sessions: sessions.slice(0, 120),
      liveSession,
      dismissedWeightPromptDate,
      lastWorkoutLoggedAt,
    };

    window.localStorage.setItem(fitnessStorageKey, JSON.stringify(payload));
  }, [
    weights,
    sessions,
    liveSession,
    dismissedWeightPromptDate,
    lastWorkoutLoggedAt,
    fitnessHydrated,
    fitnessStorageKey,
  ]);

  const activeMembership = memberships.find((membership) => membership.active) ?? null;
  const activeDuo = duos.find((duo) => duo.active) ?? null;

  const todayKey = useMemo(() => dayKeyFromTimestamp(clockNow), [clockNow]);
  const latestWeight = useMemo(() => weights[0] ?? null, [weights]);

  const weightUpdatedToday = latestWeight ? dayKeyFromTimestamp(latestWeight.timestamp) === todayKey : false;
  const daysSinceWeightUpdate = latestWeight ? dayDiffFromNow(clockNow, latestWeight.timestamp) : Number.POSITIVE_INFINITY;
  const shouldShowWeightPill = !weightUpdatedToday && dismissedWeightPromptDate !== todayKey;

  const weeklyConsistency = useMemo(() => computeWeeklyConsistency(sessions, clockNow), [sessions, clockNow]);
  const validWeekDays = weeklyConsistency.filter((day) => day.trained).length;
  const weeklyConsistencyPercent = (validWeekDays / 7) * 100;
  const streakDays = useMemo(() => computeStreakDays(sessions, clockNow), [sessions, clockNow]);

  const physiqueScoreTarget = useMemo(
    () => computePhysiqueScore(weeklyConsistencyPercent, weightUpdatedToday, daysSinceWeightUpdate),
    [weeklyConsistencyPercent, weightUpdatedToday, daysSinceWeightUpdate]
  );

  useEffect(() => {
    const stopAnimation = animateNumber(
      physiqueScoreRef.current,
      physiqueScoreTarget,
      (value) => {
        physiqueScoreRef.current = value;
        setAnimatedPhysiqueScore(value);
      },
      850
    );

    return stopAnimation;
  }, [physiqueScoreTarget]);

  const todayCompletedSession = useMemo(
    () => sessions.find((sessionItem) => dayKeyFromTimestamp(sessionItem.exitAt) === todayKey) ?? null,
    [sessions, todayKey]
  );

  useEffect(() => {
    if (!todayCompletedSession || liveSession || sessionCompletion) {
      setDisplayedSessionMinutes(todayCompletedSession?.durationMinutes ?? 0);
      setDisplayedSessionCalories(todayCompletedSession?.calories ?? 0);
      return;
    }

    const stopMinutes = animateNumber(0, todayCompletedSession.durationMinutes, setDisplayedSessionMinutes, 900);
    const stopCalories = animateNumber(0, todayCompletedSession.calories, setDisplayedSessionCalories, 1000);

    return () => {
      stopMinutes();
      stopCalories();
    };
  }, [todayCompletedSession, liveSession, sessionCompletion]);

  useEffect(() => {
    if (!sessionCompletion) return;
    setSessionCompletionFill(0);
    const timer = window.setTimeout(() => {
      setSessionCompletionFill(sessionCompletion.progressFill);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [sessionCompletion]);

  useEffect(() => {
    if (weightUpdatedToday || daysSinceWeightUpdate < 3) {
      setShowContextualWeightReminder(false);
    }
  }, [weightUpdatedToday, daysSinceWeightUpdate]);

  useEffect(() => {
    if (!liveSession) return;
    if (clockNow - liveSession.lastActivityAt < SESSION_INACTIVITY_TIMEOUT_MS) return;

    setLiveSession((current) => {
      if (!current) return null;

      const endedAt = Date.now();
      const durationMinutes = Math.max(1, Math.round((endedAt - current.entryAt) / 60000));
      const calories = estimateCalories(durationMinutes, latestWeight?.valueKg ?? DEFAULT_WEIGHT_WHOLE);
      const validForStreak = durationMinutes >= MIN_VALID_SESSION_MINUTES;

      const endedSession: CompletedGymSession = {
        id: `session_${endedAt}`,
        gymId: current.gymId,
        gymName: current.gymName,
        entryAt: current.entryAt,
        exitAt: endedAt,
        durationMinutes,
        calories,
        validForStreak,
        endedBy: "INACTIVITY_TIMEOUT",
      };

      setSessions((previous) => {
        const next = [endedSession, ...previous].sort((a, b) => b.exitAt - a.exitAt).slice(0, 120);
        const streakAfter = computeStreakDays(next, endedAt);
        setSessionCompletion({
          ...endedSession,
          streakAfter,
          progressFill: clamp(Math.round((durationMinutes / (MIN_VALID_SESSION_MINUTES * 2)) * 100), 20, 100),
        });
        return next;
      });

      return null;
    });
  }, [clockNow, liveSession, latestWeight?.valueKg]);

  useEffect(() => {
    if (!weightSheetOpen) return;
    const sourceWeight = latestWeight?.valueKg ?? DEFAULT_WEIGHT_WHOLE;
    const normalized = Math.round(sourceWeight * 10);
    setWeightWhole(Math.floor(normalized / 10));
    setWeightDecimal(Math.abs(normalized % 10));
  }, [weightSheetOpen, latestWeight]);

  useEffect(() => {
    if (!weightSheetOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWeightSheetOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [weightSheetOpen]);

  const triggerWeightReminderIfNeeded = useCallback(() => {
    if (!weightUpdatedToday && daysSinceWeightUpdate >= 3) {
      setShowContextualWeightReminder(true);
    }
  }, [weightUpdatedToday, daysSinceWeightUpdate]);

  const startSessionFromEntryScan = useCallback(() => {
    if (liveSession) return;

    const now = Date.now();
    setSessionCompletion(null);
    setLiveSession({
      id: `live_${now}`,
      gymId: activeMembership?.gym.id ?? null,
      gymName: activeMembership?.gym.name ?? "Fitdex Gym",
      entryAt: now,
      lastActivityAt: now,
    });

    triggerWeightReminderIfNeeded();
  }, [liveSession, activeMembership?.gym.id, activeMembership?.gym.name, triggerWeightReminderIfNeeded]);

  const endLiveSession = useCallback(
    (endedBy: SessionEndReason) => {
      setLiveSession((current) => {
        if (!current) return null;

        const endedAt = Date.now();
        const durationMinutes = Math.max(1, Math.round((endedAt - current.entryAt) / 60000));
        const calories = estimateCalories(durationMinutes, latestWeight?.valueKg ?? DEFAULT_WEIGHT_WHOLE);
        const validForStreak = durationMinutes >= MIN_VALID_SESSION_MINUTES;

        const endedSession: CompletedGymSession = {
          id: `session_${endedAt}`,
          gymId: current.gymId,
          gymName: current.gymName,
          entryAt: current.entryAt,
          exitAt: endedAt,
          durationMinutes,
          calories,
          validForStreak,
          endedBy,
        };

        setSessions((previous) => {
          const next = [endedSession, ...previous].sort((a, b) => b.exitAt - a.exitAt).slice(0, 120);
          const streakAfter = computeStreakDays(next, endedAt);
          setSessionCompletion({
            ...endedSession,
            streakAfter,
            progressFill: clamp(Math.round((durationMinutes / (MIN_VALID_SESSION_MINUTES * 2)) * 100), 20, 100),
          });
          return next;
        });

        return null;
      });
    },
    [latestWeight?.valueKg]
  );

  const keepLiveSessionActive = useCallback(() => {
    setLiveSession((current) => {
      if (!current) return null;
      return {
        ...current,
        lastActivityAt: Date.now(),
      };
    });
  }, []);

  const logWorkout = useCallback(() => {
    const now = Date.now();
    setLastWorkoutLoggedAt(now);
    triggerWeightReminderIfNeeded();
  }, [triggerWeightReminderIfNeeded]);

  const saveWeight = useCallback(() => {
    const now = Date.now();
    const valueKg = Number((weightWhole + weightDecimal / 10).toFixed(1));

    const nextWeight: WeightEntry = {
      id: `weight_${now}`,
      valueKg,
      timestamp: now,
    };

    setWeights((previous) => [nextWeight, ...previous].sort((a, b) => b.timestamp - a.timestamp).slice(0, 120));
    setDismissedWeightPromptDate(null);
    setShowContextualWeightReminder(false);
    setWeightSheetOpen(false);
  }, [weightWhole, weightDecimal]);

  const dismissWeightPrompt = useCallback(() => {
    setDismissedWeightPromptDate(todayKey);
  }, [todayKey]);

  const liveSessionElapsedMs = liveSession ? Math.max(0, clockNow - liveSession.entryAt) : 0;
  const liveSessionRemainingMs = liveSession
    ? Math.max(0, SESSION_INACTIVITY_TIMEOUT_MS - (clockNow - liveSession.lastActivityAt))
    : 0;

  const liveSessionQualifiesStreak = liveSessionElapsedMs >= MIN_VALID_SESSION_MINUTES * 60 * 1000;
  const displayName = session?.user?.name ?? "there";

  const weightWholeValues = useMemo(
    () => Array.from({ length: 191 }, (_, index) => 30 + index),
    []
  );
  const weightDecimalValues = useMemo(
    () => Array.from({ length: 10 }, (_, index) => index),
    []
  );

  const shouldShowDashboardSkeleton = loading || !fitnessHydrated;

  if (shouldShowDashboardSkeleton) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <Card className="glass-card p-8 text-center">
          <CardHeader>
            <CardTitle>Could not load dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hi, {displayName}</h1>
            <p className="text-sm text-muted-foreground">
              Consistency dashboard with passive nudges and live session tracking.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={logWorkout}>
              Log workout
            </Button>
            <Button size="sm" onClick={startSessionFromEntryScan} disabled={Boolean(liveSession)}>
              <ScanLine className="mr-1 h-4 w-4" />
              Scan ENTRY QR
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="glass-card min-h-[360px] transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Physique Progress
              </CardTitle>
              <CardDescription>Keep weight updates current for more accurate progress insights.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress accuracy</span>
                  <span className="font-semibold tabular-nums">{animatedPhysiqueScore}%</span>
                </div>
                <div className="mt-3">
                  <Progress value={animatedPhysiqueScore} className="h-2.5 bg-white/10" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Animated recalculation responds to fresh weight and validated sessions.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 min-h-[152px]">
                {weightUpdatedToday && latestWeight ? (
                  <div className="flex h-full flex-col justify-between gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Today&apos;s weight</p>
                        <p className="mt-1 text-3xl font-semibold tabular-nums">{latestWeight.valueKg.toFixed(1)} kg</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Updated at {formatClockTime(latestWeight.timestamp)}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Logged
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="w-fit" onClick={() => setWeightSheetOpen(true)}>
                      Update again
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-full flex-col justify-between gap-3">
                    <div className="space-y-2">
                      {showContextualWeightReminder && daysSinceWeightUpdate >= 3 ? (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                          Update weight to keep progress accurate.
                        </div>
                      ) : null}

                      {latestWeight ? (
                        <p className="text-xs text-muted-foreground">
                          Last update: {latestWeight.valueKg.toFixed(1)} kg on {formatDateShort(latestWeight.timestamp)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No weight has been logged yet.</p>
                      )}
                    </div>

                    {shouldShowWeightPill ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setWeightSheetOpen(true)}
                          className="fitdex-weight-pill inline-flex flex-1 items-center justify-center rounded-full border border-primary/35 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary/60 hover:bg-primary/15"
                        >
                          Update today&apos;s weight
                        </button>
                        <button
                          type="button"
                          onClick={dismissWeightPrompt}
                          aria-label="Dismiss weight reminder for today"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-muted-foreground transition hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">Weight reminder hidden for today.</p>
                        <Button variant="ghost" size="sm" onClick={() => setWeightSheetOpen(true)}>
                          Update now
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card min-h-[360px] transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5" />
                Gym Session
              </CardTitle>
              <CardDescription>Duration is auto-calculated from ENTRY and EXIT scan events.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessionCompletion ? (
                <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-emerald-100">Session completed</p>
                    <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-xs text-emerald-200">
                      {sessionCompletion.endedBy === "EXIT_QR" ? "EXIT scan" : "Auto ended"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-emerald-100/70">Duration</p>
                      <p className="text-lg font-semibold tabular-nums">{formatDurationText(sessionCompletion.durationMinutes)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-100/70">Calories</p>
                      <p className="text-lg font-semibold tabular-nums">{sessionCompletion.calories}</p>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-100/70">Streak</p>
                      <p className="text-lg font-semibold tabular-nums">{sessionCompletion.streakAfter}d</p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-emerald-300 transition-[width] duration-700 ease-out"
                      style={{ width: `${sessionCompletionFill}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-emerald-100/80">
                      {sessionCompletion.validForStreak
                        ? "Valid session counted toward streak."
                        : `Train at least ${MIN_VALID_SESSION_MINUTES} minutes for streak credit.`}
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setSessionCompletion(null)}>
                      Continue
                    </Button>
                  </div>
                </div>
              ) : null}

              {liveSession ? (
                <div className="rounded-2xl border border-primary/35 bg-primary/10 p-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/20 px-2.5 py-1 text-xs font-medium text-primary">
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      LIVE
                    </span>
                    <p className="text-xs text-primary/80">Optimistic sync active</p>
                  </div>

                  <p className="mt-3 text-xs uppercase tracking-wide text-primary/80">Running timer</p>
                  <p className="mt-1 text-4xl font-semibold tabular-nums">{formatSessionTimer(liveSessionElapsedMs)}</p>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gym</span>
                    <span className="font-medium">{liveSession.gymName}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Streak status</span>
                    <span className={cn("font-medium", liveSessionQualifiesStreak ? "text-emerald-300" : "text-muted-foreground")}>
                      {liveSessionQualifiesStreak ? "Threshold reached" : `Need ${MIN_VALID_SESSION_MINUTES}m`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Inactivity timeout</span>
                    <span className="tabular-nums">{formatSessionTimer(liveSessionRemainingMs)}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button className="w-full" onClick={() => endLiveSession("EXIT_QR")}>
                      Scan EXIT QR
                    </Button>
                    <Button variant="outline" className="w-full" onClick={keepLiveSessionActive}>
                      I&apos;m still active
                    </Button>
                  </div>
                </div>
              ) : todayCompletedSession ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 min-h-[196px] flex flex-col justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">You trained {formatDurationText(displayedSessionMinutes)} today</p>
                    <p className="mt-1 text-xs text-muted-foreground">Count-up reflects your latest completed session.</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Gym</span>
                      <span className="font-medium">{todayCompletedSession.gymName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Estimated calories</span>
                      <span className="font-medium tabular-nums">{displayedSessionCalories} kcal</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Session end</span>
                      <span className="font-medium">{formatClockTime(todayCompletedSession.exitAt)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 min-h-[196px] flex flex-col justify-between">
                  <p className="text-sm text-muted-foreground">Start your session by scanning the gym QR.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="w-full" onClick={startSessionFromEntryScan}>
                      <ScanLine className="mr-1 h-4 w-4" />
                      Scan ENTRY QR
                    </Button>
                    <Button variant="outline" className="w-full" onClick={logWorkout}>
                      Log workout
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="glass-card min-h-[260px] transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="fitdex-flame h-5 w-5 text-orange-400" />
                Streak Validation
              </CardTitle>
              <CardDescription>
                A day counts only after valid ENTRY scan and at least {MIN_VALID_SESSION_MINUTES} minutes of training.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Current streak</p>
                  <p className="text-3xl font-semibold tabular-nums">{streakDays} days</p>
                </div>
                <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground">
                  {validWeekDays}/7 consistent
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Weekly consistency</p>
                <div className="grid grid-cols-7 gap-2">
                  {weeklyConsistency.map((day) => (
                    <div key={day.key} className="space-y-1 text-center">
                      <div className="h-16 rounded-xl border border-white/10 bg-white/[0.02] p-1 flex items-end justify-center">
                        <div
                          className={cn(
                            "w-full rounded-lg transition-all duration-300",
                            day.trained ? "h-full bg-gradient-to-t from-emerald-500/90 to-emerald-300/70" : "h-3 bg-white/10"
                          )}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{day.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card min-h-[260px] transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Membership Snapshot
              </CardTitle>
              <CardDescription>
                {activeMembership ? "Your active Fitdex plan" : "No active membership yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeMembership ? (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-medium">{activeMembership.planType}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Final price</span>
                      <span className="font-medium">{formatPrice(activeMembership.finalPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gym</span>
                      <span className="font-medium">{activeMembership.gym.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard/user/membership">View membership</Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/dashboard/user/duo">
                        <Users className="mr-1 h-4 w-4" />
                        {activeDuo ? "Duo active" : "Invite partner"}
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Start with a gym check-in and let the session tracker build your streak momentum.
                  </p>
                  <Button asChild>
                    <Link href="/explore">Explore gyms</Link>
                  </Button>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Saved gyms</p>
                {savedGyms.length > 0 ? (
                  <div className="space-y-2">
                    {savedGyms.slice(0, 2).map((saved) => (
                      <div key={saved.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{saved.gym?.name ?? "Gym"}</p>
                          <p className="truncate text-xs text-muted-foreground">{saved.gym?.address ?? "Address unavailable"}</p>
                        </div>
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            href={
                              saved.gym?.id
                                ? `/explore/${buildGymSlug(saved.gym?.name ?? "gym", saved.gym.id)}`
                                : "/explore"
                            }
                          >
                            <Bookmark className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No saved gyms yet.</p>
                )}
              </div>

              {lastWorkoutLoggedAt ? (
                <p className="text-xs text-muted-foreground">
                  Last workout logged at {formatClockTime(lastWorkoutLoggedAt)}.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 transition-opacity duration-200",
          weightSheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden={!weightSheetOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          onClick={() => setWeightSheetOpen(false)}
          aria-label="Close weight input"
        />

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl border border-white/10 bg-card px-4 pb-6 pt-4 shadow-2xl transition-transform duration-300",
            weightSheetOpen ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Update today&apos;s weight</p>
              <p className="text-xs text-muted-foreground">Scroll and select from the wheel picker.</p>
            </div>
            <button
              type="button"
              onClick={() => setWeightSheetOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-muted-foreground transition hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-3">
            <WheelColumn values={weightWholeValues} selected={weightWhole} onSelect={setWeightWhole} />
            <span className="text-2xl font-semibold text-muted-foreground">.</span>
            <WheelColumn
              values={weightDecimalValues}
              selected={weightDecimal}
              onSelect={setWeightDecimal}
              formatter={(value) => String(value)}
            />
            <span className="text-base font-medium text-muted-foreground">kg</span>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="text-sm text-muted-foreground">Selected</p>
            <p className="text-lg font-semibold tabular-nums">{(weightWhole + weightDecimal / 10).toFixed(1)} kg</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setWeightSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveWeight}>
              <Zap className="mr-1 h-4 w-4" />
              Save & Recalculate
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function UserDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <UserDashboardContent />
    </Suspense>
  );
}
