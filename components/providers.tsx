"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { PageViewTracker } from "@/components/analytics/page-view";
import { NotificationPoller } from "@/components/notifications/notification-poller";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <NotificationPoller />
      <Toaster />
    </SessionProvider>
  );
}
