"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Mail } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";

export default function DuoPage() {
  const { toast } = useToast();
  const [duos, setDuos] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
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
      fetchJson<{ duos?: any[]; error?: string }>("/api/duos", { retries: 1 }),
      fetchJson<{ memberships?: any[]; error?: string }>("/api/memberships", { retries: 1 }),
    ])
      .then(([d, m]) => {
        if (!active) return;
        if (!d.ok || !m.ok) {
          setError("Failed to load duo data");
          toast({ title: "Error", description: "Failed to load duo data", variant: "destructive" });
        }
        setDuos(d.ok ? d.data?.duos ?? [] : []);
        setMemberships(m.ok ? m.data?.memberships ?? [] : []);
        const activeMembership = (m.ok ? m.data?.memberships ?? [] : []).find((x: any) => x.active);
        if (activeMembership) setInviteGymId(activeMembership.gymId);
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

  async function sendInvite() {
    if (!inviteGymId) {
      toast({ title: "No gym", description: "You need an active membership first.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const result = await fetchJson<{ code?: string; email?: string; error?: string }>("/api/duos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId: inviteGymId, email: inviteEmail || undefined }),
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
          Invite a partner to join your gym. If they join, your partner discount will apply on your next renewal.
        </p>
      </motion.div>

      {activeDuo && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Active duo</CardTitle>
            <CardDescription>
              Partner: {activeDuo.userOne?.name || activeDuo.userTwo?.name || "Partner"} · {activeDuo.gym?.name}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {activeMembership && !activeDuo && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Invite partner (discount on next renewal)</CardTitle>
            <CardDescription>
              Invite someone to join your gym. They get the discount when they join. Your partner discount applies on your next renewal cycle. Discount % is set by the gym owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Partner email (optional)</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="partner@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Button onClick={sendInvite} disabled={sending}>
                  {sending ? "Sending…" : "Send invite"}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Or generate code</Label>
              <Button
                variant="outline"
                onClick={() =>
                  fetchJson<{ code?: string }>("/api/duos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ gymId: inviteGymId, joinTogether: true }),
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
                    variant="secondary"
                    onClick={() => {
                      const link = `${window.location.origin}/invite/${lastInviteCode}`;
                      navigator.clipboard.writeText(link);
                      toast({ title: "Link copied", description: "Invite link copied to clipboard" });
                    }}
                  >
                    Copy partner link
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const link = `${window.location.origin}/invite/${lastInviteCode}`;
                      const text = `Join me at FitDex and unlock partner discount: ${link}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                    }}
                  >
                    Send via WhatsApp
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Accept invite</CardTitle>
          <CardDescription>Have a code? Enter it below.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="ABC123XY"
              value={acceptCode}
              onChange={(e) => setAcceptCode(e.target.value.toUpperCase())}
              className="uppercase"
            />
            <Button onClick={acceptInvite} disabled={accepting || !acceptCode.trim()}>
              {accepting ? "Accepting…" : "Accept"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!activeMembership && (
        <Card className="glass-card p-8 text-center">
          <p className="text-muted-foreground">Join a gym first to invite a duo partner.</p>
        </Card>
      )}
    </div>
  );
}
