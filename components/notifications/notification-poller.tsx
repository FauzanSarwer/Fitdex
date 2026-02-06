"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";

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
      fetchingRef.current = true;
      try {
        const res = await fetch("/api/notifications");
        const data = await res.json();
        if (!res.ok) return;
        const notifications: NotificationItem[] = data.notifications ?? [];
        if (notifications.length === 0) return;

        notifications.forEach((note) => {
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification(note.title, { body: note.body });
          } else {
            toast({ title: note.title, description: note.body });
          }
        });

        await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: notifications.map((n) => n.id) }),
        });
      } catch {
        // ignore
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(interval);
  }, [status, toast]);

  return null;
}
