"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type VerificationStatusResponse = {
  ok: boolean;
  emailVerified?: boolean;
  resend?: {
    lastSentAt: string | null;
    dailyResendCount: number;
    dailyLimit: number;
    cooldownSeconds: number;
  };
};

type BannerState = {
  lastSentAt: Date | null;
  dailyResendCount: number;
  dailyLimit: number;
  cooldownSeconds: number;
};

function buildState(payload?: VerificationStatusResponse["resend"]): BannerState {
  return {
    lastSentAt: payload?.lastSentAt ? new Date(payload.lastSentAt) : null,
    dailyResendCount: payload?.dailyResendCount ?? 0,
    dailyLimit: payload?.dailyLimit ?? 5,
    cooldownSeconds: payload?.cooldownSeconds ?? 30,
  };
}

export function EmailVerificationBanner() {
  const { data: session, status } = useSession();
  const emailVerified = !!(session?.user as { emailVerified?: boolean })?.emailVerified;
  const [sending, setSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [bannerState, setBannerState] = useState<BannerState>(() => buildState());

  useEffect(() => {
    if (status !== "authenticated" || emailVerified) return;
    let active = true;
    fetch("/api/auth/verify?status=1", { method: "GET", cache: "no-store" })
      .then((res) => res.json().catch(() => null))
      .then((json: VerificationStatusResponse | null) => {
        if (!active || !json?.ok) return;
        setBannerState(buildState(json.resend));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [status, emailVerified]);

  useEffect(() => {
    if (!bannerState.lastSentAt) return;
    const intervalId = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [bannerState.lastSentAt]);

  const cooldownLeft = useMemo(() => {
    if (!bannerState.lastSentAt) return 0;
    const elapsed = (tick - bannerState.lastSentAt.getTime()) / 1000;
    return Math.max(0, Math.ceil(bannerState.cooldownSeconds - elapsed));
  }, [bannerState.cooldownSeconds, bannerState.lastSentAt, tick]);

  const dailyWindowActive = useMemo(() => {
    if (!bannerState.lastSentAt) return false;
    return tick - bannerState.lastSentAt.getTime() < 24 * 60 * 60 * 1000;
  }, [bannerState.lastSentAt, tick]);

  const dailyLimitReached = dailyWindowActive && bannerState.dailyResendCount >= bannerState.dailyLimit;
  const resendDisabled = sending || cooldownLeft > 0;

  if (status !== "authenticated" || emailVerified) return null;

  const handleResend = async () => {
    if (dailyLimitReached) {
      setDialogOpen(true);
      return;
    }
    if (resendDisabled) return;

    setSending(true);
    try {
      const response = await fetch("/api/auth/verify", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as VerificationStatusResponse | null;
      if (payload?.resend) {
        setBannerState(buildState(payload.resend));
      }
      if (!response.ok && (payload?.resend?.dailyResendCount ?? 0) >= (payload?.resend?.dailyLimit ?? 5)) {
        setDialogOpen(true);
      }
    } finally {
      setSending(false);
      setTick(Date.now());
    }
  };

  return (
    <>
      <div className="bg-amber-500/20 border-b border-amber-500/30">
        <div className="container mx-auto px-4 py-2 text-xs text-amber-100 flex flex-wrap items-center gap-2 justify-between">
          <span>Verification email sent. Please verify your email.</span>
          <button
            type="button"
            className={`text-amber-50 underline ${dailyLimitReached ? "cursor-not-allowed opacity-60" : "hover:text-white"} disabled:opacity-60`}
            onClick={handleResend}
            disabled={resendDisabled}
            aria-disabled={dailyLimitReached || resendDisabled}
          >
            {dailyLimitReached
              ? "Resend disabled"
              : sending
                ? "Sending..."
                : cooldownLeft > 0
                  ? `Resend in ${cooldownLeft}s`
                  : "Resend"}
          </button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Resend limit reached</DialogTitle>
            <DialogDescription>Please try again in 24 hours</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setDialogOpen(false)}>
              Okay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
