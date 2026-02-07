"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/client-fetch";

export default function OwnerExplorePage() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/explore", { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error ?? "Failed to load gyms");
          setGyms([]);
          return;
        }
        setGyms(result.data?.gyms ?? []);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load gyms");
        setGyms([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const title = useMemo(() => "Owner explore", []);

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Could not load gyms</CardTitle>
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
    <div className="p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          {title}
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage your gyms and review competitors. Open your gym to edit it and see owner-only analytics.
        </p>
      </motion.div>

      {gyms.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <p className="text-muted-foreground">No gyms found.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gyms.map((gym) => {
            const isOwner = gym.isOwner;
            const isVerified = gym.verificationStatus === "VERIFIED";
            return (
              <Card key={gym.id} className="glass-card overflow-hidden">
                <div className="relative h-36 bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20">
                  {gym.coverImageUrl ? (
                    <img src={gym.coverImageUrl} alt={gym.name} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex items-center gap-2 text-[10px]">
                    <span className={`rounded-full px-2 py-0.5 ${isOwner ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-400"}`}>
                      {isOwner ? "Your gym" : "Competitor"}
                    </span>
                    {isVerified ? (
                      <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5">Verified</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/20 text-amber-400 px-2 py-0.5">Unverified</span>
                    )}
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{gym.name}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {gym.address}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isOwner && gym.stats ? (
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div className="rounded-lg border border-white/10 px-3 py-2">
                        <div className="text-sm font-semibold text-foreground">{gym.stats.membersJoined}</div>
                        Members joined
                      </div>
                      <div className="rounded-lg border border-white/10 px-3 py-2">
                        <div className="text-sm font-semibold text-foreground">{gym.stats.pageViews}</div>
                        Page visits
                      </div>
                    </div>
                  ) : isOwner ? (
                    <div className="rounded-lg border border-white/10 px-3 py-2 text-xs text-muted-foreground">
                      Premium analytics available on paid plans.
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {isOwner ? (
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/dashboard/owner/explore/${gym.id}`}>View your gym</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/explore/${gym.id}`}>View profile</Link>
                      </Button>
                    )}
                    {isOwner ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/explore/${gym.id}`}>See customer preview</Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
