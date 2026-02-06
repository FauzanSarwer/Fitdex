"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Users, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface InviteData {
  code: string;
  gymId: string;
  gymName: string;
  inviterName: string;
  partnerDiscountPercent: number;
}

export default function InvitePage() {
  const params = useParams();
  const code = (params.code as string) ?? "";
  const [data, setData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/invites/resolve?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.gymId) setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="glass-card p-10 text-center">
          <CardTitle>Invalid invite</CardTitle>
          <p className="text-muted-foreground mt-2">This invite link is no longer valid.</p>
          <Button asChild className="mt-6">
            <Link href="/explore">Explore gyms</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const callbackUrl = `/dashboard/user/join/${data.gymId}?invite=${data.code}`;

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card border-primary/30">
          <CardHeader>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary w-fit">
              <Users className="h-3 w-3" />
              Duo invite
            </div>
            <CardTitle className="mt-3 text-2xl">
              {data.inviterName} invited you to join {data.gymName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              You’ll unlock up to {data.partnerDiscountPercent}% partner discount.
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="flex-1">
                <Link href={callbackUrl}>
                  Join this gym
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="flex-1">
                <Link href={`/auth/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                  Create account
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
