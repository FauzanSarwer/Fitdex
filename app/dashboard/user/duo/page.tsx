"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";

export default function DuoPage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const emailVerified = !!(session?.user as { emailVerified?: boolean })?.emailVerified;
  const [duos, setDuos] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGymId, setInviteGymId] = useState("");
  const [sending, setSending] = useState(false);
  const [acceptCode, setAcceptCode] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJson<{ duos?: any[]; invites?: any[]; error?: string }>("/api/duos", { retries: 1 }),
      fetchJson<{ memberships?: any[]; error?: string }>("/api/memberships", { retries: 1 }),
      fetchJson<{ gyms?: any[]; error?: string }>("/api/gyms", { retries: 1 }),
    ])
      .then(([d, m, g]) => {
        if (!active) return;
        if (!d.ok || !m.ok) {
          setError("Failed to load duo data");
          toast({ title: "Error", description: "Failed to load duo data", variant: "destructive" });
        }
        setDuos(d.ok ? d.data?.duos ?? [] : []);
        setInvites(d.ok ? d.data?.invites ?? [] : []);
        setMemberships(m.ok ? m.data?.memberships ?? [] : []);
        setGyms(g.ok ? g.data?.gyms ?? [] : []);
        const activeMembership = (m.ok ? m.data?.memberships ?? [] : []).find((x: any) => x.active);
        if (activeMembership) setInviteGymId(activeMembership.gymId);
        if (!activeMembership && g.ok && (g.data?.gyms ?? []).length > 0) {
          setInviteGymId((g.data?.gyms ?? [])[0]?.id ?? "");
        }
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        toast({ title: "Error", description: "Failed to load duo data", variant: "destructive" });
        setError("Failed to load duo data");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const activeMembership = memberships.find((m) => m.active);
  const activeDuo = duos.find((d) => d.active);
  const inviteStatuses = invites.map((invite) => {
    const createdAt = new Date(invite.createdAt ?? Date.now()).getTime();
    const isExpired = Date.now() - createdAt > 1000 * 60 * 60 * 24 * 7;
    const status = invite.accepted ? "Accepted" : isExpired ? "Rejected" : "Invited";
    return { ...invite, status };
  });

  async function sendInvite() {
    if (!emailVerified) {
      toast({ title: "Verify your email", description: "Verify your email to invite a partner.", variant: "destructive" });
      return;
    }
    if (!inviteGymId) {
      toast({ title: "Select a gym", description: "Choose a gym to invite a partner.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const joinTogether = !activeMembership;
      const result = await fetchJson<{ code?: string; email?: string; error?: string }>("/api/duos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId: inviteGymId, email: inviteEmail || undefined, joinTogether }),
        retries: 1,
      });
      if (!result.ok) {
        toast({ title: "Error", description: result.error ?? "Failed to send invite", variant: "destructive" });
        return;
      }
      if (result.data?.code) {
        setLastInviteCode(result.data.code);
        toast({ title: "Invite created", description: `Share this code: ${result.data.code}` });
      } else {
        toast({ title: "Invite sent", description: `Sent to ${result.data?.email}` });
      }
      setInviteEmail("");
      setDuos((prev) => [...prev]); // refetch would be better
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function acceptInvite() {
    if (!emailVerified) {
      toast({ title: "Verify your email", description: "Verify your email to accept invites.", variant: "destructive" });
      return;
    }
    if (!acceptCode.trim()) return;
    setAccepting(true);
    try {
      const result = await fetchJson<{ error?: string }>("/api/duos/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: acceptCode.trim().toUpperCase() }),
        retries: 1,
      });
      if (!result.ok) {
        toast({ title: "Error", description: result.error ?? "Invalid code", variant: "destructive" });
        return;
      }
      toast({ title: "Duo activated", description: "You're now partners!" });
      setAcceptCode("");
      setDuos((prev) => [...prev]);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Could not load duo</CardTitle>
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Duo
        </h1>
        <p className="text-muted-foreground text-sm">
          Pair up to save together and stay accountable.
        </p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card border border-white/10 md:col-span-2">
          <CardHeader>
            <CardTitle>Duo benefits</CardTitle>
            <CardDescription>Small wins feel bigger together.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground grid gap-2">
            <div className="flex items-center justify-between">
              <span>Partner savings on renewal</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">Savings</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Motivation through accountability</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">Support</span>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border border-white/10">
          <CardHeader>
            <CardTitle>Tip</CardTitle>
            <CardDescription>Use WhatsApp for fastest invites.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Share a link or code in seconds and keep the momentum going.
          </CardContent>
        </Card>
      </div>

      {activeDuo && (
        <Card className="glass-card border border-white/10">
          <CardHeader>
            <CardTitle>Active duo</CardTitle>
            <CardDescription>
              Partner: {activeDuo.userOne?.name || activeDuo.userTwo?.name || "Partner"} · {activeDuo.gym?.name}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {inviteStatuses.length > 0 && (
        <Card className="glass-card border border-white/10">
          <CardHeader>
            <CardTitle>Duo invite status</CardTitle>
            <CardDescription>Track your recent invites.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {inviteStatuses.slice(0, 5).map((invite) => (
              <div key={invite.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{invite.gym?.name ?? "Gym"}</div>
                  <div className="text-xs text-muted-foreground">Code {invite.code}</div>
                </div>
                <span
                  className={
                    invite.status === "Accepted"
                      ? "rounded-full bg-emerald-500/15 text-emerald-300 px-3 py-1 text-xs"
                      : invite.status === "Rejected"
                        ? "rounded-full bg-rose-500/15 text-rose-300 px-3 py-1 text-xs"
                        : "rounded-full bg-amber-500/15 text-amber-300 px-3 py-1 text-xs"
                  }
                >
                  {invite.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {!activeDuo && (
          <Card className="glass-card border border-primary/20">
            <CardHeader>
              <CardTitle>Invite partner</CardTitle>
              <CardDescription>
                Primary flow — get them in fast and lock in duo savings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Choose a gym</Label>
                <select
                  className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm"
                  value={inviteGymId}
                  onChange={(e) => setInviteGymId(e.target.value)}
                >
                  <option value="">Select a gym</option>
                  {gyms.map((gym) => (
                    <option key={gym.id} value={gym.id}>
                      {gym.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Partner email (optional)</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="email"
                    placeholder="partner@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <Button onClick={sendInvite} disabled={sending || !emailVerified}>
                    {sending ? "Sending…" : "Send invite"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Or generate a share code</Label>
                <p className="text-xs text-muted-foreground">
                  Great for WhatsApp or SMS. Your partner will paste the code to join.
                </p>
                <Button
                  variant="outline"
                  disabled={!emailVerified}
                  onClick={() =>
                    fetchJson<{ code?: string }>("/api/duos", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ gymId: inviteGymId, joinTogether: !activeMembership }),
                      retries: 1,
                    }).then((result) => {
                      if (result.ok && result.data?.code) {
                        setLastInviteCode(result.data.code);
                        toast({ title: "Code", description: result.data.code });
                      }
                    })
                  }
                >
                  Generate code
                </Button>
              </div>
              {lastInviteCode && (
                <div className="space-y-2">
                  <Label>Share partner link</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        const link = `${window.location.origin}/invite/${lastInviteCode}`;
                        const gymName = gyms.find((g) => g.id === inviteGymId)?.name ?? "a gym";
                        const text = `Join me at ${gymName} on Fitdex and unlock partner discount. Invite link: ${link}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                      }}
                    >
                      Send via WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const link = `${window.location.origin}/invite/${lastInviteCode}`;
                        navigator.clipboard.writeText(link);
                        toast({ title: "Link copied", description: "Invite link copied to clipboard" });
                      }}
                    >
                      Copy partner link
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="glass-card border border-white/10">
          <CardHeader>
            <CardTitle>Accept invite</CardTitle>
            <CardDescription>Secondary flow — enter a code to join.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="ABC123XY"
                value={acceptCode}
                onChange={(e) => setAcceptCode(e.target.value.toUpperCase())}
                className="uppercase"
              />
              <Button onClick={acceptInvite} disabled={accepting || !acceptCode.trim() || !emailVerified}>
                {accepting ? "Accepting…" : "Accept"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The code is case-insensitive and expires after 7 days.
            </p>
          </CardContent>
        </Card>
      </div>

      {!activeMembership && (
        <Card className="glass-card p-6 border border-white/10">
          <p className="text-sm text-muted-foreground">
            Join a gym first to unlock duo invites and shared savings.
          </p>
        </Card>
      )}
    </div>
  );
}
