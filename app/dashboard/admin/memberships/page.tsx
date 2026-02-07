import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminMembershipsPage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const memberships = await prisma.membership.findMany({
    take: 100,
    orderBy: { startedAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      gym: { select: { name: true } },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Memberships</h1>
        <p className="text-sm text-muted-foreground">Active and historical membership records.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Latest memberships ({memberships.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Member</th>
                <th className="py-2">Gym</th>
                <th className="py-2">Plan</th>
                <th className="py-2">Price</th>
                <th className="py-2">Active</th>
                <th className="py-2">Expires</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id} className="border-t border-white/10">
                  <td className="py-2">
                    <div>{m.user?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{m.user?.email}</div>
                  </td>
                  <td className="py-2">{m.gym?.name ?? "—"}</td>
                  <td className="py-2">{m.planType}</td>
                  <td className="py-2">{formatPrice(m.finalPrice)}</td>
                  <td className="py-2">{m.active ? "Yes" : "No"}</td>
                  <td className="py-2">{new Date(m.expiresAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
