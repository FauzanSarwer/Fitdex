import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const transactions = await prisma.transaction.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      totalAmount: true,
      platformCommissionAmount: true,
      gymPayoutAmount: true,
      paymentStatus: true,
      settlementStatus: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      gym: { select: { name: true } },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <p className="text-sm text-muted-foreground">Payment settlements and commission breakdown.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Latest transactions ({transactions.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Gym</th>
                <th className="py-2">User</th>
                <th className="py-2">Total</th>
                <th className="py-2">Commission</th>
                <th className="py-2">Payout</th>
                <th className="py-2">Status</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-white/10">
                  <td className="py-2">{tx.gym?.name ?? "—"}</td>
                  <td className="py-2">
                    <div>{tx.user?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{tx.user?.email}</div>
                  </td>
                  <td className="py-2">{formatPrice(tx.totalAmount)}</td>
                  <td className="py-2">{formatPrice(tx.platformCommissionAmount)}</td>
                  <td className="py-2">{formatPrice(tx.gymPayoutAmount)}</td>
                  <td className="py-2">{tx.paymentStatus}/{tx.settlementStatus}</td>
                  <td className="py-2">{new Date(tx.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
