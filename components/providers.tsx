"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { PageViewTracker } from "@/components/analytics/page-view";
import { NotificationPoller } from "@/components/notifications/notification-poller";
import { ThemeProvider } from "@/src/context/theme-context";

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
