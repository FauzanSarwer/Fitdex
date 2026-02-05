"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function DashboardRedirect() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !pathname) return;
    const role = (session?.user as { role?: string })?.role;
    const isOwner = role === "OWNER" || role === "ADMIN";
    if (isOwner && pathname.startsWith("/dashboard/user")) {
      window.location.href = "/dashboard/owner";
    } else if (!isOwner && pathname.startsWith("/dashboard/owner")) {
      window.location.href = "/dashboard/user";
    }
  }, [pathname, session, status]);

  return null;
}
