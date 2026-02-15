"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchJson } from "@/lib/client-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function StaticQrRedirectPage() {
  const params = useParams<{ gymId: string; type: string }>();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await fetchJson<{ deepLink?: string; error?: string }>(
        `/api/qr/static/${params.gymId}/${params.type}`
      );
      if (!res.ok || !res.data?.deepLink) {
        setError(res.error ?? res.data?.error ?? "Unable to fetch token");
        return;
      }
      setLink(res.data.deepLink);
      window.location.href = res.data.deepLink;
    };

    void run();
  }, [params.gymId, params.type]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="glass-card w-full max-w-md">
        <CardHeader>
          <CardTitle>Opening Fitdex...</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Redirecting to the Fitdex app to verify your scan.</p>
          )}
          {link ? (
            <Button asChild>
              <a href={link}>Open Fitdex</a>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
