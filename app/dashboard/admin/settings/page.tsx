import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Admin settings</h1>
        <p className="text-sm text-muted-foreground">Operational preferences and system toggles.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>System controls</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Configure payout windows, notification defaults, and policy flags here.</p>
          <p>Next: add feature flags, role management, and maintenance toggles.</p>
        </CardContent>
      </Card>
    </div>
  );
}
