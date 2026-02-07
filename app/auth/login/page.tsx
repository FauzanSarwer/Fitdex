"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { getProviders, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl") ?? "/dashboard/user";
  const emailParam = searchParams.get("email") ?? "";
  const errorParam = searchParams.get("error") ?? "";
  const [providers, setProviders] = useState<Record<string, { id: string }> | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const callbackUrl = (() => {
    if (!rawCallbackUrl) return "/dashboard/user";
    if (rawCallbackUrl.startsWith("/")) return rawCallbackUrl;
    try {
      const url = new URL(rawCallbackUrl);
      if (typeof window !== "undefined" && url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {}
    return "/dashboard/user";
  })();

  useEffect(() => {
    getProviders().then(setProviders).catch(() => setProviders(null));
  }, []);

  useEffect(() => {
    if (emailParam && !email) {
      setEmail(emailParam);
      requestAnimationFrame(() => passwordRef.current?.focus());
    }
  }, [emailParam, email]);

  useEffect(() => {
    if (errorParam) {
      setError(resolveAuthError(errorParam));
    }
  }, [errorParam]);

  function resolveAuthError(code?: string) {
    if (code === "CredentialsSignin") return "Invalid email or password";
    if (code === "Configuration") return "Auth is not configured. Check environment variables.";
    if (code === "OAuthSignin") return "Google sign-in failed to start. Try again.";
    if (code === "OAuthCallback") return "Google sign-in failed to complete. Check OAuth redirect settings.";
    if (code === "OAuthAccountNotLinked") return "This email is linked to another sign-in method.";
    if (code === "AccessDenied") return "Access denied. Please allow the requested permissions.";
    if (code === "Callback") return "Sign-in callback failed. Try again.";
    if (code === "Verification") return "Unable to verify sign-in request.";
    return "Something went wrong";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res || res?.error || res?.ok === false) {
        setError(resolveAuthError(res?.error ?? undefined));
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
    const inferredRole = callbackUrl.startsWith("/dashboard/owner") ? "OWNER" : "USER";
    const completeUrl = `/auth/complete?next=${encodeURIComponent(callbackUrl)}&role=${encodeURIComponent(inferredRole)}`;
    try {
      await signIn("google", { callbackUrl: completeUrl });
    } catch {
      setLoading(false);
      setError("Google sign-in failed to start");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Enter your credentials or use Google.</CardDescription>
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
                ref={passwordRef}
                autoComplete="current-password"
              />
              <div className="flex justify-end">
                <Link
                  href={`/auth/forgot?email=${encodeURIComponent(email)}`}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log in"}
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
              <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="M23.52 12.272c0-.87-.078-1.705-.224-2.513H12v4.759h6.458a5.53 5.53 0 0 1-2.397 3.63v3.014h3.878c2.272-2.09 3.581-5.17 3.581-8.89Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 24c3.24 0 5.956-1.07 7.94-2.898l-3.878-3.014c-1.078.724-2.456 1.152-4.062 1.152-3.12 0-5.764-2.107-6.705-4.945H1.29v3.094A11.997 11.997 0 0 0 12 24Z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.295 14.295A7.2 7.2 0 0 1 4.92 12c0-.797.137-1.573.375-2.295V6.611H1.29A12.001 12.001 0 0 0 0 12c0 1.936.464 3.764 1.29 5.389l4.005-3.094Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 4.76c1.764 0 3.35.606 4.598 1.796l3.45-3.45C17.956 1.07 15.24 0 12 0 7.304 0 3.192 2.69 1.29 6.611l4.005 3.094C6.236 6.867 8.88 4.76 12 4.76Z"
                    fill="#EA4335"
                  />
                </svg>
              </span>
              Continue with Google
            </Button>
          ) : null}
          <p className="text-center text-sm text-muted-foreground">
            Don’t have an account?{" "}
            <Link href="/auth/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md"><Card className="glass-card p-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></Card></div>}>
      <LoginForm />
    </Suspense>
  );
}
