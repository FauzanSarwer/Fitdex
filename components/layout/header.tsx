"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { isOwner } from "@/lib/permissions";
import { motion } from "framer-motion";
import Image from "next/image";
import { MapPin, User, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const owner = status === "authenticated" && isOwner(session);
  const showOwnerCta = status !== "loading" && !session;
  const showOwnerExplore = status === "authenticated" && owner;
  const showPricing = status === "authenticated" && owner;
  const emailVerified = !!(session?.user as { emailVerified?: boolean })?.emailVerified;
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const displayName = session?.user?.name ?? "Account";

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10"
    >
      {!emailVerified && session && (
        <div className="bg-amber-500/20 border-b border-amber-500/30">
          <div className="container mx-auto px-4 py-2 text-xs text-amber-100 flex flex-wrap items-center gap-2 justify-between">
            <span>
              Verify your email address. A link has been sent to {session.user.email ?? "your email"}.
            </span>
            <button
              type="button"
              disabled={sendingVerification}
              className="text-amber-50 underline hover:text-white disabled:opacity-60"
              onClick={async () => {
                setSendingVerification(true);
                try {
                  const res = await fetch("/api/auth/verify", { method: "POST" });
                  if (res.ok) setVerificationSent(true);
                } finally {
                  setSendingVerification(false);
                }
              }}
            >
              {sendingVerification ? "Sending…" : verificationSent ? "Link sent" : "Resend link"}
            </button>
          </div>
        </div>
      )}
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 shadow-glow-sm">
            <Image
              src="/fitdex-logo.png"
              alt="Fitdex"
              width={24}
              height={24}
              className="h-6 w-6"
              priority
            />
          </div>
          <span className="text-xl font-bold tracking-tight">Fitdex</span>
        </Link>
        <nav className="hidden md:flex items-center gap-4">
          <Link
            href="/explore"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <MapPin className="h-4 w-4" />
            Explore
          </Link>
          {showPricing && (
            <Link
              href="/pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
          )}
          <Link
            href="/owners"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Owners
          </Link>
          {status === "authenticated" && (
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
          )}
          {showOwnerExplore && (
            <Link
              href="/dashboard/owner/explore"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Owner Explore
            </Link>
          )}
          {showOwnerCta && (
            <Button asChild size="sm" className="bg-gradient-to-r from-primary to-accent shadow-glow">
              <Link href="/owners">List your gym (owners)</Link>
            </Button>
          )}
        </nav>
        <div className="flex items-center gap-3">
          {status === "loading" ? (
            <div className="h-9 w-12 rounded-lg bg-white/10 animate-pulse" />
          ) : session ? (
            <>
              <span className="hidden md:inline text-sm font-medium text-muted-foreground">
                {displayName}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 glass border-white/10">
                  <DropdownMenuItem asChild>
                    <Link href={role === "ADMIN" ? "/dashboard/admin" : owner ? "/dashboard/owner" : "/dashboard/user"}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      {role === "ADMIN" ? "Admin dashboard" : "Dashboard"}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/auth/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
