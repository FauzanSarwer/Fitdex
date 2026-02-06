"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

function resolveNextUrl(raw: string | null) {
  if (!raw) return "/dashboard/user";
  if (raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw);
    if (typeof window !== "undefined" && url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {}
  return "/dashboard/user";
}

function AuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();
  const [error, setError] = useState<string | null>(null);

  const nextUrl = useMemo(
    () => resolveNextUrl(searchParams.get("next")),
    [searchParams]
  );

  const desiredRole = useMemo(() => {
    const rawRole = searchParams.get("role");
    return rawRole && rawRole.toUpperCase() === "OWNER" ? "OWNER" : "USER";
  }, [searchParams]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/auth/login?callbackUrl=${encodeURIComponent(nextUrl)}`);
      return;
    }
    if (status !== "authenticated") return;

    const currentRole = (session?.user as { role?: string })?.role;

    const proceed = async () => {
      if (!currentRole || currentRole !== desiredRole) {
        try {
          const res = await fetch("/api/auth/role", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: desiredRole }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error ?? "Failed to update role");
          }
          await update({ role: desiredRole });
        } catch (e: any) {
          setError(e?.message ?? "Failed to update role");
          return;
        }
      }
      router.replace(nextUrl);
    };

    void proceed();
  }, [status, session, desiredRole, nextUrl, update, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="glass-card p-8 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <div className="text-sm text-muted-foreground">
          {error ? error : "Finishing sign in…"}
        </div>
      </Card>
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="glass-card p-8 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div className="text-sm text-muted-foreground">Finishing sign in…</div>
        </Card>
      </div>
    }>
      <AuthCompleteContent />
    </Suspense>
  );
}
