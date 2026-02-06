"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Users, BarChart3, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function OwnerDashboardPage() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/owner/gym")
      .then((r) => r.json())
      .then((d) => {
        setGyms(d.gyms ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  const totalMembers = gyms.reduce(
    (sum, gym) => sum + (gym._count?.memberships ?? 0),
    0
  );
  const totalDuos = gyms.reduce(
    (sum, gym) => sum + (gym._count?.duos ?? 0),
    0
  );

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">Owner dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage your gym(s) and performance.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard/owner/gym">Add gym</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/owner/analytics">View analytics</Link>
          </Button>
        </div>
      </motion.div>

      {gyms.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardHeader>
              <CardDescription>Total gyms</CardDescription>
              <CardTitle className="text-3xl">{gyms.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card">
            <CardHeader>
              <CardDescription>Total members</CardDescription>
              <CardTitle className="text-3xl">{totalMembers}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card">
            <CardHeader>
              <CardDescription>Total duos</CardDescription>
              <CardTitle className="text-3xl">{totalDuos}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {gyms.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No gyms yet</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/dashboard/owner/gym">Add your first gym</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/owners">See plans</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {gyms.map((gym) => (
            <Card key={gym.id} className="glass-card">
              <CardHeader>
                <CardTitle>{gym.name}</CardTitle>
                <CardDescription>{gym.address}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {gym._count?.memberships ?? 0} members
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  {gym._count?.duos ?? 0} duos
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/owner/analytics?gymId=${gym.id}`}>Analytics</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/owner/gym?gymId=${gym.id}`}>Edit</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
