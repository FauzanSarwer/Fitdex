import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminGymEditor } from "@/components/admin/gym-editor";

export const dynamic = "force-dynamic";

export default async function AdminGymDetailPage({ params }: { params: { gymId: string } }) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const gym = await prisma.gym.findUnique({
    where: { id: params.gymId },
    include: { owner: { select: { name: true, email: true } }, transactions: { take: 10, orderBy: { createdAt: "desc" } } },
  });

  if (!gym) {
    redirect("/dashboard/admin/gyms");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{gym.name}</h1>
        <p className="text-sm text-muted-foreground">Owner: {gym.owner?.name ?? "—"} · {gym.owner?.email ?? "—"}</p>
        <Link href="/dashboard/admin/gyms" className="text-xs text-primary hover:underline">Back to gyms</Link>
      </div>

      <AdminGymEditor gym={gym} />

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {gym.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2">Total</th>
                  <th className="py-2">Commission</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {gym.transactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-white/10">
                    <td className="py-2">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="py-2">₹{(tx.totalAmount / 100).toFixed(2)}</td>
                    <td className="py-2">₹{(tx.platformCommissionAmount / 100).toFixed(2)}</td>
                    <td className="py-2">{tx.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
