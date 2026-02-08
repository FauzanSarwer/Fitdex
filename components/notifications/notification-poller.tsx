"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/client-fetch";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
};

export function NotificationPoller() {
  const { status } = useSession();
  const { toast } = useToast();
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => undefined);
      }
    }

    const fetchNotifications = async () => {
      if (fetchingRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      fetchingRef.current = true;
      try {
        const result = await fetchJson<{ notifications?: NotificationItem[] }>("/api/notifications", { retries: 1 });
        if (!result.ok) return;
        const notifications: NotificationItem[] = result.data?.notifications ?? [];
        if (notifications.length === 0) return;

        notifications.forEach((note) => {
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification(note.title, { body: note.body });
          } else {
            toast({ title: note.title, description: note.body });
          }
        });

        await fetchJson("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: notifications.map((n) => n.id) }),
          retries: 1,
        });
      } catch {
        // ignore
      } finally {
        fetchingRef.current = false;
      }
    };

    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(fetchNotifications);
    } else {
      setTimeout(fetchNotifications, 0);
    }
    const interval = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(interval);
  }, [status, toast]);

  return null;
}
