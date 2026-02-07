import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDuosPage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const duos = await prisma.duo.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      userOne: { select: { name: true, email: true } },
      userTwo: { select: { name: true, email: true } },
      gym: { select: { name: true } },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Duos</h1>
        <p className="text-sm text-muted-foreground">Active duo partnerships and gym pairing.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Latest duos ({duos.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Gym</th>
                <th className="py-2">User One</th>
                <th className="py-2">User Two</th>
                <th className="py-2">Active</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {duos.map((duo) => (
                <tr key={duo.id} className="border-t border-white/10">
                  <td className="py-2">{duo.gym?.name ?? "—"}</td>
                  <td className="py-2">
                    <div>{duo.userOne?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{duo.userOne?.email}</div>
                  </td>
                  <td className="py-2">
                    <div>{duo.userTwo?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{duo.userTwo?.email}</div>
                  </td>
                  <td className="py-2">{duo.active ? "Yes" : "No"}</td>
                  <td className="py-2">{new Date(duo.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
