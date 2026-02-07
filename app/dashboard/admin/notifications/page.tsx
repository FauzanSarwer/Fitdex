import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const notifications = await prisma.notification.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">Latest in-app notification activity.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Recent notifications ({notifications.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {notifications.length === 0 ? (
            <p className="text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((note) => (
              <div key={note.id} className="border-b border-white/10 pb-2 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{note.title}</div>
                  <div className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-xs text-muted-foreground">{note.user?.email ?? note.user?.name}</div>
                <div className="text-sm">{note.body}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
