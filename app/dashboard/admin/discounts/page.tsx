import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDiscountsPage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const discounts = await prisma.discountCode.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { gym: { select: { name: true } } },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Discount codes</h1>
        <p className="text-sm text-muted-foreground">Global discount visibility for all gyms.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Recent codes ({discounts.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Gym</th>
                <th className="py-2">Code</th>
                <th className="py-2">Type</th>
                <th className="py-2">Value</th>
                <th className="py-2">Uses</th>
                <th className="py-2">Valid until</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((code) => (
                <tr key={code.id} className="border-t border-white/10">
                  <td className="py-2">{code.gym?.name ?? "—"}</td>
                  <td className="py-2 font-mono text-xs">{code.code}</td>
                  <td className="py-2">{code.discountType}</td>
                  <td className="py-2">
                    {code.discountType === "FLAT" ? formatPrice(code.discountValue) : `${code.discountValue}%`}
                  </td>
                  <td className="py-2">{code.usedCount}/{code.maxUses}</td>
                  <td className="py-2">{new Date(code.validUntil).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
