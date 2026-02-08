"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (emailParam && !email) {
      setEmail(emailParam);
    }
  }, [emailParam, email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setResetUrl(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Unable to start reset");
        setLoading(false);
        return;
      }
      if (data?.resetUrl) setResetUrl(data.resetUrl as string);
      setSubmitted(true);
      setLoading(false);
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>We’ll email you a reset link if your account exists.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading || submitted}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {submitted && !error ? (
              <p className="text-sm text-muted-foreground">
                Check your inbox for the reset link.
              </p>
            ) : null}
            {resetUrl ? (
              <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
                <p className="text-muted-foreground">Dev reset link:</p>
                <Link href={resetUrl} className="text-primary hover:underline break-all">
                  {resetUrl}
                </Link>
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading || submitted}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link href="/auth/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md">
          <Card className="glass-card p-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </Card>
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
