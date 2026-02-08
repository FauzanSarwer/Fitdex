import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const payments = await prisma.payment.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amount: true,
      status: true,
      razorpayOrderId: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      gym: { select: { name: true } },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">Razorpay payment records and status.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Latest payments ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Gym</th>
                <th className="py-2">User</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
                <th className="py-2">Order</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-white/10">
                  <td className="py-2">{p.gym?.name ?? "—"}</td>
                  <td className="py-2">
                    <div>{p.user?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.user?.email}</div>
                  </td>
                  <td className="py-2">{formatPrice(p.amount)}</td>
                  <td className="py-2">{p.status}</td>
                  <td className="py-2">{p.razorpayOrderId ?? "—"}</td>
                  <td className="py-2">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
