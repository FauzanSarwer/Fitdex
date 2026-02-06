"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { getProviders, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function RegisterForm() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const isOwnerFlow = roleParam === "owner" || roleParam === "OWNER";
  const rawCallbackUrl =
    searchParams.get("callbackUrl") ??
    (isOwnerFlow ? "/dashboard/owner" : "/dashboard/user");
  const [providers, setProviders] = useState<Record<string, { id: string }> | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "OWNER">(isOwnerFlow ? "OWNER" : "USER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingEmail, setExistingEmail] = useState(false);

  const callbackUrl = (() => {
    if (!rawCallbackUrl) return isOwnerFlow ? "/dashboard/owner" : "/dashboard/user";
    if (rawCallbackUrl.startsWith("/")) return rawCallbackUrl;
    try {
      const url = new URL(rawCallbackUrl);
      if (typeof window !== "undefined" && url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {}
    return isOwnerFlow ? "/dashboard/owner" : "/dashboard/user";
  })();

  useEffect(() => {
    getProviders().then(setProviders).catch(() => setProviders(null));
  }, []);

  function resolveAuthError(code?: string) {
    if (code === "CredentialsSignin") return "Invalid email or password";
    if (code === "Configuration") return "Auth is not configured. Check environment variables.";
    return "Something went wrong";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setExistingEmail(false);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        const apiError = (data?.error ?? "Registration failed") as string;
        if (apiError.toLowerCase().includes("email already")) {
          setExistingEmail(true);
          setError("This email is already used. Log in with this email.");
        } else {
          setError(apiError);
        }
        setLoading(false);
        return;
      }
      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        const msg = resolveAuthError(signInRes.error);
        setError(msg === "Invalid email or password" ? "Account created. Please log in." : msg);
        setLoading(false);
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    await signIn("google", { callbackUrl });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Join as a member or gym owner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>I am a</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "USER" | "OWNER")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Member (find gyms & duos)</SelectItem>
                  <SelectItem value="OWNER">Gym owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{error}</p>
                {existingEmail && (
                  <Button asChild variant="secondary" className="w-full">
                    <Link
                      href={`/auth/login?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(
                        callbackUrl
                      )}`}
                    >
                      Log in with this email
                    </Link>
                  </Button>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign up"}
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <span className="relative flex justify-center text-xs text-muted-foreground">
              Or
            </span>
          </div>
          {providers?.google ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={loading}
            >
              Continue with Google
            </Button>
          ) : null}
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md"><Card className="glass-card p-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></Card></div>}>
      <RegisterForm />
    </Suspense>
  );
}
