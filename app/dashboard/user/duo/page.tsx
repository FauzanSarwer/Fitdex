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

export default function DuoPage() {
  const { toast } = useToast();
  const [duos, setDuos] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGymId, setInviteGymId] = useState("");
  const [sending, setSending] = useState(false);
  const [acceptCode, setAcceptCode] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/duos").then((r) => r.json()),
      fetch("/api/memberships").then((r) => r.json()),
    ]).then(([d, m]) => {
      setDuos(d.duos ?? []);
      setMemberships(m.memberships ?? []);
      const active = (m.memberships ?? []).find((x: any) => x.active);
      if (active) setInviteGymId(active.gymId);
      setLoading(false);
    });
  }, []);

  const activeMembership = memberships.find((m) => m.active);
  const activeDuo = duos.find((d) => d.active);

  async function sendInvite() {
    if (!inviteGymId) {
      toast({ title: "No gym", description: "You need an active membership first.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/duos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId: inviteGymId, email: inviteEmail || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Failed to send invite", variant: "destructive" });
        setSending(false);
        return;
      }
      if (data.code) {
        toast({ title: "Invite created", description: `Share this code: ${data.code}` });
      } else {
        toast({ title: "Invite sent", description: `Sent to ${data.email}` });
      }
      setInviteEmail("");
      setDuos((prev) => [...prev]); // refetch would be better
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
    setSending(false);
  }

  async function acceptInvite() {
    if (!acceptCode.trim()) return;
    setAccepting(true);
    try {
      const res = await fetch("/api/duos/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: acceptCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Invalid code", variant: "destructive" });
        setAccepting(false);
        return;
      }
      toast({ title: "Duo activated", description: "You're now partners!" });
      setAcceptCode("");
      setDuos((prev) => [...prev]);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
    setAccepting(false);
  }

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-48 rounded-2xl" />
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
              <Button variant="outline" onClick={() => fetch("/api/duos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gymId: inviteGymId }) }).then(r => r.json()).then(d => toast({ title: "Code", description: d.code }))}>
                Generate code
              </Button>
            </div>
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
