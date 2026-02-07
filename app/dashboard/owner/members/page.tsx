"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";

export default function OwnerMembersPage() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/gym", { retries: 1 })
      .then((result) => {
        if (!result.ok) {
          setError(result.error ?? "Failed to load gyms");
          setGyms([]);
          setLoading(false);
          return;
        }
        const list = result.data?.gyms ?? [];
        setGyms(list);
        if (list.length > 0 && !selectedGymId) setSelectedGymId(list[0].id);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load gyms");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedGymId) return;
    fetchJson<{ members?: any[]; error?: string }>(`/api/owner/members?gymId=${selectedGymId}`, { retries: 1 })
      .then((result) => {
        if (!result.ok) {
          setError(result.error ?? "Failed to load members");
          setMembers([]);
          return;
        }
        setMembers(result.data?.members ?? []);
      })
      .catch(() => {
        setError("Failed to load members");
        setMembers([]);
      });
  }, [selectedGymId]);

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
            <CardTitle>Could not load members</CardTitle>
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
          Members
        </h1>
        <p className="text-muted-foreground text-sm">Active members by gym.</p>
      </motion.div>

      {gyms.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Gym:</span>
          <Select value={selectedGymId} onValueChange={setSelectedGymId}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gyms.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Active members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active members.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-2 border-b border-white/10 last:border-0"
                >
                  <div>
                    <p className="font-medium">{m.user?.name ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">{m.user?.email}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{m.planType}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
