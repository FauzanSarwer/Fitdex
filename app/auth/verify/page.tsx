"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const action = (searchParams.get("action") ?? "verify") as "verify" | "delete";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your link...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}&action=${encodeURIComponent(action)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Verification failed");
        setStatus("success");
        setMessage(action === "delete" ? "Account deleted successfully." : "Email verified successfully.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err?.message ?? "Verification failed");
      });
  }, [token, action]);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-xl mx-auto">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{status === "success" ? "All set" : status === "error" ? "Action failed" : "Processing"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/auth/login">Go to login</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-xl mx-auto">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Processing</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Verifying your link...</CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
