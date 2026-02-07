import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminInvitesPage() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    redirect("/dashboard");
  }

  const invites = await prisma.invite.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      gym: { select: { name: true } },
      inviter: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Invites</h1>
        <p className="text-sm text-muted-foreground">Invite pipeline and acceptance status.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Latest invites ({invites.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Gym</th>
                <th className="py-2">Inviter</th>
                <th className="py-2">Invitee email</th>
                <th className="py-2">Accepted</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} className="border-t border-white/10">
                  <td className="py-2">{invite.gym?.name ?? "—"}</td>
                  <td className="py-2">
                    <div>{invite.inviter?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{invite.inviter?.email}</div>
                  </td>
                  <td className="py-2">{invite.email}</td>
                  <td className="py-2">{invite.accepted ? "Yes" : "No"}</td>
                  <td className="py-2">{new Date(invite.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
