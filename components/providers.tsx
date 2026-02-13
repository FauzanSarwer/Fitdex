"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/src/context/theme-context";

const PageViewTracker = dynamic(
  () => import("@/components/analytics/page-view").then((mod) => mod.PageViewTracker),
  { ssr: false }
);

const NotificationPoller = dynamic(
  () => import("@/components/notifications/notification-poller").then((mod) => mod.NotificationPoller),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider refetchInterval={60} refetchOnWindowFocus>
        {children}
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <NotificationPoller />
        <Toaster />
      </SessionProvider>
    </ThemeProvider>
  );
}
